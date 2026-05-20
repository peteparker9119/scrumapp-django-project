import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './AdminPanel.css';

const ADMIN_NAV = [
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/employees', label: 'Employees', icon: '🏢' },
  { to: '/admin/logs', label: 'Activity Logs', icon: '📋' },
  { to: '/admin/stats', label: 'Scrum Stats', icon: '📊' },
  { to: '/admin/workspace', label: 'Workspace', icon: '⚙' },
];

export default function AdminPanel() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Admin Panel</div>
        <nav className="admin-nav">
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
