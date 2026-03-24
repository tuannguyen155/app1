import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { workflowsApi } from '../services/api';
import { FiArrowLeft, FiFile, FiCheck, FiX, FiEye } from 'react-icons/fi';

function WorkflowSigningPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'sign'
  
  const { data: workflow, isLoading, refetch } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowsApi.get(id).then(res => res.data),
  });
  
  const signMutation = useMutation({
    mutationFn: () => workflowsApi.sign(id),
    onSuccess: () => {
      refetch();
      alert('Ký thành công!');
    }
  });
  
  const rejectMutation = useMutation({
    mutationFn: (reason) => workflowsApi.reject(id, reason),
    onSuccess: () => {
      refetch();
      alert('Đã từ chối workflow');
    }
  });
  
  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!workflow) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Workflow không tồn tại</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Quay lại
        </button>
      </div>
    );
  }
  
  // Check if workflow is ready for signing
  const isPendingForUser = workflow.status === 'pending' || workflow.status === 'in_progress';
  const canSign = isPendingForUser && workflow.current_step <= (workflow.signers?.length || 0);
  
  return (
    <div>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="header-title">{workflow.title}</h1>
            <p style={{ color: '#64748b' }}>
              Vui lòng xem nội dung trước khi ký
            </p>
          </div>
        </div>
      </div>
      
      {/* Workflow Progress */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '16px' }}>Tiến trình ký</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {workflow.signers?.map((signer, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: signer.status === 'signed' ? '#d1fae5' : 
                           signer.status === 'rejected' ? '#fee2e2' : 
                           index + 1 === workflow.current_step ? '#dbeafe' : '#f8fafc'
              }}
            >
              <span className="badge badge-draft">{index + 1}</span>
              <span>{signer.user?.full_name || signer.user?.email}</span>
              {signer.status === 'signed' && <span>✅</span>}
              {signer.status === 'rejected' && <span>❌</span>}
            </div>
          ))}
        </div>
      </div>
      
      {/* Documents */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '16px' }}>
          <FiFile style={{ marginRight: '8px' }} />
          Tài liệu cần ký
        </h2>
        
        {workflow.documents?.map((doc, index) => (
          <div
            key={index}
            style={{
              padding: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>{doc.original_filename || doc.filename}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {doc.file_type === 'main' ? 'File chính' : 'File đính kèm'}
                {doc.mime_type === 'application/pdf' && <span className="badge badge-draft" style={{ marginLeft: '8px' }}>PDF</span>}
                {doc.mime_type !== 'application/pdf' && <span className="badge badge-draft" style={{ marginLeft: '8px' }}>Không ký</span>}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm">
              <FiEye style={{ marginRight: '4px' }} />
              Xem
            </button>
          </div>
        ))}
      </div>
      
      {/* Signer Actions */}
      {canSign && (
        <div className="card" style={{ border: '2px solid #2563eb', background: '#eff6ff' }}>
          <h2 className="card-title" style={{ marginBottom: '16px', color: '#2563eb' }}>
            Xác nhận ký
          </h2>
          <p style={{ marginBottom: '16px', color: '#1e40af' }}>
            Sau khi xem nội dung tài liệu, bạn có thể xác nhận ký hoặc từ chối
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-success"
              onClick={() => {
                const confirmed = window.confirm('Bạn chắc chắn muốn ký tài liệu này?');
                if (confirmed) {
                  signMutation.mutate();
                }
              }}
              disabled={signMutation.isPending}
            >
              <FiCheck style={{ marginRight: '8px' }} />
              {signMutation.isPending ? 'Đang ký...' : 'Xác nhận ký'}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                const reason = prompt('Nhập lý do từ chối:');
                if (reason && reason.trim()) {
                  rejectMutation.mutate(reason);
                }
              }}
              disabled={rejectMutation.isPending}
            >
              <FiX style={{ marginRight: '8px' }} />
              Từ chối
            </button>
          </div>
        </div>
      )}
      
      {/* Already Signed / Rejected */}
      {!canSign && workflow.status === 'pending' && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
            <p>Chưa đến lượt bạn ký</p>
            <p>Vui lòng chờ người ký trước</p>
          </div>
        </div>
      )}
      
      {workflow.status === 'completed' && (
        <div className="card" style={{ border: '2px solid #10b981', background: '#d1fae5' }}>
          <div style={{ textAlign: 'center', padding: '20px', color: '#065f46' }}>
            <FiCheck style={{ fontSize: '48px', marginBottom: '16px' }} />
            <h3>Tất cả người ký đã xác nhận</h3>
            <p>Workflow đã hoàn thành</p>
          </div>
        </div>
      )}
      
      {workflow.status === 'rejected' && (
        <div className="card" style={{ border: '2px solid #ef4444', background: '#fee2e2' }}>
          <div style={{ textAlign: 'center', padding: '20px', color: '#991b1b' }}>
            <FiX style={{ fontSize: '48px', marginBottom: '16px' }} />
            <h3>Workflow đã bị từ chối</h3>
            <p><strong>Lý do:</strong> {workflow.reject_reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowSigningPage;
