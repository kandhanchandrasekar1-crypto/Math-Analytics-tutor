
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
    """
    Extract important user facts from messages.
    Returns a memory string or None.
    """

    question = question.strip()

    # Name
    match = re.search(
        r"my name is (.+)",
        question,
        re.IGNORECASE
    )

    if match:
        return f"User's name is {match.group(1).strip()}."

    # Exam preparation
    match = re.search(
        r"i am preparing for (.+)",
        question,
        re.IGNORECASE
    )

    if match:
        return f"Preparing for {match.group(1).strip()}."

    # Education
    match = re.search(
        r"i study in (.+)",
        question,
        re.IGNORECASE
    )

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

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="login"
)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
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
# AUTHENTICATION HELPER
# ==================================================

def get_current_user(
    token: str = Depends(oauth2_scheme)
):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

        return user_id

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


# ==================================================
# ROUTES
# ==================================================

@app.get("/")
def home():
    return {
        "message": "Math Tutor API is running"
    }


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
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(
            request.password
        )
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User registered successfully",
        "user_id": user.id,
    }


# ==================================================
# LOGIN
# ==================================================

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        form_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        {"sub": str(user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ==================================================
# ASK
# ==================================================

@app.post(
    "/ask",
    response_model=AnswerResponse
)
def ask(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(
        get_current_user
    ),
):
    question = request.question.strip()

    # ------------------------------
    # Update User Memory
    # ------------------------------
    new_memory = extract_memory(question)

    if new_memory:
        user = db.query(User).filter(
            User.id == int(current_user)
        ).first()

        existing_memory = user.memory or ""

        # Replace old name
        if new_memory.startswith("User's name is"):
            existing_memory = re.sub(
                r"(User's name is .*?\.|My name is .*?\.)",
                "",
                existing_memory,
                flags=re.IGNORECASE
            )

        # Replace old exam info
        elif new_memory.startswith("Preparing for"):
            existing_memory = re.sub(
                r"Preparing for .*?\.",
                "",
                existing_memory,
                flags=re.IGNORECASE
            )

        # Replace old study info
        elif new_memory.startswith("Studies in"):
            existing_memory = re.sub(
                r"Studies in .*?\.",
                "",
                existing_memory,
                flags=re.IGNORECASE
            )

        existing_memory = existing_memory.strip()

        if existing_memory:
            user.memory = (
                existing_memory +
                "\n" +
                new_memory
            )
        else:
            user.memory = new_memory

        db.commit()

    # ------------------------------
    # Simple arithmetic
    # ------------------------------
    if re.fullmatch(
        r"[0-9+\-*/(). ]+",
        question
    ):
        try:
            result = eval(question)

            chat = ChatHistory(
                user_id=int(current_user),
                question=question,
                answer=str(result),
            )

            db.add(chat)
            db.commit()

            return {
                "answer": str(result)
            }

        except Exception:
            pass

    # ------------------------------
    # Previous conversations
    # ------------------------------
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == int(current_user))
        .order_by(desc(ChatHistory.created_at))
        .limit(5)
        .all()
    )
    # ------------------------------
    # Build Ollama messages
    # ------------------------------
    user = db.query(User).filter(
        User.id == int(current_user)
    ).first()

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful Math Tutor.\n"
                "Use the user's memory when answering.\n\n"
                f"User Memory:\n{user.memory or 'No stored memory.'}"
            )
        }
    ]
    for chat in reversed(history):
        messages.append({
            "role": "user",
            "content": chat.question,
        })

        messages.append({
            "role": "assistant",
            "content": chat.answer,
        })

    messages.append({
        "role": "user",
        "content": question,
    })

    # ------------------------------
    # Ollama Request
    # ------------------------------
    try:
        response = ollama.chat(
            model="llama3.2:3b",
            messages=messages,
        )

    except Exception as e:
        return {
            "answer": f"Error: {str(e)}"
        }

    answer = response[
        "message"
    ]["content"].strip()

    # ------------------------------
    # Save chat
    # ------------------------------
    chat = ChatHistory(
        user_id=int(current_user),
        question=question,
        answer=answer,
    )

    db.add(chat)
    db.commit()

    return {
        "answer": answer
    }
