import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './Login.css';

// Actual EMIS accounts (mapped to hierarchy tiers)
const HIERARCHY_DEMO = [
  {
    level: 'L0', role: 'admin', label: 'CTO', icon: '👑',
    name: 'Varun', designation: 'CTO',
    email: 'varun.m@tnschools.gov.in',
    color: '#4F46E5', bg: '#EEF2FF',
  },
  {
    level: 'L1', role: 'product_manager', label: 'Product Manager', icon: '📋',
    name: 'J. Jones Praveen', designation: 'Product Manager',
    email: 'jonespraveen.j@tnschools.gov.in',
    color: '#7C3AED', bg: '#F5F3FF',
  },
  {
    level: 'L2', role: 'scrum_master', label: 'Scrum Master', icon: '🗓',
    name: 'Vaseekaran', designation: 'Sr. Architect Manager',
    email: 'vaseekaran.r@tnschools.gov.in',
    color: '#0891B2', bg: '#ECFEFF',
  },
  {
    level: 'L3', role: 'developer', label: 'Developer', icon: '💻',
    name: 'Gunaseelan Peter S', designation: 'Product Manager/Scrum Master',
    email: 'peter.s@tnschools.gov.in',
    color: '#059669', bg: '#ECFDF5',
  },
];

const ROLE_DESC = {
  admin:           'Full access · Manage users, workspace & all modules',
  product_manager: 'Manage requirements, grooming, releases & reporting',
  scrum_master:    'Run sprints, retrospectives, capacity & burndown',
  developer:       'View board, update items & report bugs',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const pickDemo = (demo) => {
    setSelectedDemo(demo.role);
    setEmail(demo.email);
    setPassword('password');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">🚀</div>
          <h1 className="login-title">Scrum<span>Flow</span></h1>
          <p className="login-subtitle">Sign in with your EMIS credentials</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">EMIS Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="yourname@tnschools.gov.in"
              value={email}
              onChange={e => { setEmail(e.target.value); setSelectedDemo(null); }}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <span className="login-btn-inner"><span className="login-spinner" /> Signing in…</span>
            ) : (
              <span className="login-btn-inner">Sign In →</span>
            )}
          </button>
        </form>

        {/* Hierarchy Demo Tiles */}
        <div className="quick-logins">
          <div className="quick-label">
            <span className="ql-line" />
            <span>Demo Access by Hierarchy</span>
            <span className="ql-line" />
          </div>
          <div className="hierarchy-grid">
            {HIERARCHY_DEMO.map((demo) => (
              <button
                key={demo.role}
                type="button"
                className={`hierarchy-tile ${selectedDemo === demo.role ? 'selected' : ''}`}
                style={{ '--tile-color': demo.color, '--tile-bg': demo.bg }}
                onClick={() => pickDemo(demo)}
                title={`Login as ${demo.name} (${demo.designation})`}
              >
                <div className="tile-level-badge" style={{ background: demo.color }}>{demo.level}</div>
                <div className="tile-icon">{demo.icon}</div>
                <div className="tile-label">{demo.label}</div>
                <div className="tile-name">{demo.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>

          {/* Role description */}
          {selectedDemo && (
            <div className="role-desc-strip" style={{ borderColor: HIERARCHY_DEMO.find(d => d.role === selectedDemo)?.color + '40' }}>
              <span className="role-desc-icon" style={{ color: HIERARCHY_DEMO.find(d => d.role === selectedDemo)?.color }}>
                {HIERARCHY_DEMO.find(d => d.role === selectedDemo)?.icon}
              </span>
              <span>{ROLE_DESC[selectedDemo]}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="login-footer">
          <div className="login-footer-org">
            <span className="footer-dot" style={{ background: '#10B981' }} />
            Tamil Nadu School Education Department · EMIS
          </div>
        </div>
      </div>
    </div>
  );
}
