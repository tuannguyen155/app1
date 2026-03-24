"""
SQLAlchemy Models for PDF Signing Application
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, BigInteger, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), default="signer")  # admin, creator, signer
    avatar_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    documents = relationship("Document", back_populates="uploaded_by_user")
    workflows_created = relationship("Workflow", back_populates="creator")
    signatures = relationship("Signature", back_populates="user")
    workflow_signers = relationship("WorkflowSigner", back_populates="user")


class Document(Base):
    """Document model (PDF files)"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))  # main, attachment
    mime_type = Column(String(100))
    file_size = Column(BigInteger)
    page_count = Column(Integer, default=1)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    uploaded_by_user = relationship("User", back_populates="documents")
    workflow_documents = relationship("WorkflowDocument", back_populates="document")
    signature_positions = relationship("SignaturePosition", back_populates="document")


class Workflow(Base):
    """Workflow model"""
    __tablename__ = "workflows"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="draft")  # draft, pending, in_progress, completed, rejected
    created_by = Column(Integer, ForeignKey("users.id"))
    current_step = Column(Integer, default=0)
    reject_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="workflows_created")
    workflow_documents = relationship("WorkflowDocument", back_populates="workflow")
    signers = relationship("WorkflowSigner", back_populates="workflow")
    signature_positions = relationship("SignaturePosition", back_populates="workflow")
    exports = relationship("WorkflowExport", back_populates="workflow")
    audit_logs = relationship("AuditLog", back_populates="workflow")


class WorkflowDocument(Base):
    """Link between workflow and documents"""
    __tablename__ = "workflow_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    display_order = Column(Integer, default=0)
    is_main_document = Column(Boolean, default=False)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="workflow_documents")
    document = relationship("Document", back_populates="workflow_documents")


class WorkflowSigner(Base):
    """Signer in a workflow"""
    __tablename__ = "workflow_signers"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    step_order = Column(Integer, nullable=False)
    status = Column(String(50), default="pending")  # pending, signed, rejected
    signed_at = Column(DateTime(timezone=True))
    reject_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="signers")
    user = relationship("User", back_populates="workflow_signers")
    signature_positions = relationship("SignaturePosition", back_populates="signer")


class SignaturePosition(Base):
    """Signature position for a signer on a document"""
    __tablename__ = "signature_positions"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    signer_id = Column(Integer, ForeignKey("workflow_signers.id", ondelete="CASCADE"))
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    page = Column(Integer, nullable=False)
    position_type = Column(String(20), default="signature")  # "signature" (ảnh chữ ký) hoặc "date" (ngày ký)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="signature_positions")
    signer = relationship("WorkflowSigner", back_populates="signature_positions")
    document = relationship("Document", back_populates="signature_positions")


class WorkflowExport(Base):
    """Export files"""
    __tablename__ = "workflow_exports"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    file_path = Column(String(500), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="exports")


class AuditLog(Base):
    """Audit log for tracking actions"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="audit_logs")


class Signature(Base):
    """User signature images"""
    __tablename__ = "signatures"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    image_path = Column(String(500), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="signatures")
