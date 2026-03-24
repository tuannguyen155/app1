import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workflowsApi } from '../services/api';
import { FiArrowLeft, FiFile, FiUsers, FiCheck, FiX, FiDownload, FiRotateCCW } from 'react-icons/fi';

function WorkflowDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: workflow, isLoading, refetch } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowsApi.get(id).then(res => res.data),
  });

  const getStatusBadge = (status) => {
    const badges = {
      draft: { class: 'badge-draft', label: 'Nháp' },
      pending: { class: 'badge-pending', label: 'Chờ ký' },
      in_progress: { class: 'badge-in_progress', label: 'Đang ký' },
      completed: { class: 'badge-completed', label: 'Hoàn thành' },
      rejected: { class: 'badge-rejected', label: 'Từ chối' },
    };
    const badge = badges[status] || badges.draft;
    return <span className={`badge ${badge.class}`}>{badge.label}</span>;
  };

  const getSignerStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-pending', label: 'Chờ ký', icon: '⏳' },
      signed: { class: 'badge-completed', label: 'Đã ký', icon: '✅' },
      rejected: { class: 'badge-rejected', label: 'Từ chối', icon: '❌' },
    };
    return badges[status] || badges.pending;
  };

  const handleExport = async () => {
    try {
      const res = await workflowsApi.export(id);
      if (res.data.download_url) {
        // Download the file using the download URL
        const downloadPath = res.data.download_url;
        const token = localStorage.getItem('token');
        
        // Create blob URL with auth
        const response = await fetch(`http://localhost:8000${downloadPath}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${workflow.title}_signed.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Có lỗi xuất file');
    }
  };

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

  return (
    <div>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="header-title">{workflow.title}</h1>
            {workflow.description && (
              <p style={{ color: '#64748b' }}>{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="header-actions">
          {workflow.status === 'completed' && (
            <button className="btn btn-primary" onClick={handleExport}>
              <FiDownload style={{ marginRight: '8px' }} />
              Xuất file
            </button>
          )}
          {(workflow.status === 'pending' || workflow.status === 'in_progress') && (
            <button className="btn btn-warning" onClick={async () => {
              if (confirm('Bạn có chắc chắn muốn thu hồi workflow này?')) {
                try {
                  await workflowsApi.recall(id);
                  alert('Đã thu hồi workflow');
                  refetch();
                } catch (error) {
                  alert('Không thể thu hồi: ' + (error.response?.data?.detail || 'Lỗi'));
                }
              }
            }}>
              🔄 Thu hồi
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Trạng thái: </strong>
            {getStatusBadge(workflow.status)}
          </div>
          {workflow.reject_reason && (
            <div style={{ color: 'red' }}>
              <strong>Lý do từ chối: </strong>
              {workflow.reject_reason}
            </div>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '16px' }}>
          <FiFile style={{ marginRight: '8px' }} />
          Tài liệu ({workflow.documents?.length || 0})
        </h2>
        
        {(!workflow.documents || workflow.documents.length === 0) ? (
          <div style={{ color: '#64748b' }}>Chưa có tài liệu</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tên file</th>
                <th>Loại</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {workflow.documents.map((doc, index) => (
                <tr key={index}>
                  <td>{doc.original_filename || doc.filename}</td>
                  <td>
                    <span className={`badge ${doc.file_type === 'main' ? 'badge-in_progress' : 'badge-draft'}`}>
                      {doc.file_type === 'main' ? 'File chính' : 'Đính kèm'}
                    </span>
                  </td>
                  <td>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signers */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '16px' }}>
          <FiUsers style={{ marginRight: '8px' }} />
          Người ký ({workflow.signers?.length || 0})
        </h2>
        
        {(!workflow.signers || workflow.signers.length === 0) ? (
          <div style={{ color: '#64748b' }}>Chưa có người ký</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {workflow.signers.map((signer, index) => {
              const statusBadge = getSignerStatusBadge(signer.status);
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="badge badge-draft">Bước {signer.step_order}</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {signer.user?.full_name || signer.user?.email}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {signer.user?.email}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge ${statusBadge.class}`}>
                      {statusBadge.icon} {statusBadge.label}
                    </span>
                    {signer.signed_at && (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(signer.signed_at).toLocaleString('vi-VN')}
                      </span>
                    )}
                    {signer.reject_reason && (
                      <div style={{ fontSize: '12px', color: 'red', maxWidth: '200px' }}>
                        Lý do: {signer.reject_reason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current User Actions */}
      {workflow.status === 'pending' && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Thao tác của bạn</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-success"
              onClick={async () => {
                await workflowsApi.sign(id);
                refetch();
              }}
            >
              <FiCheck style={{ marginRight: '8px' }} />
              Xác nhận ký
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                const reason = prompt('Nhập lý do từ chối:');
                if (reason) {
                  await workflowsApi.reject(id, reason);
                  refetch();
                }
              }}
            >
              <FiX style={{ marginRight: '8px' }} />
              Từ chối
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowDetailPage;
