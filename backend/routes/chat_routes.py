from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
import ollama
import re

from models import User, ChatHistory, UserDocument
from dependencies.deps import get_db, get_current_user
from schemas.schemas import QuestionRequest, AnswerResponse
from utils.memory import extract_memory

router = APIRouter()


@router.post("/ask", response_model=AnswerResponse)
def ask(
    request:      QuestionRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    question = request.question.strip()

    # ── Update User Memory ────────────────────────
    new_memory = extract_memory(question)
    if new_memory:
        existing = current_user.memory or ""

        if new_memory.startswith("User's name is"):
            existing = re.sub(
                r"(User's name is .*?\.|My name is .*?\.)",
                "", existing, flags=re.IGNORECASE,
            )
        elif new_memory.startswith("Preparing for"):
            existing = re.sub(
                r"Preparing for .*?\.", "", existing, flags=re.IGNORECASE,
            )
        elif new_memory.startswith("Studies in"):
            existing = re.sub(
                r"Studies in .*?\.", "", existing, flags=re.IGNORECASE,
            )

        existing             = existing.strip()
        current_user.memory  = (existing + "\n" + new_memory).strip() if existing else new_memory
        db.commit()

    # ── Simple arithmetic ─────────────────────────
    if re.fullmatch(r"[0-9+\-*/(). ]+", question):
        try:
            result = eval(question)
            db.add(ChatHistory(
                user_id=current_user.id,
                question=question,
                answer=str(result),
            ))
            db.commit()
            return {"answer": str(result)}
        except Exception:
            pass

    # ── Fetch uploaded documents ──────────────────
    docs = (
        db.query(UserDocument)
        .filter(UserDocument.user_id == current_user.id)
        .order_by(desc(UserDocument.uploaded_at))
        .all()
    )

    # ── Build document context string ────────────
    doc_context = ""
    if docs:
        doc_parts = []
        for d in docs:
            doc_parts.append(
                f"--- Document: {d.filename} ---\n{d.content}\n--- End of {d.filename} ---"
            )
        doc_context = (
            "\n\n"
            "=============================================\n"
            "UPLOADED DOCUMENTS (use these to answer):\n"
            "=============================================\n"
            + "\n\n".join(doc_parts)
            + "\n============================================="
        )

    # ── Last 5 conversations for context ──────────
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(desc(ChatHistory.created_at))
        .limit(5)
        .all()
    )

    # ── Build Ollama messages ─────────────────────
    has_docs = bool(docs)

    system_prompt = (
        f"You are a helpful Math Tutor.\n"
        f"The student's name is {current_user.username}.\n"
        f"Use the user's memory when answering.\n\n"
        f"User Memory:\n{current_user.memory or 'No stored memory.'}"
        + (
            f"\n\nIMPORTANT: The student has uploaded {len(docs)} document(s). "
            f"When asked to analyse, summarise, or answer questions about their files, "
            f"you MUST read and use the document content provided below. "
            f"Do NOT say you have not received anything."
            f"{doc_context}"
            if has_docs else ""
        )
    )

    messages = [{"role": "system", "content": system_prompt}]

    for chat in reversed(history):
        messages.append({"role": "user",      "content": chat.question})
        messages.append({"role": "assistant", "content": chat.answer})

    # ── If user sent a vague "check"/"analyse" with no detail, remind the model ──
    vague_triggers = {"check", "now check", "analyse", "analyze", "what is this", "analysis this"}
    if question.lower().strip() in vague_triggers and has_docs:
        injected_question = (
            f"{question}\n\n"
            f"(Reminder: the student has uploaded {len(docs)} file(s). "
            f"Please analyse and summarise the content of those documents.)"
        )
    else:
        injected_question = question

    messages.append({"role": "user", "content": injected_question})

    # ── Ollama Request ────────────────────────────
    try:
        response = ollama.chat(model="llama3.2:3b", messages=messages)
    except Exception as e:
        return {"answer": f"Error connecting to Ollama: {str(e)}"}

    answer = response["message"]["content"].strip()

    # ── Save to DB ────────────────────────────────
    db.add(ChatHistory(
        user_id=current_user.id,
        question=question,
        answer=answer,
    ))
    db.commit()

    return {"answer": answer}
