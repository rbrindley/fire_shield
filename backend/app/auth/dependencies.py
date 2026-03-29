"""Authentication dependencies for FastAPI."""

from fastapi import Depends, HTTPException, Request, status

from app.auth.service import AuthService


async def get_auth_service() -> AuthService:
    """Get authentication service instance."""
    return AuthService()


async def get_current_user(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    """Get current authenticated user from session."""
    session_id = request.cookies.get("x12_session")

    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user = await auth_service.validate_session(session_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    return user


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Require admin privileges."""
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def get_optional_user(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict | None:
    """Get current user if authenticated, otherwise None.
    
    Use this for pages that work with or without authentication,
    like help pages that show different menus for logged-in users.
    """
    session_id = request.cookies.get("x12_session")

    if not session_id:
        return None

    user = await auth_service.validate_session(session_id)
    return user
