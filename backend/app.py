from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import (
    OAuth2PasswordBearer,
    OAuth2PasswordRequestForm,
)

from pydantic import BaseModel

from sqlalchemy.orm import Session
from sqlalchemy import desc

from jose import jwt
from jose.exceptions import JWTError

import ollama
import re

from database import engine, SessionLocal
from models import Base, ChatHistory, User

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
)

# ==================================================
# DATABASE SETUP
# ==================================================

def extract_memory(question: str):
    question = question.strip()

    match = re.search(r"my name is (.+)", question, re.IGNORECASE)
    if match:
        return f"User's name is {match.group(1).strip()}."

    match = re.search(r"i am preparing for (.+)", question, re.IGNORECASE)
    if match:
        return f"Preparing for {match.group(1).strip()}."

    match = re.search(r"i study in (.+)", question, re.IGNORECASE)
    if match:
        return f"Studies in {match.group(1).strip()}."

    return None

Base.metadata.create_all(bind=engine)

# ==================================================
# FASTAPI APP
# ==================================================

app = FastAPI()

# ==================================================
# SECURITY
# ==================================================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# PYDANTIC SCHEMAS
# ==================================================

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    answer: str

# ==================================================
# DATABASE DEPENDENCY
# ==================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================================================
# AUTHENTICATION HELPERS
# ==================================================

def get_current_user_id(
    token: str = Depends(oauth2_scheme)
) -> int:
    """Returns the logged-in user's ID as int."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
) -> User:
    """Returns the full User object for the logged-in user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ==================================================
# ROUTES
# ==================================================

@app.get("/")
def home():
    return {"message": "Math Tutor API is running"}

# ==================================================
# REGISTER
# ==================================================

@app.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == request.email
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(request.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User registered successfully",
        "user_id": user.id,
    }

# ==================================================
# LOGIN  — now includes username + email in token
# ==================================================

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # ✅ Include username + email in the token
    # so the frontend can read them without calling /me
    access_token = create_access_token({
        "sub":      str(user.id),
        "username": user.username,
        "email":    user.email,
    })

    return {
        "access_token": access_token,
        "token_type":   "bearer",
    }

# ==================================================
# ME — returns logged-in user details
# ==================================================

@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the real username and email from the database.
    Frontend calls this on load to display the user's name.
    """
    return {
        "username": current_user.username,
        "email":    current_user.email,
    }

# ==================================================
# ASK
# ==================================================

@app.post("/ask", response_model=AnswerResponse)
def ask(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # ✅ full User object now
):
    question = request.question.strip()

    # ── Update User Memory ──
    new_memory = extract_memory(question)

    if new_memory:
        existing_memory = current_user.memory or ""

        if new_memory.startswith("User's name is"):
            existing_memory = re.sub(
                r"(User's name is .*?\.|My name is .*?\.)",
                "", existing_memory, flags=re.IGNORECASE
            )
        elif new_memory.startswith("Preparing for"):
            existing_memory = re.sub(
                r"Preparing for .*?\.", "", existing_memory, flags=re.IGNORECASE
            )
        elif new_memory.startswith("Studies in"):
            existing_memory = re.sub(
                r"Studies in .*?\.", "", existing_memory, flags=re.IGNORECASE
            )

        existing_memory = existing_memory.strip()
        current_user.memory = (existing_memory + "\n" + new_memory).strip() if existing_memory else new_memory
        db.commit()

    # ── Simple arithmetic ──
    if re.fullmatch(r"[0-9+\-*/(). ]+", question):
        try:
            result = eval(question)
            chat = ChatHistory(
                user_id=current_user.id,
                question=question,
                answer=str(result),
            )
            db.add(chat)
            db.commit()
            return {"answer": str(result)}
        except Exception:
            pass

    # ── Previous conversations ──
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(desc(ChatHistory.created_at))
        .limit(5)
        .all()
    )

    # ── Build Ollama messages ──
    messages = [
        {
            "role": "system",
            "content": (
                f"You are a helpful Math Tutor.\n"
                f"The student's name is {current_user.username}.\n"
                f"Use the user's memory when answering.\n\n"
                f"User Memory:\n{current_user.memory or 'No stored memory.'}"
            )
        }
    ]

    for chat in reversed(history):
        messages.append({"role": "user",      "content": chat.question})
        messages.append({"role": "assistant", "content": chat.answer})

    messages.append({"role": "user", "content": question})

    # ── Ollama Request ──
    try:
        response = ollama.chat(model="llama3.2:3b", messages=messages)
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

    answer = response["message"]["content"].strip()

    # ── Save chat to DB ──
    chat = ChatHistory(
        user_id=current_user.id,
        question=question,
        answer=answer,
    )
    db.add(chat)
    db.commit()

    return {"answer": answer}
