import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Requirements from './pages/Requirements';
import Backlog from './pages/Backlog';
import SprintPlanning from './pages/SprintPlanning';
import KanbanBoard from './pages/KanbanBoard';
import BurndownChart from './pages/BurndownChart';
import AdminPanel from './pages/admin/AdminPanel';
import AdminUsers from './pages/admin/AdminUsers';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminLogs from './pages/admin/AdminLogs';
import AdminScrumStats from './pages/admin/AdminScrumStats';
import AdminWorkspace from './pages/admin/AdminWorkspace';

// Enterprise Modules
import GroomingHub from './pages/GroomingHub';
import BugTracking from './pages/BugTracking';
import ReleaseTracking from './pages/ReleaseTracking';
import Retrospective from './pages/Retrospective';
import VelocityReport from './pages/VelocityReport';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route
                path="requirements"
                element={
                  <ProtectedRoute roles={['admin', 'product_manager', 'scrum_master']}>
                    <Requirements />
                  </ProtectedRoute>
                }
              />
              <Route path="backlog" element={<Backlog />} />
              <Route
                path="sprint-planning"
                element={
                  <ProtectedRoute roles={['admin', 'scrum_master']}>
                    <SprintPlanning />
                  </ProtectedRoute>
                }
              />
              <Route path="board" element={<KanbanBoard />} />
              <Route path="burndown" element={<BurndownChart />} />

              {/* ─── Enterprise Modules ─── */}
              <Route
                path="grooming"
                element={
                  <ProtectedRoute roles={['admin', 'product_manager', 'scrum_master']}>
                    <GroomingHub />
                  </ProtectedRoute>
                }
              />
              <Route path="bugs" element={<BugTracking />} />
              <Route
                path="releases"
                element={
                  <ProtectedRoute roles={['admin', 'product_manager', 'scrum_master']}>
                    <ReleaseTracking />
                  </ProtectedRoute>
                }
              />
              <Route path="retrospective" element={<Retrospective />} />
              <Route path="reports" element={<VelocityReport />} />

              {/* Admin Panel */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="employees" element={<AdminEmployees />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="stats" element={<AdminScrumStats />} />
                <Route path="workspace" element={<AdminWorkspace />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
        />
      </ProjectProvider>
    </AuthProvider>
  );
}
