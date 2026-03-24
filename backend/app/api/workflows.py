"""
Workflows API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
import uuid
from datetime import datetime

from app.database import get_db
from app.models import User, Workflow, WorkflowDocument, WorkflowSigner, SignaturePosition, Document, WorkflowExport, AuditLog
from app.schemas import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse, WorkflowListResponse,
    WorkflowDetailResponse, WorkflowSignerSchema, WorkflowDocumentSchema,
    SignaturePositionSchema, UpdateSignaturePositions, SignAction, RejectAction,
    ExportRequest, ExportResponse, UserResponse, DocumentResponse, SignaturePositionResponse
)
from app.api.auth import get_current_user
from app.services import pdf_service

router = APIRouter()

UPLOAD_DIR = "/app/uploads"


# ============== Helper Functions ==============

def get_workflow_with_access(workflow_id: int, db: Session, current_user: User):
    """Get workflow and verify access"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Check if user is creator or signer
    is_creator = workflow.created_by == current_user.id
    is_signer = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id,
        WorkflowSigner.user_id == current_user.id
    ).first() is not None
    
    if not is_creator and not is_signer and current_user.role not in ['admin', 'creator']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return workflow


def save_upload_file(upload_file: UploadFile, subfolder: str = "workflows") -> str:
    """Save uploaded file and return path"""
    # Create directory
    upload_path = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(upload_path, exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(upload_file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_path, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    return file_path


def get_pdf_files(workflow_id: int, db: Session) -> List[Document]:
    """Get only PDF documents in workflow"""
    docs = db.query(Document).join(WorkflowDocument).filter(
        WorkflowDocument.workflow_id == workflow_id,
        Document.mime_type == "application/pdf"
    ).all()
    return docs


# ============== Workflow CRUD ==============

@router.get("", response_model=List[WorkflowListResponse])
def list_workflows(
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all workflows (created by or assigned to current user)"""
    query = db.query(Workflow).filter(
        (Workflow.created_by == current_user.id) |
        (Workflow.signers.any(WorkflowSigner.user_id == current_user.id))
    )
    
    if status_filter:
        query = query.filter(Workflow.status == status_filter)
    
    workflows = query.order_by(Workflow.created_at.desc()).all()
    
    result = []
    for wf in workflows:
        signers_count = db.query(WorkflowSigner).filter(
            WorkflowSigner.workflow_id == wf.id
        ).count()
        docs_count = db.query(WorkflowDocument).filter(
            WorkflowDocument.workflow_id == wf.id
        ).count()
        
        creator = db.query(User).filter(User.id == wf.created_by).first() if wf.created_by else None
        
        result.append(WorkflowListResponse(
            id=wf.id,
            title=wf.title,
            description=wf.description,
            status=wf.status,
            current_step=wf.current_step,
            created_at=wf.created_at,
            updated_at=wf.updated_at,
            creator=creator,
            signers_count=signers_count,
            documents_count=docs_count
        ))
    
    return result


@router.post("", response_model=WorkflowDetailResponse)
def create_workflow(
    workflow_data: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow"""
    workflow = Workflow(
        title=workflow_data.title,
        description=workflow_data.description,
        created_by=current_user.id,
        status="draft"
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow.id,
        user_id=current_user.id,
        action="workflow_created",
        details={"title": workflow.title}
    )
    db.add(audit)
    db.commit()
    
    return get_workflow_detail(workflow.id, db)


@router.get("/{workflow_id}", response_model=WorkflowDetailResponse)
def get_workflow_detail(workflow_id: int, db: Session = Depends(get_db)):
    """Get workflow detail with all related data"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return get_workflow_detail(workflow_id, db)


def get_workflow_detail(workflow_id: int, db: Session):
    """Helper to get workflow detail"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    # Get documents
    wf_docs = db.query(WorkflowDocument).filter(
        WorkflowDocument.workflow_id == workflow_id
    ).order_by(WorkflowDocument.display_order).all()
    
    documents = []
    for wf_doc in wf_docs:
        doc = db.query(Document).filter(Document.id == wf_doc.document_id).first()
        if doc:
            documents.append(doc)
    
    # Get signers with user info and signature positions
    signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id
    ).order_by(WorkflowSigner.step_order).all()
    
    signer_responses = []
    for signer in signers:
        user = db.query(User).filter(User.id == signer.user_id).first()
        
        # Get signature positions for this signer
        positions = db.query(SignaturePosition).filter(
            SignaturePosition.signer_id == signer.id
        ).all()
        
        signer_responses.append({
            "id": signer.id,
            "user_id": signer.user_id,
            "step_order": signer.step_order,
            "status": signer.status,
            "signed_at": signer.signed_at,
            "reject_reason": signer.reject_reason,
            "user": user,
            "signature_positions": positions
        })
    
    creator = db.query(User).filter(User.id == workflow.created_by).first() if workflow.created_by else None
    
    return WorkflowDetailResponse(
        id=workflow.id,
        title=workflow.title,
        description=workflow.description,
        status=workflow.status,
        created_by=workflow.created_by,
        current_step=workflow.current_step,
        reject_reason=workflow.reject_reason,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        documents=documents,
        signers=signer_responses,
        creator=creator
    )


@router.put("/{workflow_id}", response_model=WorkflowDetailResponse)
def update_workflow(
    workflow_id: int,
    workflow_data: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    if workflow_data.title:
        workflow.title = workflow_data.title
    if workflow_data.description is not None:
        workflow.description = workflow_data.description
    if workflow_data.status:
        workflow.status = workflow_data.status
    
    db.commit()
    db.refresh(workflow)
    
    return get_workflow_detail(workflow_id, db)


@router.delete("/{workflow_id}")
def delete_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    db.delete(workflow)
    db.commit()
    
    return {"message": "Workflow deleted"}


# ============== Workflow Documents ==============

@router.post("/{workflow_id}/documents", response_model=DocumentResponse)
def add_document(
    workflow_id: int,
    file: UploadFile = File(...),
    is_main: bool = False,
    description: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add document to workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    # Check if workflow is still in draft status
    if workflow.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot add documents to active workflow")
    
    # Save file
    file_path = save_upload_file(file, f"workflows/{workflow_id}")
    
    # Get page count for PDF
    page_count = 1
    mime_type = file.content_type
    
    if mime_type == "application/pdf":
        try:
            page_count = pdf_service.get_pdf_page_count(file_path)
        except:
            pass
    
    # Create document
    document = Document(
        filename=os.path.basename(file_path),
        original_filename=file.filename,
        file_path=file_path,
        file_type="main" if is_main else "attachment",
        mime_type=mime_type,
        file_size=os.path.getsize(file_path),
        page_count=page_count,
        uploaded_by=current_user.id
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Link to workflow
    max_order = db.query(WorkflowDocument).filter(
        WorkflowDocument.workflow_id == workflow_id
    ).count()
    
    wf_doc = WorkflowDocument(
        workflow_id=workflow_id,
        document_id=document.id,
        is_main_document=is_main,
        display_order=max_order,
        description=description
    )
    db.add(wf_doc)
    db.commit()
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="document_added",
        details={"document_id": document.id, "filename": file.filename}
    )
    db.add(audit)
    db.commit()
    
    return document


@router.get("/{workflow_id}/documents", response_model=List[DocumentResponse])
def list_workflow_documents(
    workflow_id: int,
    pdf_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List documents in workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    query = db.query(Document).join(WorkflowDocument).filter(
        WorkflowDocument.workflow_id == workflow_id
    ).order_by(WorkflowDocument.display_order)
    
    if pdf_only:
        query = query.filter(Document.mime_type == "application/pdf")
    
    documents = query.all()
    return documents


# ============== Workflow Signers ==============

@router.post("/{workflow_id}/signers", response_model=dict)
def add_signer(
    workflow_id: int,
    signer_data: WorkflowSignerSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add signer to workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    # Check if workflow is still in draft status
    if workflow.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot add signers to active workflow")
    
    # Check if user exists
    user = db.query(User).filter(User.id == signer_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if step order already exists
    existing = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id,
        WorkflowSigner.step_order == signer_data.step_order
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Step order already exists")
    
    # Create signer
    signer = WorkflowSigner(
        workflow_id=workflow_id,
        user_id=signer_data.user_id,
        step_order=signer_data.step_order
    )
    db.add(signer)
    db.commit()
    db.refresh(signer)
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="signer_added",
        details={"signer_id": signer.id, "user_id": user.id, "step_order": signer.step_order}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Signer added", "signer_id": signer.id}


@router.get("/{workflow_id}/signers", response_model=List[dict])
def list_signers(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List signers in workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id
    ).order_by(WorkflowSigner.step_order).all()
    
    result = []
    for signer in signers:
        user = db.query(User).filter(User.id == signer.user_id).first()
        result.append({
            "id": signer.id,
            "user_id": signer.user_id,
            "step_order": signer.step_order,
            "status": signer.status,
            "signed_at": signer.signed_at,
            "reject_reason": signer.reject_reason,
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name} if user else None
        })
    
    return result


@router.delete("/{workflow_id}/signers/{signer_id}")
def remove_signer(
    workflow_id: int,
    signer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove signer from workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    # Check if workflow is still in draft status
    if workflow.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot remove signers from active workflow")
    
    signer = db.query(WorkflowSigner).filter(
        WorkflowSigner.id == signer_id,
        WorkflowSigner.workflow_id == workflow_id
    ).first()
    
    if not signer:
        raise HTTPException(status_code=404, detail="Signer not found")
    
    db.delete(signer)
    db.commit()
    
    return {"message": "Signer removed"}


# ============== Signature Positions ==============

@router.post("/{workflow_id}/signature-positions")
def set_signature_positions(
    workflow_id: int,
    positions_data: List[SignaturePositionSchema],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Set signature positions cho các document trong workflow
    - Mỗi signer cần có 2 vị trí cho mỗi document:
      - 1 vị trí type="signature" cho ảnh chữ ký
      - 1 vị trí type="date" cho text ngày ký
    """
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    # Check if workflow is still in draft status
    if workflow.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot modify signature positions of active workflow")
    
    # Get all signers
    signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id
    ).all()
    
    signer_map = {s.user_id: s.id for s in signers}
    
    # Get PDF documents
    pdf_docs = get_pdf_files(workflow_id, db)
    doc_map = {d.id: d for d in pdf_docs}
    
    # Clear existing positions
    db.query(SignaturePosition).filter(
        SignaturePosition.workflow_id == workflow_id
    ).delete()
    
    # Add new positions
    for pos_data in positions_data:
        if pos_data.document_id not in doc_map:
            continue  # Skip non-PDF documents
        
        # Find signer by user_id from the request
        # The frontend will send signer_id in a different format
        # For now, we'll need signer_id from the request
    
    # Since we need to know which signer, let's update the schema
    # For now, return a message to use the updated endpoint
    
    return {"message": "Please include signer_id in the request"}


@router.post("/{workflow_id}/signers/{signer_id}/signature-positions")
def set_signer_signature_positions(
    workflow_id: int,
    signer_id: int,
    positions_data: List[SignaturePositionSchema],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Set signature positions cho một signer cụ thể
    - Mỗi document cần 2 vị trí:
      - type="signature": vị trí chèn ảnh chữ ký
      - type="date": vị trí chèn text ngày ký
    """
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    # Check if workflow is still in draft status
    if workflow.status != "draft":
        raise HTTPException(status_code=400, detail="Cannot modify signature positions of active workflow")
    
    # Verify signer exists
    signer = db.query(WorkflowSigner).filter(
        WorkflowSigner.id == signer_id,
        WorkflowSigner.workflow_id == workflow_id
    ).first()
    
    if not signer:
        raise HTTPException(status_code=404, detail="Signer not found")
    
    # Get PDF documents
    pdf_docs = get_pdf_files(workflow_id, db)
    doc_map = {d.id: d for d in pdf_docs}
    
    # Clear existing positions for this signer
    db.query(SignaturePosition).filter(
        SignaturePosition.signer_id == signer_id
    ).delete()
    
    # Add new positions
    added_positions = 0
    for pos_data in positions_data:
        if pos_data.document_id not in doc_map:
            continue  # Skip non-PDF documents
        
        position = SignaturePosition(
            workflow_id=workflow_id,
            signer_id=signer_id,
            document_id=pos_data.document_id,
            x=pos_data.x,
            y=pos_data.y,
            width=pos_data.width,
            height=pos_data.height,
            page=pos_data.page,
            position_type=pos_data.type
        )
        db.add(position)
        added_positions += 1
    
    db.commit()
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="signature_positions_set",
        details={"signer_id": signer_id, "positions_count": added_positions}
    )
    db.add(audit)
    db.commit()
    
    return {"message": f"Added {added_positions} signature positions"}


@router.get("/{workflow_id}/signature-positions", response_model=List[dict])
def get_signature_positions(
    workflow_id: int,
    signer_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get signature positions for workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    query = db.query(SignaturePosition).filter(
        SignaturePosition.workflow_id == workflow_id
    )
    
    if signer_id:
        query = query.filter(SignaturePosition.signer_id == signer_id)
    
    positions = query.all()
    
    result = []
    for pos in positions:
        result.append({
            "id": pos.id,
            "signer_id": pos.signer_id,
            "document_id": pos.document_id,
            "x": pos.x,
            "y": pos.y,
            "width": pos.width,
            "height": pos.height,
            "page": pos.page,
            "type": pos.position_type
        })
    
    return result


# ============== Send Workflow ==============

@router.post("/{workflow_id}/send")
def send_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send workflow to first signer"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    if workflow.status != "draft":
        raise HTTPException(status_code=400, detail="Workflow already sent")
    
    # Check if there are signers
    signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id
    ).order_by(WorkflowSigner.step_order).all()
    
    if not signers:
        raise HTTPException(status_code=400, detail="No signers added")
    
    # Check if there are documents
    docs = db.query(WorkflowDocument).filter(
        WorkflowDocument.workflow_id == workflow_id
    ).count()
    
    if docs == 0:
        raise HTTPException(status_code=400, detail="No documents added")
    
    # Update workflow status
    workflow.status = "pending"
    workflow.current_step = 1
    
    # Update first signer status
    signers[0].status = "pending"
    
    db.commit()
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="workflow_sent",
        details={"first_signer_id": signers[0].id}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Workflow sent to first signer", "status": workflow.status}


# ============== Recall/Withdraw Workflow ==============

@router.post("/{workflow_id}/recall")
def recall_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recall/withdraw workflow back to draft - only creator can recall"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Only creator can recall
    if workflow.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator can recall workflow")
    
    # Can only recall pending or in_progress workflows
    if workflow.status not in ["pending", "in_progress"]:
        raise HTTPException(status_code=400, detail="Can only recall pending or in-progress workflows")
    
    # Check if anyone has already signed
    signed_count = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id,
        WorkflowSigner.status == "signed"
    ).count()
    
    if signed_count > 0:
        raise HTTPException(status_code=400, detail="Cannot recall workflow - someone has already signed")
    
    # Reset workflow to draft
    workflow.status = "draft"
    workflow.current_step = 0
    
    # Reset all signers to pending
    signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id
    ).all()
    
    for signer in signers:
        signer.status = "pending"
        signer.signed_at = None
        signer.reject_reason = None
    
    db.commit()
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="workflow_recalled",
        details={"previous_status": "pending" if workflow.status == "pending" else "in_progress"}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Workflow recalled successfully", "status": workflow.status}


# ============== Sign / Reject Actions ==============

@router.post("/{workflow_id}/sign")
def sign_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sign workflow (current signer signs)"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get current signer
    signer = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id,
        WorkflowSigner.user_id == current_user.id
    ).first()
    
    if not signer:
        raise HTTPException(status_code=403, detail="You are not a signer in this workflow")
    
    if signer.status != "pending":
        raise HTTPException(status_code=400, detail="You have already signed or rejected this workflow")
    
    # Check if it's this signer's turn
    if workflow.current_step != signer.step_order:
        raise HTTPException(status_code=400, detail="It's not your turn to sign")
    
    # Update signer status
    signer.status = "signed"
    signer.signed_at = datetime.utcnow()
    
    # Check if all signers have signed
    all_signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id
    ).all()
    
    signed_count = sum(1 for s in all_signers if s.status == "signed")
    
    if signed_count == len(all_signers):
        # All signed - workflow completed
        workflow.status = "completed"
    else:
        # Move to next signer
        next_signer = db.query(WorkflowSigner).filter(
            WorkflowSigner.workflow_id == workflow_id,
            WorkflowSigner.step_order == workflow.current_step + 1
        ).first()
        
        if next_signer:
            next_signer.status = "pending"
            workflow.current_step += 1
    
    db.commit()
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="workflow_signed",
        details={"signer_id": signer.id}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Signed successfully", "status": workflow.status}


@router.post("/{workflow_id}/reject")
def reject_workflow(
    action: RejectAction,
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject workflow"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get current signer
    signer = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id,
        WorkflowSigner.user_id == current_user.id
    ).first()
    
    if not signer:
        raise HTTPException(status_code=403, detail="You are not a signer in this workflow")
    
    if signer.status != "pending":
        raise HTTPException(status_code=400, detail="You have already signed or rejected")
    
    # Update signer and workflow status
    signer.status = "rejected"
    signer.reject_reason = action.reason
    workflow.status = "rejected"
    workflow.reject_reason = action.reason
    
    db.commit()
    
    # Create audit log
    audit = AuditLog(
        workflow_id=workflow_id,
        user_id=current_user.id,
        action="workflow_rejected",
        details={"signer_id": signer.id, "reason": action.reason}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Workflow rejected", "reason": action.reason}


# ============== Export ==============

@router.post("/{workflow_id}/export")
def export_workflow(
    workflow_id: int,
    export_data: ExportRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export workflow - Gộp file và thêm chữ ký
    Chỉ chạy khi cần xuất file cuối cùng
    """
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    # Check if workflow is completed
    if workflow.status not in ["completed", "pending"]:
        raise HTTPException(status_code=400, detail="Workflow must be signed before export")
    
    # Get all PDF documents
    pdf_docs = get_pdf_files(workflow_id, db)
    
    if not pdf_docs:
        raise HTTPException(status_code=400, detail="No PDF documents to export")
    
    # Get signers who have signed
    signers = db.query(WorkflowSigner).filter(
        WorkflowSigner.workflow_id == workflow_id,
        WorkflowSigner.status == "signed"
    ).order_by(WorkflowSigner.step_order).all()
    
    # Get signature positions for all signers
    all_positions = db.query(SignaturePosition).filter(
        SignaturePosition.workflow_id == workflow_id
    ).all()
    
    # Group positions by document and signer
    positions_by_signer_doc = {}
    for pos in all_positions:
        key = (pos.signer_id, pos.document_id)
        if key not in positions_by_signer_doc:
            positions_by_signer_doc[key] = []
        positions_by_signer_doc[key].append(pos)
    
    # Get user's signature images
    # For simplicity, we'll create a default signature
    
    # Create export
    export_dir = os.path.join(UPLOAD_DIR, "workflows", str(workflow_id), "exports")
    os.makedirs(export_dir, exist_ok=True)
    
    output_filename = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    output_path = os.path.join(export_dir, output_filename)
    
    try:
        # Merge PDFs and add signatures
        pdf_service.merge_and_sign_pdfs(
            pdf_docs=pdf_docs,
            output_path=output_path,
            signers=signers,
            positions_by_signer_doc=positions_by_signer_doc
        )
        
        # Create export record
        export = WorkflowExport(
            workflow_id=workflow_id,
            file_path=output_path,
            description=export_data.description if export_data else "Exported PDF",
            created_by=current_user.id
        )
        db.add(export)
        
        # Create audit log
        audit = AuditLog(
            workflow_id=workflow_id,
            user_id=current_user.id,
            action="workflow_exported",
            details={"export_id": export.id}
        )
        db.add(audit)
        db.commit()
        
        return {
            "message": "Export successful",
            "export_id": export.id,
            "download_url": f"/api/workflows/{workflow_id}/export/{export.id}/download"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{workflow_id}/export/{export_id}/download")
def download_export(
    workflow_id: int,
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download exported file"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    export = db.query(WorkflowExport).filter(
        WorkflowExport.id == export_id,
        WorkflowExport.workflow_id == workflow_id
    ).first()
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    return FileResponse(
        export.file_path,
        filename=f"{workflow.title}_signed.pdf",
        media_type="application/pdf"
    )


@router.get("/{workflow_id}/exports", response_model=List[ExportResponse])
def list_exports(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List exports for workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)
    
    exports = db.query(WorkflowExport).filter(
        WorkflowExport.workflow_id == workflow_id
    ).order_by(WorkflowExport.created_at.desc()).all()
    
    return exports


# ============== Audit Logs ==============

@router.get("/{workflow_id}/audit-logs")
def get_audit_logs(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit logs for workflow"""
    workflow = get_workflow_with_access(workflow_id, db, current_user)

    logs = db.query(AuditLog).filter(
        AuditLog.workflow_id == workflow_id
    ).order_by(AuditLog.created_at.desc()).all()

    return [{
        "id": log.id,
        "user_id": log.user_id,
        "action": log.action,
        "details": log.details,
        "created_at": log.created_at.isoformat() if log.created_at else None
    } for log in logs]
