"use client";

import { useEffect, useRef } from "react";
import { getToken, type MessageOut } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

/**
 * Live push channel for a project's message thread. Falls back silently if
 * the connection can't be established (no WS support behind a proxy, token
 * expired, etc), the caller should keep its own polling as a safety net.
 */
export function useMessageSocket(projectId: string | null, onMessage: (m: MessageOut) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!projectId) return;
    const token = getToken();
    if (!token) return;

    const wsUrl = `${API_BASE.replace(/^http/, "ws")}/ws/projects/${projectId}/messages?token=${encodeURIComponent(token)}`;
    let ws: WebSocket | null = null;
    let closedByCleanup = false;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as MessageOut;
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
    };
  }, [projectId]);
}
