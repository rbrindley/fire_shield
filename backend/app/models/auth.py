"""Pydantic models for authentication."""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Login request payload."""

    username: str
    password: str


class UserCreate(BaseModel):
    """User creation payload."""

    username: str
    email: EmailStr
    password: str
    is_admin: bool = False


class UserResponse(BaseModel):
    """User response model."""

    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    created_at: str | None = None


class SessionInfo(BaseModel):
    """Session information."""

    session_id: str
    user_id: int
    username: str
    is_admin: bool
    expires_at: str
