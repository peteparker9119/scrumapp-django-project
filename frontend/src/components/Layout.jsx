import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import './Layout.css';

const NAV_SECTIONS = [
  {
    section: 'Core',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '⬡', roles: [] },
      { to: '/projects', label: 'Projects', icon: '📁', roles: [] },
    ]
  },
  {
    section: 'Agile',
    items: [
      { to: '/backlog', label: 'Backlog', icon: '📝', roles: [] },
      { to: '/sprint-planning', label: 'Sprint Planning', icon: '🗓', roles: ['admin', 'scrum_master'] },
      { to: '/board', label: 'Kanban Board', icon: '📌', roles: [] },
      { to: '/burndown', label: 'Burndown Chart', icon: '📉', roles: [] },
      { to: '/retrospective', label: 'Retrospective', icon: '🔄', roles: [] },
      { to: '/reports', label: 'Velocity & Reports', icon: '📊', roles: [] },
    ]
  },
  {
    section: 'Enterprise',
    items: [
      { to: '/grooming', label: 'Grooming HUB', icon: '🌱', roles: ['admin', 'product_manager', 'scrum_master'] },
      { to: '/requirements', label: 'Requirements', icon: '📋', roles: ['admin', 'product_manager', 'scrum_master'] },
      { to: '/bugs', label: 'Bug Tracking', icon: '🐞', roles: [] },
      { to: '/releases', label: 'Release Tracking', icon: '🚀', roles: ['admin', 'product_manager', 'scrum_master'] },
    ]
  },
  {
    section: 'Admin',
    items: [
      { to: '/admin', label: 'Admin Control', icon: '⚙', roles: ['admin'] },
      { to: '/cto-command-center', label: 'CTO Command Center', icon: '⬡', roles: ['admin'] },
    ]
  }
];

const ROLE_COLORS = {
  admin: '#4F46E5',
  product_manager: '#7C3AED',
  scrum_master: '#0891B2',
  developer: '#059669',
};

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            {sidebarOpen && (
              <>
                <span className="logo-icon">🚀</span>
                <div className="logo-text-wrap">
                  <span className="logo-text">ScrumFlow</span>
                  <span className="logo-sub">Enterprise</span>
                </div>
              </>
            )}
          </div>
          <button className="btn-icon sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {currentProject && sidebarOpen && (
          <div className="current-project">
            <div className="project-label">Active Project</div>
            <div className="project-name">{currentProject.name}</div>
            <div className="project-key">{currentProject.key_code}</div>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(n =>
              n.roles.length === 0 || hasRole(...n.roles)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.section} className="nav-section">
                {sidebarOpen && (
                  <div className="nav-section-label">{section.section}</div>
                )}
                {visibleItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar" style={{ background: ROLE_COLORS[user?.role] || '#4F46E5' }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="user-details">
                <div className="user-name">{user?.name}</div>
                {user?.designation ? (
                  <div className="user-designation">{user.designation}</div>
                ) : (
                  <div className="user-role">{user?.role?.replace(/_/g, ' ')}</div>
                )}
                <div className="user-meta-chips">
                  {user?.level && <span className="user-level-chip">{user.level}</span>}
                  {/* Show all roles if user has multiple */}
                  {user?.roles?.length > 1
                    ? user.roles.map(r => (
                        <span key={r} className="user-team-chip" style={{ textTransform: 'capitalize' }}>
                          {r.replace(/_/g, ' ')}
                        </span>
                      ))
                    : user?.scrum_team && (
                        <span className="user-team-chip">Team {user.scrum_team}</span>
                      )
                  }
                </div>
              </div>
            )}
          </div>
          <button className="btn-icon logout-btn" onClick={handleLogout} title="Logout">⇥</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
