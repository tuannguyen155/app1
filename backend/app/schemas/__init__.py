"""
Pydantic Schemas for API Requests and Responses
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ============== User Schemas ==============

class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    """User creation schema"""
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    """User update schema"""
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    """User response schema"""
    id: int
    role: str
    avatar_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============== Document Schemas ==============

class DocumentBase(BaseModel):
    """Base document schema"""
    filename: str
    original_filename: str
    file_type: Optional[str] = "attachment"
    mime_type: Optional[str] = None


class DocumentResponse(DocumentBase):
    """Document response schema"""
    id: int
    file_path: str
    file_size: Optional[int] = None
    page_count: Optional[int] = None
    uploaded_by: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentUploadResponse(DocumentResponse):
    """Document upload response with download URL"""
    download_url: Optional[str] = None


# ============== Workflow Schemas ==============

class WorkflowCreate(BaseModel):
    """Workflow creation schema"""
    title: str = Field(..., min_length=1)
    description: Optional[str] = None


class WorkflowUpdate(BaseModel):
    """Workflow update schema"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class WorkflowDocumentSchema(BaseModel):
    """Workflow document with order"""
    document_id: int
    is_main_document: bool = False
    display_order: int = 0
    description: Optional[str] = None


class WorkflowSignerSchema(BaseModel):
    """Workflow signer schema"""
    user_id: int
    step_order: int


class SignaturePositionSchema(BaseModel):
    """Signature position schema - vị trí chữ ký cho mỗi người ký"""
    document_id: int
    x: float
    y: float
    width: float
    height: float
    page: int
    type: str = "signature"  # "signature" (ảnh) hoặc "date" (ngày ký)


class SignaturePositionCreate(BaseModel):
    """Signature position creation schema"""
    signer_id: int
    positions: List[SignaturePositionSchema]


class WorkflowDetailResponse(BaseModel):
    """Workflow detail response with all related data"""
    id: int
    title: str
    description: Optional[str] = None
    status: str
    created_by: Optional[int] = None
    current_step: int
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    documents: List[DocumentResponse] = []
    signers: List["WorkflowSignerResponse"] = []
    
    class Config:
        from_attributes = True


class WorkflowSignerResponse(BaseModel):
    """Workflow signer response"""
    id: int
    user_id: int
    step_order: int
    status: str
    signed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    user: Optional[UserResponse] = None
    signature_positions: List["SignaturePositionResponse"] = []
    
    class Config:
        from_attributes = True


class SignaturePositionResponse(BaseModel):
    """Signature position response"""
    id: int
    document_id: int
    x: float
    y: float
    width: float
    height: float
    page: int
    
    class Config:
        from_attributes = True


class WorkflowResponse(WorkflowCreate):
    """Workflow response schema"""
    id: int
    status: str
    created_by: Optional[int] = None
    current_step: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    """Workflow list response"""
    id: int
    title: str
    description: Optional[str] = None
    status: str
    current_step: int
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserResponse] = None
    signers_count: int = 0
    documents_count: int = 0
    
    class Config:
        from_attributes = True


# ============== Signing Schemas ==============

class SignAction(BaseModel):
    """Sign action schema"""
    workflow_id: int


class RejectAction(BaseModel):
    """Reject action schema"""
    reason: str = Field(..., min_length=1)


class UpdateSignaturePositions(BaseModel):
    """Update signature positions"""
    signer_id: int
    positions: List[SignaturePositionSchema]


# ============== Export Schemas ==============

class ExportRequest(BaseModel):
    """Export request schema"""
    workflow_id: int
    description: Optional[str] = None


class ExportResponse(BaseModel):
    """Export response schema"""
    id: int
    workflow_id: int
    file_path: str
    description: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== Signature Schemas ==============

class SignatureUploadResponse(BaseModel):
    """Signature upload response"""
    id: int
    image_path: str
    is_default: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class SignatureListResponse(SignatureUploadResponse):
    """Signature list response"""
    user_id: int
    
    class Config:
        from_attributes = True


# ============== Audit Log Schemas ==============

class AuditLogResponse(BaseModel):
    """Audit log response"""
    id: int
    workflow_id: int
    user_id: Optional[int] = None
    action: str
    details: Optional[dict] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Update forward references
WorkflowDetailResponse.model_rebuild()
WorkflowSignerResponse.model_rebuild()
