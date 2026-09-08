"use client";

import { useEffect, useRef } from "react";
import { getToken, type MessageOut } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

export type TypingEvent = { event: "typing"; user_id: string };
export type CallSignalEvent = {
  event: "call:offer" | "call:answer" | "call:ice" | "call:end" | "call:reject" | "call:busy";
  from: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
export type WsInboundEvent = MessageOut | TypingEvent | CallSignalEvent;

const HEARTBEAT_INTERVAL_MS = 25000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

export function useMessageSocket(projectId: string | null, onMessage: (m: WsInboundEvent) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const clearTimers = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (cancelled) return;
      const wsUrl = `${API_BASE.replace(/^http/, "ws")}/ws/projects/${projectId}/messages?token=${encodeURIComponent(token)}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        return;
      }
      socket = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        // A steady trickle of frames keeps the socket alive through any
        // reverse proxy / load balancer sitting in front (Caddy, nginx,
        // CDNs) that idle-times-out WebSocket connections with no traffic —
        // silently dropping live delivery and, worse, call signaling (a
        // dropped socket makes the other party look "unavailable" for
        // voice calls even though their tab is open).
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
          }
        }, HEARTBEAT_INTERVAL_MS);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsInboundEvent;
          onMessageRef.current(data);
        } catch {
        }
      };
      ws.onerror = () => {
      };
      ws.onclose = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;
        const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimers();
      socket?.close();
      wsRef.current = null;
    };
  }, [projectId]);

  const sendTyping = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "typing" }));
      } catch {
      }
    }
  };

  const sendRaw = (payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  return { sendTyping, sendRaw };
}
