-- PDF Signing Application Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'signer',
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table (PDF files - both main and attachments)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50), -- 'main', 'attachment'
    mime_type VARCHAR(100),
    file_size BIGINT,
    page_count INTEGER DEFAULT 1,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Signing workflows
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_by INTEGER REFERENCES users(id),
    current_step INTEGER DEFAULT 0,
    reject_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflow documents (link documents to workflow)
CREATE TABLE IF NOT EXISTS workflow_documents (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    is_main_document BOOLEAN DEFAULT FALSE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Signers in workflow
CREATE TABLE IF NOT EXISTS workflow_signers (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    step_order INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    signed_at TIMESTAMP,
    reject_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Signature positions: lưu vùng ký cho mỗi signer + mỗi document
CREATE TABLE IF NOT EXISTS signature_positions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    signer_id INTEGER REFERENCES workflow_signers(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    page INTEGER NOT NULL,
    position_type VARCHAR(20) DEFAULT 'signature',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lưu trữ file export (chỉ tạo khi cần xuất)
CREATE TABLE IF NOT EXISTS workflow_exports (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Signatures library (stored signature images)
CREATE TABLE IF NOT EXISTS signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    image_path VARCHAR(500) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_signers_workflow_id ON workflow_signers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_signers_user_id ON workflow_signers(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workflow_id ON audit_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- Insert default users for testing
-- Password for all test users is 'password123'
-- Hash: $2b$12$fL.qQgn3j.Ag4ioqb/vScezVetHj2Mihf8dUsXFwf575exEZ/w4Ei
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@example.com', '$2b$12$fL.qQgn3j.Ag4ioqb/vScezVetHj2Mihf8dUsXFwf575exEZ/w4Ei', 'Admin User', 'admin'),
('creator@example.com', '$2b$12$fL.qQgn3j.Ag4ioqb/vScezVetHj2Mihf8dUsXFwf575exEZ/w4Ei', 'Creator User', 'creator'),
('signer1@example.com', '$2b$12$fL.qQgn3j.Ag4ioqb/vScezVetHj2Mihf8dUsXFwf575exEZ/w4Ei', 'Signer One', 'signer'),
('signer2@example.com', '$2b$12$fL.qQgn3j.Ag4ioqb/vScezVetHj2Mihf8dUsXFwf575exEZ/w4Ei', 'Signer Two', 'signer')
ON CONFLICT (email) DO NOTHING;
