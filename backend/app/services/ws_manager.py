"""In-memory WebSocket connection registry for live message delivery.

Keyed by (project_id, user_id) so a push can be targeted at exactly the
sockets a given user has open for a given project thread. In-memory only,
fine for a single backend process; if this ever runs behind multiple
instances, messages would need to be broadcast via Redis pub/sub (or similar)
instead so a push from one instance reaches sockets connected to another.
Until then, clients still have the 6s poll as a fallback so nothing breaks
in a multi-instance deployment, it just won't be instant.
"""
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[tuple[str, str], set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: str, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[(project_id, user_id)].add(ws)

    def disconnect(self, project_id: str, user_id: str, ws: WebSocket) -> None:
        key = (project_id, user_id)
        self._connections[key].discard(ws)
        if not self._connections[key]:
            self._connections.pop(key, None)

    async def send_to(self, project_id: str, user_id: str, payload: dict) -> None:
        for ws in list(self._connections.get((project_id, user_id), [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(project_id, user_id, ws)

    def is_online(self, user_id: str) -> bool:
        """True if this user has any open websocket connection right now, on
        any project thread. Used to decide whether a new message/update needs
        an email nudge (see app/services/project_log.py) — if they're already
        watching a thread live, an email would just be noise."""
        for (_, uid), sockets in self._connections.items():
            if uid == user_id and sockets:
                return True
        return False


manager = ConnectionManager()
