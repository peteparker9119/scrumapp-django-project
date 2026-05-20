import React, { useState, useEffect, useCallback } from 'react';
import { bugAPI, authAPI, projectAPI, backlogAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './BugTracking.css';

// ─── Config ────────────────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: '#EF4444', bg: '#FEF2F2', icon: '🔴' },
  high:     { label: 'High',     color: '#F97316', bg: '#FFF7ED', icon: '🟠' },
  medium:   { label: 'Medium',   color: '#EAB308', bg: '#FEFCE8', icon: '🟡' },
  low:      { label: 'Low',      color: '#22C55E', bg: '#F0FDF4', icon: '🟢' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#EF4444' },
  high:   { label: 'High',   color: '#F97316' },
  medium: { label: 'Medium', color: '#EAB308' },
  low:    { label: 'Low',    color: '#22C55E' },
};

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: '#6B7280', bg: '#F3F4F6' },
  assigned:    { label: 'Assigned',    color: '#3B82F6', bg: '#EFF6FF' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', bg: '#F5F3FF' },
  testing:     { label: 'Testing',     color: '#F59E0B', bg: '#FFFBEB' },
  closed:      { label: 'Closed',      color: '#10B981', bg: '#ECFDF5' },
  reopened:    { label: 'Reopened',    color: '#EF4444', bg: '#FEF2F2' },
};

const ENV_CONFIG = {
  dev:        { label: 'DEV',        color: '#6B7280', bg: '#F3F4F6' },
  sit:        { label: 'SIT',        color: '#3B82F6', bg: '#EFF6FF' },
  uat:        { label: 'UAT',        color: '#F59E0B', bg: '#FFFBEB' },
  production: { label: 'PROD',       color: '#EF4444', bg: '#FEF2F2' },
};

const STATUS_FLOW = ['open', 'assigned', 'in_progress', 'testing', 'closed'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

// ─── Sub-components ────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || { label: severity, color: '#6B7280', bg: '#F3F4F6', icon: '⚪' };
  return (
    <span className="severity-badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span className="status-badge-bug" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
  );
}

function EnvBadge({ env }) {
  const cfg = ENV_CONFIG[env] || { label: env, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span className="env-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '33' }}>
      {cfg.label}
    </span>
  );
}

function SlaIndicator({ ageHours, slaHours, status }) {
  if (['closed'].includes(status)) return null;
  const pct = Math.min((ageHours / slaHours) * 100, 100);
  const isBreached = pct >= 100;
  const isWarning = pct >= 75;
  return (
    <div className="sla-indicator" title={`${Math.round(ageHours)}h / ${slaHours}h SLA`}>
      <div className="sla-bar">
        <div className="sla-fill" style={{
          width: `${pct}%`,
          background: isBreached ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981'
        }} />
      </div>
      {isBreached && <span className="sla-breach-tag">SLA!</span>}
    </div>
  );
}

function StatsCards({ stats }) {
  if (!stats?.summary) return null;
  const s = stats.summary;
  const cards = [
    { label: 'Total', value: s.total, color: '#6B7280', icon: '🐞' },
    { label: 'Open', value: s.open_count, color: '#6B7280', icon: '📬' },
    { label: 'In Progress', value: s.in_progress_count, color: '#8B5CF6', icon: '🔧' },
    { label: 'Critical', value: s.critical_count, color: '#EF4444', icon: '🔴' },
    { label: 'SLA Breached', value: s.sla_breached, color: '#EF4444', icon: '⏰' },
    { label: 'Closed', value: s.closed_count, color: '#10B981', icon: '✅' },
  ];
  return (
    <div className="bug-stats-row">
      {cards.map(c => (
        <div key={c.label} className="bug-stat-card">
          <div className="stat-icon">{c.icon}</div>
          <div className="stat-value" style={{ color: c.color }}>{c.value || 0}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────────────
function CreateBugModal({ onClose, onSave, projectId, users }) {
  const [projects, setProjects] = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', severity: 'medium', priority: 'medium',
    environment: 'dev', assigned_to: '', reproduction_steps: '', due_date: '',
    project_id: projectId || '', backlog_item_id: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectAPI.getAll().then(r => setProjects(r.data)).catch(() => {});
    if (projectId) setForm(p => ({ ...p, project_id: projectId }));
  }, [projectId]);

  // Load backlog items when project is selected
  useEffect(() => {
    if (form.project_id) {
      backlogAPI.getAll({ project_id: form.project_id }).then(r => setBacklogItems(r.data)).catch(() => {});
    } else {
      setBacklogItems([]);
    }
  }, [form.project_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.project_id) return toast.error('Please select a project');
    setSaving(true);
    try {
      await onSave({ ...form });
      onClose();
    } catch { toast.error('Failed to create bug'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🐞 Report New Bug</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid-2">
            {!projectId && (
              <div className="form-group form-span-2">
                <label>Project *</label>
                <select value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))} required>
                  <option value="">— Select Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group form-span-2">
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of the bug..." required />
            </div>
            <div className="form-group">
              <label>Severity</label>
              <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Environment</label>
              <select value={form.environment} onChange={e => setForm(p => ({ ...p, environment: e.target.value }))}>
                <option value="dev">DEV</option>
                <option value="sit">SIT</option>
                <option value="uat">UAT</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className="form-group">
              <label>Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div className="form-group form-span-2">
              <label>Linked Backlog Item <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <select value={form.backlog_item_id} onChange={e => setForm(p => ({ ...p, backlog_item_id: e.target.value }))}>
                <option value="">— None —</option>
                {backlogItems.map(b => (
                  <option key={b.id} value={b.id}>[{b.item_type}] {b.title}{b.story_points ? ` (${b.story_points}pts)` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group form-span-2">
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed description of the bug..." />
            </div>
            <div className="form-group form-span-2">
              <label>Steps to Reproduce</label>
              <textarea rows={4} value={form.reproduction_steps} onChange={e => setForm(p => ({ ...p, reproduction_steps: e.target.value }))} placeholder="1. Go to...\n2. Click...\n3. See error" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Reporting...' : '🐞 Report Bug'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bug Detail Modal ─────────────────────────────────────────────────────────
function BugDetailModal({ bug, onClose, onUpdate, users }) {
  const [detail, setDetail] = useState(bug);
  const [comment, setComment] = useState('');
  const [editStatus, setEditStatus] = useState(bug.status);
  const [editAssignee, setEditAssignee] = useState(bug.assigned_to || '');
  const [submitting, setSubmitting] = useState(false);
  const [rootCause, setRootCause] = useState(bug.root_cause || '');
  const [resolutionNotes, setResolutionNotes] = useState(bug.resolution_notes || '');

  useEffect(() => {
    bugAPI.getOne(bug.id).then(res => setDetail(res.data)).catch(() => {});
  }, [bug.id]);

  const handleStatusUpdate = async () => {
    try {
      await onUpdate(bug.id, {
        status: editStatus,
        assigned_to: editAssignee || null,
        root_cause: rootCause,
        resolution_notes: resolutionNotes,
      });
      toast.success('Bug updated');
      onClose();
    } catch { toast.error('Update failed'); }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await bugAPI.addComment(bug.id, { comment });
      setDetail(prev => ({ ...prev, comments: [...(prev.comments || []), res.data] }));
      setComment('');
    } catch { toast.error('Failed to add comment'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-xlarge" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="bug-detail-id">{detail.bug_id}</div>
            <h2>{detail.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="bug-detail-body">
          <div className="bug-detail-main">
            {/* Meta */}
            <div className="bug-meta-row">
              <SeverityBadge severity={detail.severity} />
              <StatusBadge status={detail.status} />
              <EnvBadge env={detail.environment} />
              <span className="bug-meta-item">📅 {fmtDate(detail.due_date)}</span>
              {detail.assigned_to_name && <span className="bug-meta-item">👤 {detail.assigned_to_name}</span>}
            </div>

            {/* SLA */}
            <SlaIndicator ageHours={detail.age_hours} slaHours={detail.sla_hours} status={detail.status} />

            {/* Description */}
            {detail.description && (
              <div className="bug-section">
                <h3>Description</h3>
                <p className="detail-text">{detail.description}</p>
              </div>
            )}

            {/* Steps */}
            {detail.reproduction_steps && (
              <div className="bug-section">
                <h3>Steps to Reproduce</h3>
                <pre className="code-block">{detail.reproduction_steps}</pre>
              </div>
            )}

            {/* Root Cause */}
            <div className="bug-section">
              <h3>Root Cause Analysis</h3>
              <textarea
                className="bug-textarea"
                rows={3}
                value={rootCause}
                onChange={e => setRootCause(e.target.value)}
                placeholder="Document the root cause..."
              />
            </div>

            {/* Resolution */}
            <div className="bug-section">
              <h3>Resolution Notes</h3>
              <textarea
                className="bug-textarea"
                rows={3}
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="How was this resolved?"
              />
            </div>

            {/* History */}
            {detail.history?.length > 0 && (
              <div className="bug-section">
                <h3>Change History</h3>
                <div className="bug-history">
                  {detail.history.map(h => (
                    <div key={h.id} className="history-item">
                      <span className="history-field">{h.field_changed}</span>
                      <span className="history-arrow">→</span>
                      <span className="history-old">{h.old_value || '—'}</span>
                      <span className="history-arrow">→</span>
                      <span className="history-new">{h.new_value}</span>
                      <span className="history-meta">by {h.changed_by_name} · {fmtTime(h.changed_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="bug-detail-sidebar">
            {/* Linked Backlog Item */}
            {detail.backlog_item_id && (
              <div className="sidebar-section">
                <h3>🔗 Linked Backlog Item</h3>
                <div style={{ fontSize: 13, padding: '8px 10px', background: 'var(--primary-light)', borderRadius: 6, border: '1px solid #C7D2FE', color: 'var(--primary-dark)', fontWeight: 500 }}>
                  {detail.backlog_item_title || `Backlog #${detail.backlog_item_id}`}
                </div>
              </div>
            )}

            {/* Quick Update */}
            <div className="sidebar-section">
              <h3>Quick Update</h3>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="sidebar-select">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Assignee</label>
                <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} className="sidebar-select">
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleStatusUpdate}>
                Save Changes
              </button>
            </div>

            {/* Status Flow */}
            <div className="sidebar-section">
              <h3>Lifecycle</h3>
              <div className="bug-lifecycle">
                {STATUS_FLOW.map((s, i) => {
                  const cfg = STATUS_CONFIG[s];
                  const current = s === detail.status;
                  const past = STATUS_FLOW.indexOf(detail.status) > i;
                  return (
                    <div key={s} className={`lifecycle-step ${current ? 'current' : ''} ${past ? 'past' : ''}`}>
                      <div className="lifecycle-dot" style={{
                        background: current ? cfg.color : past ? '#10B981' : '#E5E7EB',
                        borderColor: current ? cfg.color : past ? '#10B981' : '#E5E7EB'
                      }} />
                      <span style={{ color: current ? cfg.color : '#6B7280' }}>{cfg.label}</span>
                      {i < STATUS_FLOW.length - 1 && <div className={`lifecycle-line ${past ? 'done' : ''}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comments */}
            <div className="sidebar-section" style={{ flex: 1 }}>
              <h3>💬 Comments</h3>
              <div className="bug-comments-list">
                {(detail.comments || []).length === 0 && <p className="empty-comments">No comments yet</p>}
                {(detail.comments || []).map(c => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-avatar">{c.user_name?.[0]?.toUpperCase()}</div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-author">{c.user_name}</span>
                        <span className="comment-time">{fmtDate(c.created_at)}</span>
                      </div>
                      <div className="comment-text">{c.comment}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="comment-input-row">
                <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add comment..." />
                <button className="btn-comment" onClick={handleComment} disabled={submitting || !comment.trim()}>Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bug Card ─────────────────────────────────────────────────────────────────
function BugCard({ bug, onClick }) {
  const slaBreached = bug.sla_breached;
  return (
    <div className={`bug-card ${slaBreached ? 'sla-breached' : ''}`} onClick={() => onClick(bug)}>
      <div className="bug-card-header">
        <span className="bug-card-id">{bug.bug_id}</span>
        <EnvBadge env={bug.environment} />
      </div>
      <h4 className="bug-card-title">{bug.title}</h4>
      <div className="bug-card-badges">
        <SeverityBadge severity={bug.severity} />
      </div>
      <div className="bug-card-footer">
        <StatusBadge status={bug.status} />
        <div className="bug-card-meta">
          {bug.assigned_to_name && <span>👤 {bug.assigned_to_name.split(' ')[0]}</span>}
          {slaBreached && <span className="sla-alert-tag">⏰ SLA</span>}
        </div>
      </div>
      <SlaIndicator ageHours={bug.age_hours} slaHours={bug.sla_hours} status={bug.status} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BugTracking() {
  const { currentProject } = useProject();
  const { hasRole } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', environment: '', search: '' });
  const [view, setView] = useState('board');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBug, setSelectedBug] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (currentProject?.id) params.project_id = currentProject.id;

      const [bugsRes, statsRes, usersRes] = await Promise.all([
        bugAPI.getAll(params),
        bugAPI.getStats(currentProject?.id ? { project_id: currentProject.id } : {}),
        authAPI.getUsers(),
      ]);
      setBugs(bugsRes.data);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch {
      toast.error('Failed to load bugs');
    } finally {
      setLoading(false);
    }
  }, [filters, currentProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    await bugAPI.create(data);
    toast.success('Bug reported successfully!');
    load();
  };

  const handleUpdate = async (id, data) => {
    await bugAPI.update(id, data);
    load();
  };

  const boardColumns = [
    { key: 'open', label: '📬 Open' },
    { key: 'assigned', label: '👤 Assigned' },
    { key: 'in_progress', label: '🔧 In Progress' },
    { key: 'testing', label: '🧪 Testing' },
    { key: 'closed', label: '✅ Closed' },
    { key: 'reopened', label: '🔄 Reopened' },
  ];

  return (
    <div className="bug-tracking">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🐞 Bug Tracking</h1>
          <p className="page-subtitle">Track, manage, and resolve bugs across all environments</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>⊞ Board</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ List</button>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Report Bug</button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Filters */}
      <div className="filters-bar">
        <input className="filter-input" placeholder="🔍 Search bugs..." value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
        <select className="filter-select" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="filter-select" value={filters.severity} onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))}>
          <option value="">All Severities</option>
          {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className="filter-select" value={filters.environment} onChange={e => setFilters(p => ({ ...p, environment: e.target.value }))}>
          <option value="">All Environments</option>
          {Object.entries(ENV_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-skeleton">
          {[1,2,3,4].map(i => <div key={i} className="skeleton-card" />)}
        </div>
      ) : bugs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🐞</div>
          <h3>No bugs found</h3>
          <p>No bugs match your current filters.</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Report First Bug</button>
        </div>
      ) : view === 'board' ? (
        <div className="bug-board">
          {boardColumns.map(col => {
            const colBugs = bugs.filter(b => b.status === col.key);
            const severity = SEVERITY_CONFIG;
            return (
              <div key={col.key} className="bug-column">
                <div className="bug-column-header">
                  <span>{col.label}</span>
                  <span className="column-count">{colBugs.length}</span>
                </div>
                <div className="bug-column-cards">
                  {colBugs.length === 0
                    ? <div className="column-empty">No bugs</div>
                    : colBugs.map(bug => (
                        <BugCard key={bug.id} bug={bug} onClick={() => setSelectedBug(bug)} />
                      ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bugs-table-wrap">
          <table className="bugs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Environment</th>
                <th>Linked Item</th>
                <th>Assigned To</th>
                <th>Reported</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map(bug => (
                <tr key={bug.id} className="table-row-hover" onClick={() => setSelectedBug(bug)}>
                  <td><span className="table-id">{bug.bug_id}</span></td>
                  <td className="table-title">{bug.title}</td>
                  <td><SeverityBadge severity={bug.severity} /></td>
                  <td><StatusBadge status={bug.status} /></td>
                  <td><EnvBadge env={bug.environment} /></td>
                  <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bug.backlog_item_title ? <span title={bug.backlog_item_title}>🔗 {bug.backlog_item_title}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td>{bug.assigned_to_name || <span className="text-muted">Unassigned</span>}</td>
                  <td>{fmtDate(bug.created_at)}</td>
                  <td><SlaIndicator ageHours={bug.age_hours} slaHours={bug.sla_hours} status={bug.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateBugModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          projectId={currentProject?.id}
          users={users}
        />
      )}
      {selectedBug && (
        <BugDetailModal
          bug={selectedBug}
          onClose={() => { setSelectedBug(null); load(); }}
          onUpdate={handleUpdate}
          users={users}
        />
      )}
    </div>
  );
}
