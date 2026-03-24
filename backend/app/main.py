"""
PDF Signing Application - Backend Main Application
FastAPI application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.database import engine
from app.api import auth, users, documents, workflows, signatures


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    # Import all models to ensure they are registered
    from app.models import User, Document, Workflow, WorkflowDocument, WorkflowSigner, SignaturePosition, WorkflowExport, AuditLog, Signature
    
    # Create tables if they don't exist
    from app.database import Base
    Base.metadata.create_all(bind=engine)
    
    # Create upload directories
    os.makedirs("/app/uploads", exist_ok=True)
    os.makedirs("/app/uploads/workflows", exist_ok=True)
    os.makedirs("/app/uploads/signatures", exist_ok=True)
    os.makedirs("/app/uploads/documents", exist_ok=True)
    
    yield
    # Shutdown
    pass


app = FastAPI(
    title="PDF Signing API",
    description="API for PDF Document Signing System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(signatures.router, prefix="/api/signatures", tags=["Signatures"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "PDF Signing API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
