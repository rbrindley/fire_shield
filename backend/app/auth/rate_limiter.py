"""Rate limiting for authentication."""

import time
from collections import defaultdict
from dataclasses import dataclass, field

from app.config import get_settings

settings = get_settings()


@dataclass
class RateLimitEntry:
    """Rate limit tracking entry."""

    attempts: int = 0
    window_start: float = field(default_factory=time.time)


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self):
        self._attempts: dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)

    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed under rate limit."""
        entry = self._attempts[key]
        now = time.time()

        # Reset window if expired
        if now - entry.window_start > settings.login_rate_limit_window_seconds:
            entry.attempts = 0
            entry.window_start = now

        return entry.attempts < settings.login_rate_limit_attempts

    def record_attempt(self, key: str) -> None:
        """Record an attempt."""
        entry = self._attempts[key]
        now = time.time()

        if now - entry.window_start > settings.login_rate_limit_window_seconds:
            entry.attempts = 1
            entry.window_start = now
        else:
            entry.attempts += 1

    def reset(self, key: str) -> None:
        """Reset rate limit for key."""
        if key in self._attempts:
            del self._attempts[key]


# Global rate limiter instance
rate_limiter = RateLimiter()
