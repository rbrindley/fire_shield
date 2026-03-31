"""FastAPI application factory and main entry point."""

import secrets
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings
from app.config.database import init_db

settings = get_settings()

# ── Simple rate limiter ──────────────────────────────────────────────────────

_rate_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str, limit: int = 20, window: int = 60) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.time()
    bucket = _rate_buckets[ip]
    # Prune old entries
    _rate_buckets[ip] = [t for t in bucket if now - t < window]
    if len(_rate_buckets[ip]) >= limit:
        return False
    _rate_buckets[ip].append(now)
    return True


# ── Demo session store ───────────────────────────────────────────────────────

_demo_sessions: dict[str, float] = {}  # token -> expiry timestamp


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    await init_db()
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Fire Shield API",
        version="1.0.0",
        description="Property-specific wildfire prevention assistant for the Rogue Valley",
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Property / geocoding
    from app.jurisdiction.routes import router as jurisdiction_router
    app.include_router(jurisdiction_router, prefix="/api/jurisdiction", tags=["jurisdiction"])

    # Zone engine
    from app.zone.routes import router as zone_router
    app.include_router(zone_router, prefix="/api/zones", tags=["zones"])

    # RAG query
    from app.rag.routes import router as rag_router
    app.include_router(rag_router, prefix="/api/query", tags=["query"])

    # Plant database
    from app.plant.routes import router as plant_router
    app.include_router(plant_router, prefix="/api/plants", tags=["plants"])

    # Document ingestion
    from app.ingest.routes import router as ingest_router
    app.include_router(ingest_router, prefix="/api/ingest", tags=["ingest"])

    # Admin
    from app.admin.routes import router as admin_router
    app.include_router(admin_router, prefix="/api/admin", tags=["admin"])

    # Conversation memory
    from app.memory.routes import router as memory_router
    app.include_router(memory_router, prefix="/api/memory", tags=["memory"])

    # Nursery search
    from app.nursery.routes import router as nursery_router
    app.include_router(nursery_router, prefix="/api/nursery", tags=["nursery"])

    # Building footprints
    from app.building.routes import router as building_router
    app.include_router(building_router, prefix="/api/buildings", tags=["buildings"])

    # LLM full knowledge-base dump
    from app.llms.routes import router as llms_router
    app.include_router(llms_router, prefix="/api", tags=["llms"])

    # ── Demo auth endpoints ─────────────────────────────────────────────────

    class DemoLoginRequest(BaseModel):
        username: str
        password: str

    @app.post("/api/auth/login")
    async def demo_login(request: Request, response: Response, body: DemoLoginRequest):
        """Simple demo login with hardcoded credentials."""
        if body.username != settings.demo_username or body.password != settings.demo_password:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = secrets.token_urlsafe(32)
        _demo_sessions[token] = time.time() + (8 * 3600)  # 8 hour expiry

        response.set_cookie(
            key="fs_session",
            value=token,
            httponly=True,
            secure=settings.app_env == "production",
            samesite="lax",
            max_age=8 * 3600,
        )
        return {"message": "Login successful", "token": token}

    @app.get("/api/auth/check")
    async def check_auth(request: Request):
        """Check if current session is valid."""
        token = (
            request.cookies.get("fs_session")
            or (request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None)
        )
        if not token or token not in _demo_sessions:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if _demo_sessions[token] < time.time():
            del _demo_sessions[token]
            raise HTTPException(status_code=401, detail="Session expired")
        return {"authenticated": True}

    @app.post("/api/auth/logout")
    async def demo_logout(request: Request, response: Response):
        """End demo session."""
        token = request.cookies.get("fs_session")
        if token and token in _demo_sessions:
            del _demo_sessions[token]
        response.delete_cookie("fs_session")
        return {"message": "Logged out"}

    # ── Rate limiting + auth middleware for /api/query/ ───────────────────

    @app.middleware("http")
    async def protect_query_endpoint(request: Request, call_next):
        """Rate limit and require auth for the query endpoint (costs money)."""
        if request.url.path == "/api/query/" and request.method == "POST":
            # Rate limit by IP
            client_ip = request.client.host if request.client else "unknown"
            if not _check_rate_limit(client_ip, settings.query_rate_limit, settings.query_rate_window):
                return Response(
                    content='{"detail":"Rate limit exceeded. Try again in a minute."}',
                    status_code=429,
                    media_type="application/json",
                )

            # Require auth
            token = (
                request.cookies.get("fs_session")
                or (request.headers.get("authorization", "").removeprefix("Bearer ").strip() or None)
            )
            if not token or token not in _demo_sessions or _demo_sessions[token] < time.time():
                return Response(
                    content='{"detail":"Authentication required"}',
                    status_code=401,
                    media_type="application/json",
                )

        return await call_next(request)

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "app": "fire_shield", "version": "1.0.0"}

    return app


app = create_app()
