"use client";

import { useEffect, useRef } from "react";
import { getToken, type MessageOut } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

export type TypingEvent = { event: "typing"; user_id: string };
export type WsInboundEvent = MessageOut | TypingEvent;

/**
 * Live push channel for a project's message thread. Falls back silently if
 * the connection can't be established (no WS support behind a proxy, token
 * expired, etc), the caller should keep its own polling as a safety net.
 * Also exposes `sendTyping()`, a lightweight ping relayed to the other
 * participant so their UI can show "typing…".
 */
export function useMessageSocket(projectId: string | null, onMessage: (m: WsInboundEvent) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const token = getToken();
    if (!token) return;

    const wsUrl = `${API_BASE.replace(/^http/, "ws")}/ws/projects/${projectId}/messages?token=${encodeURIComponent(token)}`;
    let ws: WebSocket | null = null;
    let closedByCleanup = false;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsInboundEvent;
          onMessageRef.current(data);
        } catch {
          // ignore malformed payloads
        }
      };
      ws.onerror = () => {
        // swallow, the caller's polling fallback covers this
      };
    } catch {
      ws = null;
    }

    return () => {
      closedByCleanup = true;
      ws?.close();
      void closedByCleanup;
      wsRef.current = null;
    };
  }, [projectId]);

  const sendTyping = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "typing" }));
      } catch {
        // ignore
      }
    }
  };

  return { sendTyping };
}
