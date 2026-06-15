from fastapi import FastAPI, Depends
from pydantic import BaseModel
import ollama

from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import engine, SessionLocal
from models import Base, ChatHistory


# Create tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI()


# Request Model
class QuestionRequest(BaseModel):
    question: str


# Response Model
class AnswerResponse(BaseModel):
    answer: str


# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def home():
    return {"message": "Math Tutor API is running"}


@app.post("/ask", response_model=AnswerResponse)
def ask(request: QuestionRequest, db: Session = Depends(get_db)):

    # Get the last 5 conversations
    history = (
        db.query(ChatHistory)
        .order_by(desc(ChatHistory.created_at))
        .limit(5)
        .all()
    )

    # Build messages for Ollama
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful Math Tutor. "
                "You must remember previous conversations "
                "and use them to answer follow-up questions. "
                "If the user tells you their name, remember it."
            )
        }
    ]

    # Add previous conversations (oldest first)
    for chat in reversed(history):
        messages.append({
            "role": "user",
            "content": chat.question
        })

        messages.append({
            "role": "assistant",
            "content": chat.answer
        })

    # Add current question
    messages.append({
        "role": "user",
        "content": request.question
    })

    print("\nMESSAGES SENT TO OLLAMA:")
    for msg in messages:
        print(msg)

    # Send to Ollama
    response = ollama.chat(
        model="deepseek-r1:7b",
        messages=messages
    )

    print("\nOLLAMA RESPONSE:")
    print(response)

    # Extract answer
    answer = response["message"]["content"].strip()

    print("ANSWER:", repr(answer))

    # Save to PostgreSQL
    chat = ChatHistory(
        question=request.question,
        answer=answer
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    print("Saved ID:", chat.id)
    print("Saved Answer:", repr(chat.answer))

    return {
        "answer": answer
    }