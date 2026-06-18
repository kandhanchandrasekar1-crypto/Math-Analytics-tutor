from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
import fitz           # pymupdf — PDF text extraction
import pytesseract    # OCR for scanned images
from PIL import Image
import io

from models import User, UserDocument
from dependencies.deps import get_db, get_current_user

router = APIRouter()

# ── Allowed file types ────────────────────────────
ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg":      "image",
    "image/jpg":       "image",
    "image/png":       "image",
    "text/plain":      "text",
}

MAX_FILE_SIZE_MB = 10


# ── Extract text helpers ──────────────────────────

def extract_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF. Falls back to OCR for scanned pages."""
    text_parts = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")

    for page_num, page in enumerate(doc):
        text = page.get_text().strip()
        if text:
            text_parts.append(f"[Page {page_num + 1}]\n{text}")
        else:
            # Scanned page — render to image then OCR
            pix  = page.get_pixmap(dpi=200)
            img  = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(img).strip()
            if text:
                text_parts.append(f"[Page {page_num + 1} — scanned]\n{text}")

    doc.close()
    return "\n\n".join(text_parts) or "No readable text found in PDF."


def extract_from_image(file_bytes: bytes) -> str:
    """OCR a JPG or PNG file."""
    img  = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(img).strip()
    return text or "No readable text found in image."


def extract_from_text(file_bytes: bytes) -> str:
    """Decode a plain text file."""
    try:
        return file_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1").strip()


# ── POST /upload — upload one or more files ───────

@router.post("/upload")
async def upload_files(
    files:        List[UploadFile] = File(...),
    db:           Session          = Depends(get_db),
    current_user: User             = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    results = []

    for file in files:
        # Validate type
        content_type = file.content_type or ""
        file_kind    = ALLOWED_TYPES.get(content_type)

        if not file_kind:
            raise HTTPException(
                status_code=415,
                detail=f"'{file.filename}' is not supported. Upload PDF, JPG, PNG, or TXT only."
            )

        # Read bytes
        file_bytes = await file.read()

        # Validate size
        size_mb = len(file_bytes) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"'{file.filename}' is {size_mb:.1f} MB. Max is {MAX_FILE_SIZE_MB} MB."
            )

        # Extract text
        if file_kind == "pdf":
            extracted_text = extract_from_pdf(file_bytes)
        elif file_kind == "image":
            extracted_text = extract_from_image(file_bytes)
        else:
            extracted_text = extract_from_text(file_bytes)

        # Save to DB
        doc = UserDocument(
            user_id   = current_user.id,
            filename  = file.filename,
            file_type = file_kind,
            content   = extracted_text,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        results.append({
            "id":       doc.id,
            "filename": doc.filename,
            "preview":  extracted_text[:200] + "…" if len(extracted_text) > 200 else extracted_text,
            "chars":    len(extracted_text),
        })

    return {"uploaded": results, "count": len(results)}


# ── DELETE /upload/{doc_id} — remove one file ─────

@router.delete("/upload/{doc_id}")
def delete_document(
    doc_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    doc = db.query(UserDocument).filter(
        UserDocument.id      == doc_id,
        UserDocument.user_id == current_user.id,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    db.delete(doc)
    db.commit()
    return {"message": f"'{doc.filename}' removed."}


# ── DELETE /upload — clear all files ─────────────

@router.delete("/upload")
def clear_all_documents(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    db.query(UserDocument).filter(
        UserDocument.user_id == current_user.id
    ).delete()
    db.commit()
    return {"message": "All documents cleared."}


# ── GET /upload — list current files ─────────────

@router.get("/upload")
def list_documents(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    docs = db.query(UserDocument).filter(
        UserDocument.user_id == current_user.id
    ).all()

    return {
        "documents": [
            {
                "id":        d.id,
                "filename":  d.filename,
                "file_type": d.file_type,
                "preview":   d.content[:150] + "…" if len(d.content) > 150 else d.content,
                "chars":     len(d.content),
            }
            for d in docs
        ]
    }
