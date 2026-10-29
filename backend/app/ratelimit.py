"""Login attempt limiter: 5 wrong passwords in 15 minutes blocks that
email (from that address) for the rest of the window.

Kept in memory on purpose, to stay simple: it resets when the server
restarts and would need a shared store (database or Redis) if the API
ran on several servers. Noted in the README roadmap."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

WINDOW_SECONDS = 15 * 60
MAX_FAILS = 5
_fails = defaultdict(deque)


def _key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}|{email.strip().lower()}"


def check(request: Request, email: str) -> None:
    q = _fails[_key(request, email)]
    now = time.time()
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()
    if len(q) >= MAX_FAILS:
        minutes = int((WINDOW_SECONDS - (now - q[0])) // 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        )


def record_failure(request: Request, email: str) -> None:
    _fails[_key(request, email)].append(time.time())


def clear(request: Request, email: str) -> None:
    _fails.pop(_key(request, email), None)
