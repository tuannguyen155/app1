import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workflowsApi } from '../services/api';
import { FiPlus, FiFileText, FiUsers, FiClock, FiCheck, FiX } from 'react-icons/fi';

function DashboardPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: workflows = [], isLoading, refetch } = useQuery({
    queryKey: ['workflows', statusFilter],
    queryFn: () => workflowsApi.list(statusFilter || undefined).then(res => res.data),
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

  return (
    <div>
      <div className="header">
        <h1 className="header-title">Danh sách Workflow</h1>
        <div className="header-actions">
          <Link to="/create" className="btn btn-primary">
            <FiPlus style={{ marginRight: '8px' }} />
            Tạo mới
          </Link>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            className={`btn ${statusFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('')}
          >
            Tất cả
          </button>
          <button
            className={`btn ${statusFilter === 'draft' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('draft')}
          >
            Nháp
          </button>
          <button
            className={`btn ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('pending')}
          >
            Chờ ký
          </button>
          <button
            className={`btn ${statusFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('completed')}
          >
            Hoàn thành
          </button>
        </div>

        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">Chưa có workflow nào</div>
            <p>Tạo workflow đầu tiên để bắt đầu ký tài liệu</p>
            <Link to="/create" className="btn btn-primary" style={{ marginTop: '20px' }}>
              Tạo workflow
            </Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Trạng thái</th>
                <th>Người tạo</th>
                <th>Người ký</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{workflow.title}</div>
                    {workflow.description && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {workflow.description.substring(0, 50)}...
                      </div>
                    )}
                  </td>
                  <td>{getStatusBadge(workflow.status)}</td>
                  <td>{workflow.creator?.full_name || workflow.creator?.email}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiUsers />
                      {workflow.signers_count} người
                    </div>
                  </td>
                  <td>
                    {new Date(workflow.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/workflow/${workflow.id}`)}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
