"""Security middleware for CSRF protection and security headers."""

import secrets
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Check if this is a PDF view request (needs to be embeddable in iframe)
        is_pdf_view = request.url.path.startswith("/corpus/view/")
        
        # Content Security Policy
        if is_pdf_view:
            # Allow same-origin framing for PDF viewer
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "frame-ancestors 'self'"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "frame-ancestors 'none'"
            )

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking (skip for PDF view to allow iframe embedding)
        if not is_pdf_view:
            response.headers["X-Frame-Options"] = "DENY"

        # Referrer policy
        response.headers["Referrer-Policy"] = "no-referrer"

        # Permissions policy
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS (only in production with HTTPS)
        if not settings.debug:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware."""

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    CSRF_HEADER = "X-CSRF-Token"
    CSRF_COOKIE = "csrf_token"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip CSRF for safe methods
        if request.method in self.SAFE_METHODS:
            response = await call_next(request)
            # Ensure CSRF cookie is set
            if self.CSRF_COOKIE not in request.cookies:
                csrf_token = secrets.token_urlsafe(32)
                response.set_cookie(
                    key=self.CSRF_COOKIE,
                    value=csrf_token,
                    httponly=False,  # JS needs to read it
                    secure=not settings.debug,
                    samesite="lax",
                )
            return response

        # Skip CSRF for API endpoints with session auth (they use cookie)
        # but require the header
        if request.url.path.startswith("/api/") or request.url.path.startswith("/auth/"):
            csrf_cookie = request.cookies.get(self.CSRF_COOKIE)
            csrf_header = request.headers.get(self.CSRF_HEADER)

            # For login, we don't require CSRF yet (no session)
            if request.url.path == "/auth/login":
                response = await call_next(request)
                # Set CSRF cookie on login
                csrf_token = secrets.token_urlsafe(32)
                response.set_cookie(
                    key=self.CSRF_COOKIE,
                    value=csrf_token,
                    httponly=False,
                    secure=not settings.debug,
                    samesite="lax",
                )
                return response

            # Validate CSRF for other state-changing requests
            if csrf_cookie and csrf_header and secrets.compare_digest(csrf_cookie, csrf_header):
                return await call_next(request)

            # CSRF validation failed - but allow for now with warning
            # In production, this should return 403
            if settings.debug:
                return await call_next(request)

            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF validation failed"},
            )

        return await call_next(request)


def get_csrf_token(request: Request) -> str:
    """Get or generate CSRF token for templates."""
    token = request.cookies.get(CSRFMiddleware.CSRF_COOKIE)
    if not token:
        token = secrets.token_urlsafe(32)
    return token
