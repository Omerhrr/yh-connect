"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ThreadOut } from "@/lib/api";

export function useProjectUnread() {
  const [threads, setThreads] = useState<ThreadOut[]>([]);

  const loadUnread = useCallback(() => {
    api
      .messageThreads()
      .then(setThreads)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 20000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  const unreadByProject: Record<string, number> = {};
  for (const t of threads) {
    if (t.unread_count > 0) {
      unreadByProject[t.project_id] = (unreadByProject[t.project_id] || 0) + t.unread_count;
    }
  }

  return { threads, unreadByProject, loadUnread };
}
