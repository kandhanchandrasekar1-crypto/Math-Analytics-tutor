from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt
from jose.exceptions import JWTError

from database import SessionLocal
from models import User
from auth import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ── Database session ──────────────────────────────

def get_db():
    """Yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth: user ID from token ──────────────────────

def get_current_user_id(
    token: str = Depends(oauth2_scheme),
) -> int:

    print("Received Token:", token)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print("Decoded Payload:", payload)

        user_id = payload.get("sub")
        print("User ID:", user_id)

        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        return int(user_id)

    except Exception as e:
        print("JWT ERROR:", str(e))
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ── Auth: full User object ────────────────────────

def get_current_user(
    user_id: int     = Depends(get_current_user_id),
    db:      Session = Depends(get_db),
) -> User:
    """
    Returns the full User row from the database.
    Always fetches from DB using user ID — so works for ALL accounts
    including old ones that only have sub in their token.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
