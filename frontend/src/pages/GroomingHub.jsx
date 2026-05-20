import React, { useState, useEffect, useCallback } from 'react';
import { groomingAPI, projectAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './GroomingHub.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'team_lead_review', label: 'Team Lead Review', icon: '👤', color: '#3B82F6' },
  { key: 'stakeholder_signoff', label: 'Stakeholder Sign-off', icon: '✍️', color: '#8B5CF6' },
  { key: 'uiux_review', label: 'UI/UX Review', icon: '🎨', color: '#EC4899' },
  { key: 'manager_review', label: 'Manager Review', icon: '🏢', color: '#F59E0B' },
];

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  team_lead_review: { label: 'Team Lead Review', color: '#3B82F6', bg: '#EFF6FF' },
  stakeholder_signoff: { label: 'Stakeholder Sign-off', color: '#8B5CF6', bg: '#F5F3FF' },
  uiux_review: { label: 'UI/UX Review', color: '#EC4899', bg: '#FDF2F8' },
  manager_review: { label: 'Manager Review', color: '#F59E0B', bg: '#FFFBEB' },
  ready_for_sprint: { label: '✅ Ready for Sprint', color: '#10B981', bg: '#ECFDF5' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FEF2F2' },
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: '#EF4444' },
  high: { label: 'High', color: '#F97316' },
  medium: { label: 'Medium', color: '#EAB308' },
  low: { label: 'Low', color: '#22C55E' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function ApprovalStepper({ approvals, currentStatus }) {
  return (
    <div className="approval-stepper">
      {STAGES.map((stage, idx) => {
        const approval = approvals?.find(a => a.stage === stage.key);
        const status = approval?.status || 'pending';
        const stageIdx = STAGES.findIndex(s => s.key === currentStatus);
        const isPast = idx < stageIdx || currentStatus === 'ready_for_sprint';
        const isCurrent = stage.key === currentStatus;
        return (
          <div key={stage.key} className={`stepper-step ${status} ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}>
            <div className="stepper-icon" style={{ borderColor: status === 'approved' ? '#10B981' : status === 'rejected' ? '#EF4444' : isCurrent ? stage.color : '#D1D5DB' }}>
              {status === 'approved' ? '✓' : status === 'rejected' ? '✗' : status === 'rework' ? '↩' : stage.icon}
            </div>
            <div className="stepper-label">{stage.label}</div>
            {approval?.reviewed_at && (
              <div className="stepper-date">{fmtDate(approval.reviewed_at)}</div>
            )}
            {idx < STAGES.length - 1 && <div className={`stepper-connector ${isPast || status === 'approved' ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span className="status-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || { label: priority, color: '#6B7280' };
  return (
    <span className="priority-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
      <span className="priority-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ onClose, onSave, projectId }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', business_need: '', acceptance_criteria: '',
    priority: 'medium', module: '', story_points: '', due_date: '',
    tags: '', dependency: '', requested_by: user?.id,
    project_id: projectId || ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectAPI.getAll().then(r => setProjects(r.data)).catch(() => {});
    if (projectId) setForm(p => ({ ...p, project_id: projectId }));
  }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.project_id) return toast.error('Please select a project');
    setSaving(true);
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await onSave({
        ...form,
        story_points: form.story_points ? parseInt(form.story_points) : null,
        tags,
      });
      onClose();
    } catch {
      toast.error('Failed to create requirement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🌱 New Grooming Requirement</h2>
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
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Requirement title..." required />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Module</label>
              <input value={form.module} onChange={e => setForm(p => ({ ...p, module: e.target.value }))} placeholder="e.g., Authentication" />
            </div>
            <div className="form-group">
              <label>Story Points</label>
              <input type="number" min="1" max="100" value={form.story_points} onChange={e => setForm(p => ({ ...p, story_points: e.target.value }))} placeholder="e.g., 8" />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div className="form-group form-span-2">
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed description..." />
            </div>
            <div className="form-group form-span-2">
              <label>Business Need</label>
              <textarea rows={2} value={form.business_need} onChange={e => setForm(p => ({ ...p, business_need: e.target.value }))} placeholder="Why is this needed?" />
            </div>
            <div className="form-group form-span-2">
              <label>Acceptance Criteria</label>
              <textarea rows={3} value={form.acceptance_criteria} onChange={e => setForm(p => ({ ...p, acceptance_criteria: e.target.value }))} placeholder="When is this done? (one per line)" />
            </div>
            <div className="form-group">
              <label>Tags (comma separated)</label>
              <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="SSO, Auth, Security" />
            </div>
            <div className="form-group">
              <label>Dependency</label>
              <input value={form.dependency} onChange={e => setForm(p => ({ ...p, dependency: e.target.value }))} placeholder="Depends on..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating...' : '+ Create Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ item, stage, onClose, onReview }) {
  const [action, setAction] = useState('approved');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const stageCfg = STAGES.find(s => s.key === stage);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onReview(item.id, stage, { action, comments });
      onClose();
    } catch {
      toast.error('Review failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{stageCfg?.icon} {stageCfg?.label}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="review-item-info">
            <div className="review-item-id">{item.req_id}</div>
            <div className="review-item-title">{item.title}</div>
          </div>
          <div className="form-group">
            <label>Decision</label>
            <div className="decision-buttons">
              {[
                { value: 'approved', label: '✓ Approve', cls: 'btn-approve' },
                { value: 'rework', label: '↩ Request Rework', cls: 'btn-rework' },
                { value: 'rejected', label: '✗ Reject', cls: 'btn-reject' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`decision-btn ${opt.cls} ${action === opt.value ? 'selected' : ''}`}
                  onClick={() => setAction(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Comments</label>
            <textarea rows={4} value={comments} onChange={e => setComments(e.target.value)} placeholder="Add your review comments..." />
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ item, onClose, onReview, onSubmit, canReview, currentUserRole }) {
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState(item.comments || []);
  const [reviewModal, setReviewModal] = useState(null);

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await groomingAPI.addComment(item.id, { comment });
      setComments(prev => [...prev, res.data]);
      setComment('');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitForReview = async () => {
    try {
      await onSubmit(item.id);
      toast.success('Submitted for Team Lead review');
      onClose();
    } catch {
      toast.error('Failed to submit');
    }
  };

  const tags = (() => { try { return JSON.parse(item.tags || '[]'); } catch { return []; } })();

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel modal-xlarge" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="detail-req-id">{item.req_id}</div>
              <h2>{item.title}</h2>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="detail-body">
            <div className="detail-main">
              {/* Status + Meta */}
              <div className="detail-meta-row">
                <StatusBadge status={item.status} />
                <PriorityBadge priority={item.priority} />
                {item.module && <span className="meta-chip">📦 {item.module}</span>}
                {item.story_points && <span className="meta-chip">⚡ {item.story_points} pts</span>}
                {item.due_date && <span className="meta-chip">📅 {fmtDate(item.due_date)}</span>}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="tags-row">
                  {tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
                </div>
              )}

              {/* Approval Stepper */}
              <div className="detail-section">
                <h3>Approval Progress</h3>
                <ApprovalStepper approvals={item.approvals} currentStatus={item.status} />
              </div>

              {/* Approval History */}
              {item.approvals?.some(a => a.status !== 'pending') && (
                <div className="detail-section">
                  <h3>Review History</h3>
                  <div className="approval-history">
                    {item.approvals.filter(a => a.status !== 'pending').map(a => {
                      const stageCfg = STAGES.find(s => s.key === a.stage);
                      return (
                        <div key={a.id} className={`approval-record ${a.status}`}>
                          <div className="approval-record-header">
                            <span>{stageCfg?.icon} {stageCfg?.label}</span>
                            <span className={`approval-status-tag ${a.status}`}>{a.status}</span>
                          </div>
                          {a.reviewer_name && <div className="approval-reviewer">By {a.reviewer_name} · {fmtDate(a.reviewed_at)}</div>}
                          {a.comments && <div className="approval-comments">{a.comments}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description sections */}
              {[
                { label: 'Description', value: item.description },
                { label: 'Business Need', value: item.business_need },
                { label: 'Acceptance Criteria', value: item.acceptance_criteria },
                { label: 'Dependency', value: item.dependency },
              ].map(({ label, value }) => value ? (
                <div key={label} className="detail-section">
                  <h3>{label}</h3>
                  <p className="detail-text">{value}</p>
                </div>
              ) : null)}

              {/* Action Buttons */}
              <div className="detail-actions">
                {item.status === 'draft' && (
                  <button className="btn-submit-review" onClick={handleSubmitForReview}>
                    🚀 Submit for Review
                  </button>
                )}
                {canReview && STAGES.map(s => s.key).includes(item.status) && (
                  <button
                    className="btn-review-stage"
                    onClick={() => setReviewModal(item.status)}
                    style={{ borderColor: STAGES.find(s => s.key === item.status)?.color }}
                  >
                    {STAGES.find(s => s.key === item.status)?.icon} Review: {STAGES.find(s => s.key === item.status)?.label}
                  </button>
                )}
              </div>
            </div>

            {/* Comments Panel */}
            <div className="detail-sidebar">
              <h3>💬 Activity</h3>
              <div className="comments-list">
                {comments.length === 0 && <p className="empty-comments">No comments yet</p>}
                {comments.map(c => (
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
                <textarea
                  rows={2}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddComment(); }}
                />
                <button
                  className="btn-comment"
                  onClick={handleAddComment}
                  disabled={submittingComment || !comment.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {reviewModal && (
        <ReviewModal
          item={item}
          stage={reviewModal}
          onClose={() => setReviewModal(null)}
          onReview={async (itemId, stage, data) => {
            await onReview(itemId, stage, data);
            setReviewModal(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ─── Grooming Card ─────────────────────────────────────────────────────────────
function GroomingCard({ item, onClick }) {
  const tags = (() => { try { return JSON.parse(item.tags || '[]'); } catch { return []; } })();
  const stageIdx = STAGES.findIndex(s => s.key === item.status);
  const progress = item.status === 'ready_for_sprint' ? 100 :
    item.status === 'draft' ? 0 :
    item.status === 'rejected' ? 0 :
    Math.round(((stageIdx) / STAGES.length) * 100);

  return (
    <div className="grooming-card" onClick={() => onClick(item)}>
      <div className="card-header">
        <span className="card-req-id">{item.req_id}</span>
        <PriorityBadge priority={item.priority} />
      </div>
      <h4 className="card-title">{item.title}</h4>
      {item.module && <div className="card-module">📦 {item.module}</div>}

      <div className="card-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{
            width: `${progress}%`,
            background: item.status === 'ready_for_sprint' ? '#10B981' :
              item.status === 'rejected' ? '#EF4444' : '#3B82F6'
          }} />
        </div>
        <span className="progress-label">{item.approved_stages || 0}/4 stages</span>
      </div>

      <div className="card-footer">
        <StatusBadge status={item.status} />
        <div className="card-meta">
          {item.story_points && <span>⚡{item.story_points}pts</span>}
          {item.comment_count > 0 && <span>💬{item.comment_count}</span>}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="card-tags">
          {tags.slice(0, 3).map(t => <span key={t} className="tag-chip-sm">{t}</span>)}
        </div>
      )}
    </div>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────
function StatsRow({ stats }) {
  if (!stats) return null;
  const cards = [
    { label: 'Total', value: stats.total, icon: '📋', color: '#6B7280' },
    { label: 'Draft', value: stats.draft, icon: '✏️', color: '#6B7280' },
    { label: 'In Review', value: (stats.team_lead_review || 0) + (stats.stakeholder_signoff || 0) + (stats.uiux_review || 0) + (stats.manager_review || 0), icon: '🔄', color: '#3B82F6' },
    { label: 'Ready', value: stats.ready_for_sprint, icon: '✅', color: '#10B981' },
    { label: 'Rejected', value: stats.rejected, icon: '❌', color: '#EF4444' },
  ];
  return (
    <div className="stats-row">
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-icon">{c.icon}</div>
          <div className="stat-value" style={{ color: c.color }}>{c.value || 0}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GroomingHub() {
  const { currentProject } = useProject();
  const { user, hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [view, setView] = useState('board'); // 'board' | 'list'
  const [showCreate, setShowCreate] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ready'

  const canCreate = hasRole('admin', 'product_manager');
  const canReview = hasRole('admin', 'scrum_master', 'product_manager');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (currentProject?.id) params.project_id = currentProject.id;
      if (activeTab === 'ready') params.status = 'ready_for_sprint';

      const [itemsRes, statsRes] = await Promise.all([
        groomingAPI.getAll(params),
        groomingAPI.getStats(currentProject?.id ? { project_id: currentProject.id } : {}),
      ]);
      setItems(itemsRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load grooming items');
    } finally {
      setLoading(false);
    }
  }, [filters, currentProject, activeTab]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    const res = await groomingAPI.create(data);
    toast.success('Requirement created!');
    load();
    return res.data;
  };

  const handleReview = async (itemId, stage, data) => {
    await groomingAPI.reviewStage(itemId, stage, data);
    const msg = data.action === 'approved' ? '✅ Approved!' : data.action === 'rejected' ? '❌ Rejected' : '↩ Sent for rework';
    toast.success(msg);
    load();
  };

  const handleSubmit = async (itemId) => {
    await groomingAPI.submitForReview(itemId);
    load();
  };

  const openDetail = async (item) => {
    try {
      const res = await groomingAPI.getOne(item.id);
      setSelectedItem(res.data);
    } catch {
      toast.error('Failed to load details');
    }
  };

  // Board grouping by status
  const statusColumns = activeTab === 'ready'
    ? [{ key: 'ready_for_sprint', label: '✅ Ready for Sprint', color: '#10B981' }]
    : [
        { key: 'draft', label: '✏️ Draft', color: '#6B7280' },
        { key: 'team_lead_review', label: '👤 Team Lead', color: '#3B82F6' },
        { key: 'stakeholder_signoff', label: '✍️ Stakeholder', color: '#8B5CF6' },
        { key: 'uiux_review', label: '🎨 UI/UX', color: '#EC4899' },
        { key: 'manager_review', label: '🏢 Manager', color: '#F59E0B' },
        { key: 'ready_for_sprint', label: '✅ Ready', color: '#10B981' },
      ];

  return (
    <div className="grooming-hub">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🌱 Grooming HUB</h1>
          <p className="page-subtitle">Manage and groom requirements through the approval workflow</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>⊞ Board</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ List</button>
          </div>
          {canCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Requirement</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          All Requirements
        </button>
        <button className={`tab-btn ${activeTab === 'ready' ? 'active' : ''}`} onClick={() => setActiveTab('ready')}>
          ✅ Ready for Sprint <span className="tab-badge">{stats?.ready_for_sprint || 0}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          className="filter-input"
          placeholder="🔍 Search requirements..."
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
        />
        {activeTab !== 'ready' && (
          <select className="filter-select" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
        <select className="filter-select" value={filters.priority} onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}>
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-skeleton">
          {[1,2,3,4].map(i => <div key={i} className="skeleton-card" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌱</div>
          <h3>No requirements found</h3>
          <p>{canCreate ? 'Create your first requirement to get started.' : 'No requirements match your filters.'}</p>
          {canCreate && <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Requirement</button>}
        </div>
      ) : view === 'board' ? (
        <div className="grooming-board">
          {statusColumns.map(col => {
            const colItems = items.filter(i => i.status === col.key);
            return (
              <div key={col.key} className="board-column">
                <div className="column-header" style={{ borderTopColor: col.color }}>
                  <span>{col.label}</span>
                  <span className="column-count">{colItems.length}</span>
                </div>
                <div className="column-cards">
                  {colItems.length === 0
                    ? <div className="column-empty">No items</div>
                    : colItems.map(item => (
                        <GroomingCard key={item.id} item={item} onClick={openDetail} />
                      ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grooming-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Module</th>
                <th>Status</th>
                <th>Story Pts</th>
                <th>Due Date</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const stageIdx = STAGES.findIndex(s => s.key === item.status);
                const progress = item.status === 'ready_for_sprint' ? 4 :
                  item.status === 'draft' ? 0 :
                  item.status === 'rejected' ? 0 : stageIdx;
                return (
                  <tr key={item.id} onClick={() => openDetail(item)} className="table-row-hover">
                    <td><span className="table-id">{item.req_id}</span></td>
                    <td className="table-title">{item.title}</td>
                    <td><PriorityBadge priority={item.priority} /></td>
                    <td>{item.module || '—'}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="text-center">{item.story_points || '—'}</td>
                    <td>{fmtDate(item.due_date)}</td>
                    <td>
                      <div className="mini-progress">
                        <div className="mini-bar">
                          <div className="mini-fill" style={{ width: `${(progress / 4) * 100}%` }} />
                        </div>
                        <span>{progress}/4</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          projectId={currentProject?.id}
        />
      )}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onReview={handleReview}
          onSubmit={handleSubmit}
          canReview={canReview}
          currentUserRole={user?.role}
        />
      )}
    </div>
  );
}
