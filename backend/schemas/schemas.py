from pydantic import BaseModel


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