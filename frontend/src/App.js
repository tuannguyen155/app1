import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './hooks/useAuthStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkflowCreatePage from './pages/WorkflowCreatePage';
import WorkflowDetailPage from './pages/WorkflowDetailPage';
import WorkflowSigningPage from './pages/WorkflowSigningPage';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="create" element={<WorkflowCreatePage />} />
        <Route path="workflow/:id" element={<WorkflowDetailPage />} />
        <Route path="workflow/:id/sign" element={<WorkflowSigningPage />} />
      </Route>
    </Routes>
  );
}

export default App;
