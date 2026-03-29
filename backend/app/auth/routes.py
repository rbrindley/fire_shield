"""Authentication routes."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from app.models.auth import LoginRequest, UserResponse
from app.auth.service import AuthService
from app.auth.dependencies import get_current_user, get_auth_service
from app.config import get_settings

router = APIRouter()


@router.post("/login")
async def login(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Authenticate user and create session."""
    settings = get_settings()
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    result = await auth_service.authenticate(
        username=login_data.username,
        password=login_data.password,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or account locked",
        )

    session_id, user = result
    # Only use secure cookies in production (HTTPS)
    use_secure = settings.app_env == "production"
    response.set_cookie(
        key="x12_session",
        value=session_id,
        httponly=True,
        secure=use_secure,
        samesite="lax",
        max_age=60 * 60 * 8,  # 8 hours
    )

    return {"message": "Login successful", "user": UserResponse(**user)}


@router.api_route("/logout", methods=["GET", "POST"])
async def logout(
    response: Response,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
):
    """End user session."""
    from fastapi.responses import RedirectResponse
    
    session_id = request.cookies.get("x12_session")
    if session_id:
        await auth_service.logout(session_id)

    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie("x12_session")
    return response


@router.post("/extend-session")
async def extend_session(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
    current_user: dict = Depends(get_current_user),
):
    """Extend the current session."""
    session_id = request.cookies.get("x12_session")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session",
        )

    new_expires = await auth_service.extend_session(session_id)
    if not new_expires:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to extend session",
        )

    return {"message": "Session extended", "expires_at": new_expires.isoformat()}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
):
    """Get current authenticated user info."""
    return UserResponse(**current_user)
