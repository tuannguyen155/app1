import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';
import { FiHome, FiPlusCircle, FiLogOut, FiUser, FiFileText } from 'react-icons/fi';

function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          PDF Signing
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiHome className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink to="/create" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiPlusCircle className="nav-icon" />
            <span>Tạo mới</span>
          </NavLink>
          
          <NavLink to="/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FiFileText className="nav-icon" />
            <span>Tài liệu</span>
          </NavLink>
        </nav>
        
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div className="nav-item" style={{ cursor: 'default' }}>
            <FiUser className="nav-icon" />
            <span>{user?.full_name || user?.email}</span>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
            <FiLogOut className="nav-icon" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
