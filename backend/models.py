from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True)
    email           = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    memory          = Column(String, nullable=True)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    question   = Column(String)
    answer     = Column(String)
    created_at = Column(DateTime, default=datetime.now)


class UserDocument(Base):
    __tablename__ = "user_documents"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"))
    filename    = Column(String)                # original file name
    file_type   = Column(String)                # "pdf" | "image" | "text"
    content     = Column(Text)                  # extracted text
    uploaded_at = Column(DateTime, default=datetime.now)
