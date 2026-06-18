from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from models import User
from auth import hash_password, verify_password, create_access_token
from dependencies.deps import get_db, get_current_user
from schemas.schemas import RegisterRequest

router = APIRouter()


# ── Register ──────────────────────────────────────

@router.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if db.query(User).filter(User.username == request.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username        = request.username,
        email           = request.email,
        hashed_password = hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User registered successfully",
        "user_id": user.id,
    }


# ── Login ─────────────────────────────────────────

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Always include username + email in token
    # Old accounts: just log out and log in once → fixed forever
    access_token = create_access_token({
        "sub":      str(user.id),
        "username": user.username,
        "email":    user.email,
    })

    return {
        "access_token": access_token,
        "token_type":   "bearer",
    }


# ── Me ────────────────────────────────────────────

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns real username and email fetched from DB using user ID.
    Works for old tokens AND new tokens — no re-registration needed.
    Old accounts just need to log out and log in once.
    """
    return {
        "username": current_user.username,
        "email":    current_user.email,
    }
