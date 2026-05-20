import React, { useState, useEffect, useCallback } from 'react';
import { releaseAPI, projectAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './ReleaseTracking.css';

// ─── Config ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  planning:    { label: 'Planning',    color: '#6B7280', bg: '#F3F4F6', icon: '📋' },
  development: { label: 'Development', color: '#3B82F6', bg: '#EFF6FF', icon: '💻' },
  qa:          { label: 'QA',          color: '#8B5CF6', bg: '#F5F3FF', icon: '🧪' },
  uat:         { label: 'UAT',         color: '#F59E0B', bg: '#FFFBEB', icon: '👥' },
  approved:    { label: 'Approved',    color: '#10B981', bg: '#ECFDF5', icon: '✅' },
  released:    { label: 'Released',    color: '#059669', bg: '#D1FAE5', icon: '🚀' },
  failed:      { label: 'Failed',      color: '#EF4444', bg: '#FEF2F2', icon: '❌' },
  rolled_back: { label: 'Rolled Back', color: '#F97316', bg: '#FFF7ED', icon: '↩' },
};

const RISK_CONFIG = {
  low:      { label: 'Low Risk',      color: '#10B981', bg: '#ECFDF5' },
  medium:   { label: 'Medium Risk',   color: '#F59E0B', bg: '#FFFBEB' },
  high:     { label: 'High Risk',     color: '#EF4444', bg: '#FEF2F2' },
  critical: { label: 'Critical Risk', color: '#7C3AED', bg: '#F5F3FF' },
};

const DEPLOY_STATUS = {
  pending:     { label: 'Pending',     color: '#6B7280', icon: '⏳' },
  in_progress: { label: 'In Progress', color: '#3B82F6', icon: '🔄' },
  success:     { label: 'Success',     color: '#10B981', icon: '✅' },
  failed:      { label: 'Failed',      color: '#EF4444', icon: '❌' },
  rolled_back: { label: 'Rolled Back', color: '#F97316', icon: '↩' },
};

const STATUS_FLOW = ['planning','development','qa','uat','approved','released'];
const ENVS = ['dev','sit','uat','production'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6', icon: '?' };
  return (
    <span className="release-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function RiskBadge({ risk }) {
  const cfg = RISK_CONFIG[risk] || { label: risk, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span className="risk-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
  );
}

function StatusFlow({ currentStatus }) {
  return (
    <div className="release-flow">
      {STATUS_FLOW.map((s, idx) => {
        const cfg = STATUS_CONFIG[s];
        const curIdx = STATUS_FLOW.indexOf(currentStatus);
        const isPast = idx < curIdx;
        const isCurrent = s === currentStatus;
        return (
          <React.Fragment key={s}>
            <div className={`flow-step ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}>
              <div className="flow-icon" style={{
                background: isCurrent ? cfg.color : isPast ? '#10B981' : '#F3F4F6',
                color: (isCurrent || isPast) ? '#fff' : '#9CA3AF'
              }}>
                {isPast ? '✓' : cfg.icon}
              </div>
              <div className="flow-label">{cfg.label}</div>
            </div>
            {idx < STATUS_FLOW.length - 1 && (
              <div className={`flow-connector ${isPast ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DeploymentPipeline({ deployments, releaseId, canDeploy, onUpdate }) {
  const [updating, setUpdating] = useState(null);

  const handleUpdate = async (env, status) => {
    setUpdating(env);
    try {
      await onUpdate(releaseId, env, { status });
      toast.success(`${env.toUpperCase()} deployment updated`);
    } catch {
      toast.error('Update failed');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="deployment-pipeline">
      {ENVS.map(env => {
        const dep = deployments?.find(d => d.environment === env);
        const status = dep?.status || 'pending';
        const cfg = DEPLOY_STATUS[status];
        const envLabels = { dev: 'DEV', sit: 'SIT', uat: 'UAT', production: 'PROD' };
        return (
          <div key={env} className={`deploy-stage ${status}`}>
            <div className="deploy-env-label">{envLabels[env]}</div>
            <div className="deploy-icon" style={{ color: cfg.color }}>{cfg.icon}</div>
            <div className="deploy-status-label" style={{ color: cfg.color }}>{cfg.label}</div>
            {dep?.deployed_at && <div className="deploy-date">{fmtDate(dep.deployed_at)}</div>}
            {canDeploy && (
              <select
                className="deploy-action-select"
                value={status}
                onChange={e => handleUpdate(env, e.target.value)}
                disabled={updating === env}
              >
                {Object.entries(DEPLOY_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            )}
            {env !== 'production' && <div className={`pipeline-arrow ${status === 'success' ? 'success' : ''}`}>→</div>}
          </div>
        );
      })}
    </div>
  );
}

function StatsRow({ stats }) {
  if (!stats?.summary) return null;
  const s = stats.summary;
  const cards = [
    { label: 'Total', value: s.total, icon: '📦', color: '#6B7280' },
    { label: 'In Progress', value: (s.development || 0) + (s.qa || 0) + (s.uat || 0), icon: '🔄', color: '#3B82F6' },
    { label: 'Released', value: s.released, icon: '🚀', color: '#10B981' },
    { label: 'Delayed', value: s.overdue, icon: '⚠️', color: '#F59E0B' },
    { label: 'Failed', value: s.failed, icon: '❌', color: '#EF4444' },
  ];
  return (
    <div className="release-stats-row">
      {cards.map(c => (
        <div key={c.label} className="release-stat-card">
          <div className="stat-icon">{c.icon}</div>
          <div className="stat-value" style={{ color: c.color }}>{c.value || 0}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
      {/* Upcoming */}
      {stats.upcoming?.length > 0 && (
        <div className="upcoming-releases">
          <div className="upcoming-title">🗓 Upcoming</div>
          {stats.upcoming.slice(0, 2).map(r => (
            <div key={r.release_id} className="upcoming-item">
              <span className="upcoming-version">{r.version}</span>
              <span className="upcoming-date">{fmtDate(r.planned_date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────────────
function CreateReleaseModal({ onClose, onSave, projectId }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    name: '', version: '', description: '', planned_date: '', risk_level: 'medium',
    project_id: projectId || ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectAPI.getAll().then(r => setProjects(r.data)).catch(() => {});
    if (projectId) setForm(p => ({ ...p, project_id: projectId }));
  }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.version) return toast.error('Name and version are required');
    if (!form.project_id) return toast.error('Please select a project');
    setSaving(true);
    try {
      await onSave({ ...form });
      onClose();
    } catch { toast.error('Failed to create release'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🚀 New Release</h2>
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
              <label>Release Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Q3 2025 Major Release" required />
            </div>
            <div className="form-group">
              <label>Version *</label>
              <input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="e.g., v2.1.0" required />
            </div>
            <div className="form-group">
              <label>Risk Level</label>
              <select value={form.risk_level} onChange={e => setForm(p => ({ ...p, risk_level: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="form-group form-span-2">
              <label>Planned Release Date</label>
              <input type="date" value={form.planned_date} onChange={e => setForm(p => ({ ...p, planned_date: e.target.value }))} />
            </div>
            <div className="form-group form-span-2">
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What does this release include?" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : '🚀 Create Release'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Release Detail Modal ─────────────────────────────────────────────────────
function ReleaseDetailModal({ releaseId, onClose, onUpdate, canDeploy, canEdit }) {
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await releaseAPI.getOne(releaseId);
      setRelease(res.data);
      setEditStatus(res.data.status);
      setEditNotes(res.data.release_notes || '');
    } catch { toast.error('Failed to load release'); }
    finally { setLoading(false); }
  }, [releaseId]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async () => {
    try {
      await onUpdate(releaseId, { status: editStatus, release_notes: editNotes });
      toast.success('Release updated');
      load();
    } catch { toast.error('Update failed'); }
  };

  const handleDeployUpdate = async (relId, env, data) => {
    await releaseAPI.updateDeployment(relId, env, data);
    load();
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    try {
      await releaseAPI.addComment(releaseId, { comment });
      setComment('');
      load();
    } catch { toast.error('Failed to add comment'); }
  };

  if (loading || !release) return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div className="loading-text">Loading release...</div>
      </div>
    </div>
  );

  const isDelayed = release.planned_date && new Date(release.planned_date) < new Date() && !['released','failed'].includes(release.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-xlarge" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="release-detail-id">{release.release_id} · {release.version}</div>
            <h2>{release.name}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="release-detail-body">
          <div className="release-detail-main">
            {/* Meta */}
            <div className="release-meta-row">
              <StatusBadge status={release.status} />
              <RiskBadge risk={release.risk_level} />
              {isDelayed && <span className="delayed-badge">⚠️ Delayed</span>}
              <span className="release-meta-chip">📅 Planned: {fmtDate(release.planned_date)}</span>
              {release.actual_date && <span className="release-meta-chip">✅ Released: {fmtDate(release.actual_date)}</span>}
            </div>

            {/* Status Flow */}
            <div className="release-section">
              <h3>Release Progress</h3>
              <StatusFlow currentStatus={release.status} />
            </div>

            {/* Deployment Pipeline */}
            <div className="release-section">
              <h3>Deployment Pipeline</h3>
              <DeploymentPipeline
                deployments={release.deployments}
                releaseId={release.id}
                canDeploy={canDeploy}
                onUpdate={handleDeployUpdate}
              />
            </div>

            {/* Description */}
            {release.description && (
              <div className="release-section">
                <h3>Description</h3>
                <p className="detail-text">{release.description}</p>
              </div>
            )}

            {/* Release Notes */}
            <div className="release-section">
              <h3>Release Notes</h3>
              <textarea
                className="release-textarea"
                rows={5}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Document release notes, changes, known issues..."
                disabled={!canEdit}
              />
            </div>

            {/* Linked Sprints */}
            {release.sprints?.length > 0 && (
              <div className="release-section">
                <h3>Linked Sprints</h3>
                <div className="linked-sprints">
                  {release.sprints.map(s => (
                    <div key={s.id} className="sprint-chip">
                      🗓 {s.name}
                      <span className={`sprint-status-mini ${s.status}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="release-detail-sidebar">
            {/* Quick Update */}
            {canEdit && (
              <div className="sidebar-section">
                <h3>Update Status</h3>
                <select className="sidebar-select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <button className="btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={handleUpdate}>
                  Save Changes
                </button>
              </div>
            )}

            {/* Deployment Summary */}
            <div className="sidebar-section">
              <h3>Deploy Summary</h3>
              <div className="deploy-summary">
                {ENVS.map(env => {
                  const dep = release.deployments?.find(d => d.environment === env);
                  const status = dep?.status || 'pending';
                  const cfg = DEPLOY_STATUS[status];
                  return (
                    <div key={env} className="deploy-summary-row">
                      <span className="deploy-env-name">{env.toUpperCase()}</span>
                      <span style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comments */}
            <div className="sidebar-section" style={{ flex: 1 }}>
              <h3>💬 Comments</h3>
              <div className="release-comments-list">
                {(release.comments || []).length === 0 && <p className="empty-comments">No comments yet</p>}
                {(release.comments || []).map(c => (
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
                <button className="btn-comment" onClick={handleComment} disabled={!comment.trim()}>Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Release Card ─────────────────────────────────────────────────────────────
function ReleaseCard({ release, onClick }) {
  const isDelayed = release.planned_date && new Date(release.planned_date) < new Date() && !['released','failed'].includes(release.status);
  const statusCfg = STATUS_CONFIG[release.status] || { icon: '?', color: '#6B7280', bg: '#F3F4F6' };
  const statusIdx = STATUS_FLOW.indexOf(release.status);
  const progress = release.status === 'released' ? 100 : statusIdx >= 0 ? Math.round((statusIdx / (STATUS_FLOW.length - 1)) * 100) : 0;

  return (
    <div className={`release-card ${isDelayed ? 'delayed' : ''}`} onClick={() => onClick(release)}>
      <div className="release-card-header">
        <div>
          <span className="release-card-id">{release.release_id}</span>
          <span className="release-card-version">{release.version}</span>
        </div>
        <RiskBadge risk={release.risk_level} />
      </div>
      <h4 className="release-card-name">{release.name}</h4>
      <div className="release-card-status">
        <StatusBadge status={release.status} />
        {isDelayed && <span className="delayed-tag">⚠️ Delayed</span>}
      </div>
      <div className="release-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{
            width: `${progress}%`,
            background: release.status === 'released' ? '#10B981' :
              release.status === 'failed' ? '#EF4444' : '#3B82F6'
          }} />
        </div>
        <span className="progress-pct">{progress}%</span>
      </div>
      <div className="release-card-footer">
        <span className="release-date">📅 {fmtDate(release.planned_date)}</span>
        <div className="release-card-meta">
          {release.sprint_count > 0 && <span>🗓 {release.sprint_count} sprints</span>}
          {release.successful_deployments > 0 && <span>✅ {release.successful_deployments}/{release.total_deployments}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReleaseTracking() {
  const { currentProject } = useProject();
  const { hasRole } = useAuth();
  const [releases, setReleases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState(null);

  const canCreate = hasRole('admin', 'scrum_master', 'product_manager');
  const canDeploy = hasRole('admin', 'scrum_master');
  const canEdit = hasRole('admin', 'scrum_master', 'product_manager');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (currentProject?.id) params.project_id = currentProject.id;

      const [relRes, statsRes] = await Promise.all([
        releaseAPI.getAll(params),
        releaseAPI.getStats(currentProject?.id ? { project_id: currentProject.id } : {}),
      ]);
      setReleases(relRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, [filters, currentProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    await releaseAPI.create(data);
    toast.success('Release created!');
    load();
  };

  const handleUpdate = async (id, data) => {
    await releaseAPI.update(id, data);
    load();
  };

  // Group by status for pipeline view
  const statusGroups = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = releases.filter(r => r.status === s);
    return acc;
  }, {});
  const otherReleases = releases.filter(r => ['failed','rolled_back'].includes(r.status));

  return (
    <div className="release-tracking">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🚀 Release Tracking</h1>
          <p className="page-subtitle">Plan, track, and deploy releases across all environments</p>
        </div>
        <div className="header-actions">
          {canCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Release</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Filters */}
      <div className="filters-bar">
        <input className="filter-input" placeholder="🔍 Search releases..."
          value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
        <select className="filter-select" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-skeleton">
          {[1,2,3].map(i => <div key={i} className="skeleton-card" />)}
        </div>
      ) : releases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <h3>No releases found</h3>
          <p>Start by creating your first release.</p>
          {canCreate && <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Release</button>}
        </div>
      ) : filters.status ? (
        <div className="releases-grid">
          {releases.map(r => <ReleaseCard key={r.id} release={r} onClick={setSelectedRelease} />)}
        </div>
      ) : (
        // Pipeline view grouped by status
        <div className="release-pipeline-view">
          {STATUS_FLOW.map(status => {
            const groupReleases = releases.filter(r => r.status === status);
            if (groupReleases.length === 0) return null;
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className="release-pipeline-section">
                <div className="pipeline-section-header" style={{ borderLeftColor: cfg.color }}>
                  <span className="pipeline-section-icon">{cfg.icon}</span>
                  <span className="pipeline-section-title">{cfg.label}</span>
                  <span className="pipeline-section-count">{groupReleases.length}</span>
                </div>
                <div className="releases-grid">
                  {groupReleases.map(r => <ReleaseCard key={r.id} release={r} onClick={setSelectedRelease} />)}
                </div>
              </div>
            );
          })}
          {otherReleases.length > 0 && (
            <div className="release-pipeline-section">
              <div className="pipeline-section-header" style={{ borderLeftColor: '#EF4444' }}>
                <span className="pipeline-section-icon">⚠️</span>
                <span className="pipeline-section-title">Failed / Rolled Back</span>
                <span className="pipeline-section-count">{otherReleases.length}</span>
              </div>
              <div className="releases-grid">
                {otherReleases.map(r => <ReleaseCard key={r.id} release={r} onClick={setSelectedRelease} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateReleaseModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          projectId={currentProject?.id}
        />
      )}
      {selectedRelease && (
        <ReleaseDetailModal
          releaseId={selectedRelease.id}
          onClose={() => { setSelectedRelease(null); load(); }}
          onUpdate={handleUpdate}
          canDeploy={canDeploy}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
