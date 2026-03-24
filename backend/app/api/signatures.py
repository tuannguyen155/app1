"""
Signatures API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
import uuid

from app.database import get_db
from app.models import User, Signature
from app.schemas import SignatureUploadResponse, SignatureListResponse
from app.api.auth import get_current_user

router = APIRouter()

UPLOAD_DIR = "/app/uploads/signatures"


@router.get("", response_model=List[SignatureListResponse])
def list_signatures(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all signatures for current user"""
    signatures = db.query(Signature).filter(
        Signature.user_id == current_user.id
    ).all()
    
    return signatures


@router.post("/upload", response_model=SignatureUploadResponse)
def upload_signature(
    file: UploadFile = File(...),
    is_default: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a signature image"""
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PNG and JPEG images are allowed"
        )
    
    # Create upload directory
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # If setting as default, unset other defaults
    if is_default:
        db.query(Signature).filter(
            Signature.user_id == current_user.id,
            Signature.is_default == True
        ).update({"is_default": False})
    
    # Create signature
    signature = Signature(
        user_id=current_user.id,
        image_path=file_path,
        is_default=is_default
    )
    db.add(signature)
    db.commit()
    db.refresh(signature)
    
    return signature


@router.delete("/{signature_id}")
def delete_signature(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a signature"""
    signature = db.query(Signature).filter(
        Signature.id == signature_id,
        Signature.user_id == current_user.id
    ).first()
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Delete file
    if os.path.exists(signature.image_path):
        os.remove(signature.image_path)
    
    # Delete from database
    db.delete(signature)
    db.commit()
    
    return {"message": "Signature deleted"}


@router.put("/{signature_id}/set-default")
def set_default_signature(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set a signature as default"""
    signature = db.query(Signature).filter(
        Signature.id == signature_id,
        Signature.user_id == current_user.id
    ).first()
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Unset other defaults
    db.query(Signature).filter(
        Signature.user_id == current_user.id,
        Signature.is_default == True
    ).update({"is_default": False})
    
    # Set this as default
    signature.is_default = True
    db.commit()
    
    return {"message": "Default signature set"}


@router.get("/{signature_id}/image")
def get_signature_image(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get signature image"""
    signature = db.query(Signature).filter(
        Signature.id == signature_id,
        Signature.user_id == current_user.id
    ).first()
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    if not os.path.exists(signature.image_path):
        raise HTTPException(status_code=404, detail="Signature file not found")
    
    return FileResponse(
        signature.image_path,
        media_type="image/png"
    )
