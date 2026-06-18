from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware 

from database import engine
from models import Base

from routes.auth_routes   import router as auth_router
from routes.chat_routes   import router as chat_router
from routes.upload_routes import router as upload_router

# ── Create all DB tables ──────────────────────────
Base.metadata.create_all(bind=engine)

# ── App ───────────────────────────────────────────
app = FastAPI(title="Math Tutor API")

# ── CORS ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────
app.include_router(auth_router)    # /register  /login  /me
app.include_router(chat_router)    # /ask
app.include_router(upload_router)  # /upload

# ── Root ──────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "Math Tutor API is running"}
