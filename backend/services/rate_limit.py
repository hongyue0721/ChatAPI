from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from time import monotonic


@dataclass
class MessageRateLimiter:
    default_limit: int = 0
    window_seconds: float = 60.0
    _events: dict[str, deque[float]] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)

    def allow(self, key: str, limit: int | None = None) -> bool:
        effective_limit = self.default_limit if limit is None else int(limit)
        if effective_limit <= 0:
            return True

        now = monotonic()
        with self._lock:
            bucket = self._events.setdefault(key, deque())
            cutoff = now - self.window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= effective_limit:
                return False
            bucket.append(now)
            if not bucket:
                self._events.pop(key, None)
            return True
