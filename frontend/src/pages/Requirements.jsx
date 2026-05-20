import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { requirementAPI, authAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import './Requirements.css';

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['draft', 'review', 'approved', 'rejected', 'converted'];
const ITEM_TYPES = [
  { value: 'feature', label: 'Feature', color: '#4F46E5', icon: '✦' },
  { value: 'bug', label: 'Bug', color: '#EF4444', icon: '🐛' },
  { value: 'enhancement', label: 'Enhancement', color: '#F59E0B', icon: '⚡' },
  { value: 'task', label: 'Task', color: '#10B981', icon: '✓' },
  { value: 'epic', label: 'Epic', color: '#7C3AED', icon: '⬡' },
];

const emptyForm = {
  title: '', description: '', acceptance_criteria: '',
  priority: 'medium', item_type: 'feature', status: 'draft',
  due_date: '', estimated_hours: '', module: '', external_ref: '',
  assignee_id: '', tags: [], watchers: []
};

function CriteriaSection({ reqId, criteria, onUpdate, canEdit }) {
  const [local, setLocal] = useState(criteria || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(criteria || {}); }, [criteria]);

  const toggle = async (field) => {
    if (!canEdit) return;
    const val = !local[field];
    setLocal(prev => ({ ...prev, [field]: val }));
    try {
      await requirementAPI.updateCriteria(reqId, { [field]: val });
      if (onUpdate) onUpdate();
    } catch { toast.error('Failed to update criteria'); }
  };

  const saveComment = async (field) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await requirementAPI.updateCriteria(reqId, { [field]: local[field] });
      toast.success('Comment saved');
      const res = await requirementAPI.getCriteria(reqId);
      setLocal(res.data);
      if (onUpdate) onUpdate();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const met = [
    local.stakeholder_email_sent && local.stakeholder_email_confirmed,
    local.wireframe_uploaded && local.wireframe_confirmed,
    !!local.tl_comment,
    !!local.manager_comment
  ].filter(Boolean).length;

  return (
    <div className="criteria-section">
      <div className="criteria-header">
        <span className="criteria-title">Requirement Criteria</span>
        <div className="criteria-progress-wrap">
          <div className="criteria-progress-bar">
            <div className="criteria-progress-fill" style={{ width: `${(met / 4) * 100}%` }} />
          </div>
          <span className="criteria-count">{met}/4</span>
        </div>
        {local.all_criteria_met && (
          <span className="badge-ready">✓ Ready for Sprint</span>
        )}
      </div>

      <div className="criteria-grid">
        {/* Stakeholder Email */}
        <div className="criteria-item">
          <div className="criteria-item-title">1. Stakeholder Email</div>
          <div className="criteria-toggles">
            <button
              className={`criteria-toggle ${local.stakeholder_email_sent ? 'active' : ''}`}
              onClick={() => toggle('stakeholder_email_sent')}
              disabled={!canEdit}
            >Sent</button>
            <button
              className={`criteria-toggle ${local.stakeholder_email_confirmed ? 'active success' : ''}`}
              onClick={() => toggle('stakeholder_email_confirmed')}
              disabled={!canEdit}
            >Confirmed</button>
          </div>
        </div>

        {/* Wireframe */}
        <div className="criteria-item">
          <div className="criteria-item-title">2. Wireframe</div>
          <div className="criteria-toggles">
            <button
              className={`criteria-toggle ${local.wireframe_uploaded ? 'active' : ''}`}
              onClick={() => toggle('wireframe_uploaded')}
              disabled={!canEdit}
            >Uploaded</button>
            <button
              className={`criteria-toggle ${local.wireframe_confirmed ? 'active success' : ''}`}
              onClick={() => toggle('wireframe_confirmed')}
              disabled={!canEdit}
            >Confirmed</button>
          </div>
        </div>

        {/* TL Comment */}
        <div className="criteria-item criteria-comment">
          <div className="criteria-item-title">3. TL Comment {local.tl_commented_at && <span className="criteria-ts">{new Date(local.tl_commented_at).toLocaleString()}</span>}</div>
          <div className="criteria-comment-row">
            <textarea
              className="form-control"
              rows={2}
              value={local.tl_comment || ''}
              onChange={e => setLocal(prev => ({ ...prev, tl_comment: e.target.value }))}
              disabled={!canEdit}
              placeholder="TL comment..."
            />
            {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => saveComment('tl_comment')} disabled={saving}>Save</button>}
          </div>
        </div>

        {/* Manager Comment */}
        <div className="criteria-item criteria-comment">
          <div className="criteria-item-title">4. Manager Comment {local.manager_commented_at && <span className="criteria-ts">{new Date(local.manager_commented_at).toLocaleString()}</span>}</div>
          <div className="criteria-comment-row">
            <textarea
              className="form-control"
              rows={2}
              value={local.manager_comment || ''}
              onChange={e => setLocal(prev => ({ ...prev, manager_comment: e.target.value }))}
              disabled={!canEdit}
              placeholder="Manager comment..."
            />
            {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => saveComment('manager_comment')} disabled={saving}>Save</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Requirements() {
  const { currentProject } = useProject();
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [comment, setComment] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState('');
  const [watcherEmail, setWatcherEmail] = useState('');

  const load = async () => {
    try {
      const params = {};
      if (currentProject) params.project_id = currentProject.id;
      const [rRes, uRes] = await Promise.all([
        requirementAPI.getAll(params),
        authAPI.getUsers()
      ]);
      setItems(rRes.data);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load requirements'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentProject]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentProject) return toast.error('Please select a project first');
    try {
      await requirementAPI.create({ ...form, project_id: currentProject.id });
      toast.success('Requirement created!');
      setShowModal(false);
      setForm(emptyForm);
      setTagInput('');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await requirementAPI.update(selected.id, {
        title: selected.title, description: selected.description,
        acceptance_criteria: selected.acceptance_criteria,
        priority: selected.priority, status: selected.status,
        item_type: selected.item_type, due_date: selected.due_date,
        estimated_hours: selected.estimated_hours, module: selected.module,
        external_ref: selected.external_ref, assignee_id: selected.assignee_id,
        tags: selected.tags || []
      });
      toast.success('Updated!');
      setSelected(null);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const handleApprove = async (id, status) => {
    try {
      await requirementAPI.approve(id, { status });
      toast.success(`Requirement ${status}!`);
      setSelected(null);
      load();
    } catch { toast.error('Failed'); }
  };

  const handleConvert = async (id) => {
    try {
      await requirementAPI.convert(id);
      toast.success('Converted to backlog item!');
      setSelected(null);
      load();
    } catch { toast.error('Failed to convert'); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await requirementAPI.addComment(selected.id, { content: comment });
      toast.success('Comment added!');
      setComment('');
      const res = await requirementAPI.getOne(selected.id);
      setSelected(res.data);
    } catch { toast.error('Failed'); }
  };

  const handleAddWatcher = async () => {
    if (!watcherEmail.trim()) return;
    try {
      await requirementAPI.addWatcher(selected.id, { email: watcherEmail.trim(), watcher_type: 'stakeholder' });
      toast.success('Watcher added!');
      setWatcherEmail('');
      const res = await requirementAPI.getOne(selected.id);
      setSelected(res.data);
    } catch { toast.error('Failed to add watcher'); }
  };

  const openDetail = async (id) => {
    try {
      const res = await requirementAPI.getOne(id);
      setSelected(res.data);
    } catch { toast.error('Failed to load details'); }
  };

  const addTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().replace(',', '');
      if (tag && !form.tags.includes(tag)) {
        setForm(f => ({ ...f, tags: [...f.tags, tag] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

  const addTagSelected = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().replace(',', '');
      if (tag && !(selected.tags || []).includes(tag)) {
        setSelected(s => ({ ...s, tags: [...(s.tags || []), tag] }));
      }
      setTagInput('');
    }
  };

  const removeTagSelected = (tag) => setSelected(s => ({ ...s, tags: (s.tags || []).filter(t => t !== tag) }));

  const getTypeInfo = (type) => ITEM_TYPES.find(t => t.value === type) || ITEM_TYPES[0];

  let filtered = items;
  if (filterStatus) filtered = filtered.filter(i => i.status === filterStatus);
  if (filterType) filtered = filtered.filter(i => i.item_type === filterType);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Requirements</h1>
          <p className="page-subtitle">Product Manager workspace — {filtered.length} requirement{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <select className="form-control" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasRole('admin', 'product_manager', 'scrum_master') && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Requirement</button>
          )}
        </div>
      </div>

      {!currentProject && (
        <div className="req-no-project card">📁 Please select a project from the Dashboard first.</div>
      )}

      <div className="req-list">
        {filtered.map(item => {
          const typeInfo = getTypeInfo(item.item_type);
          return (
            <div key={item.id} className="req-card card" onClick={() => openDetail(item.id)}>
              <div className="req-card-header">
                <div className="flex items-center gap-2">
                  <span className="req-type-badge" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
                    {typeInfo.icon} {typeInfo.label}
                  </span>
                  <span className={`badge badge-${item.priority}`}>{item.priority}</span>
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                </div>
                <span className="text-sm text-muted">#{item.id}</span>
              </div>
              <div className="req-title">{item.title}</div>
              {item.description && <div className="req-desc">{item.description}</div>}
              <div className="req-tags-row">
                {(item.tags || []).map(tag => (
                  <span key={tag} className="req-tag">{tag}</span>
                ))}
              </div>
              <div className="req-footer">
                <span>By {item.creator_name}</span>
                {item.assignee_name && <span>· Assigned: {item.assignee_name}</span>}
                {item.due_date && <span>· Due: {new Date(item.due_date).toLocaleDateString()}</span>}
                <span>· {new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No requirements found. Create your first requirement!
          </div>
        )}
      </div>

      {/* Create Modal - Zoho Style */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal req-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Requirement</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body req-modal-body">
                {/* Header row */}
                <div className="req-modal-header-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Title *</label>
                    <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="Requirement title..." />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Item Type</label>
                    <select className="form-control" value={form.item_type} onChange={e => setForm({...form, item_type: e.target.value})}>
                      {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-control" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="req-modal-columns">
                  {/* Left - Details */}
                  <div className="req-modal-left">
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detailed description..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Acceptance Criteria</label>
                      <textarea className="form-control" rows={3} value={form.acceptance_criteria} onChange={e => setForm({...form, acceptance_criteria: e.target.value})} placeholder="Given/When/Then..." />
                    </div>
                    <div className="flex gap-3">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Module</label>
                        <input className="form-control" value={form.module} onChange={e => setForm({...form, module: e.target.value})} placeholder="e.g. Auth" />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">External Ref</label>
                        <input className="form-control" value={form.external_ref} onChange={e => setForm({...form, external_ref: e.target.value})} placeholder="Zoho ID / Jira ref" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Due Date</label>
                        <input type="date" className="form-control" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Estimated Hours</label>
                        <input type="number" step="0.5" className="form-control" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} placeholder="e.g. 8" />
                      </div>
                    </div>
                  </div>

                  {/* Right - Sidebar */}
                  <div className="req-modal-right">
                    <div className="form-group">
                      <label className="form-label">Assignee</label>
                      <select className="form-control" value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})}>
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tags <span className="text-muted">(Enter or comma)</span></label>
                      <div className="tags-input-wrap">
                        {form.tags.map(tag => (
                          <span key={tag} className="req-tag removable">
                            {tag} <button type="button" onClick={() => removeTag(tag)}>×</button>
                          </span>
                        ))}
                        <input
                          className="tags-input"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={addTag}
                          placeholder="Add tag..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Requirement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail/Edit Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal req-modal-wide req-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                {(() => { const t = getTypeInfo(selected.item_type); return <span className="req-type-badge" style={{ background: t.color + '20', color: t.color }}>{t.icon} {t.label}</span>; })()}
                <h2 className="modal-title">Requirement #{selected.id}</h2>
              </div>
              <div className="flex gap-2">
                <span className={`badge badge-${selected.status}`}>{selected.status}</span>
                <button className="btn-icon" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body req-modal-body">
                {/* Header row */}
                <div className="req-modal-header-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Title</label>
                    <input className="form-control" value={selected.title} onChange={e => setSelected({...selected, title: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Item Type</label>
                    <select className="form-control" value={selected.item_type || 'feature'} onChange={e => setSelected({...selected, item_type: e.target.value})}>
                      {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-control" value={selected.priority} onChange={e => setSelected({...selected, priority: e.target.value})}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={selected.status} onChange={e => setSelected({...selected, status: e.target.value})}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="req-modal-columns">
                  {/* Left */}
                  <div className="req-modal-left">
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={4} value={selected.description || ''} onChange={e => setSelected({...selected, description: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Acceptance Criteria</label>
                      <textarea className="form-control" rows={3} value={selected.acceptance_criteria || ''} onChange={e => setSelected({...selected, acceptance_criteria: e.target.value})} />
                    </div>
                    <div className="flex gap-3">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Module</label>
                        <input className="form-control" value={selected.module || ''} onChange={e => setSelected({...selected, module: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">External Ref</label>
                        <input className="form-control" value={selected.external_ref || ''} onChange={e => setSelected({...selected, external_ref: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Due Date</label>
                        <input type="date" className="form-control" value={selected.due_date ? selected.due_date.split('T')[0] : ''} onChange={e => setSelected({...selected, due_date: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Estimated Hours</label>
                        <input type="number" step="0.5" className="form-control" value={selected.estimated_hours || ''} onChange={e => setSelected({...selected, estimated_hours: e.target.value})} />
                      </div>
                    </div>

                    {/* Criteria Section */}
                    <CriteriaSection
                      reqId={selected.id}
                      criteria={selected.criteria}
                      onUpdate={() => requirementAPI.getOne(selected.id).then(r => setSelected(r.data))}
                      canEdit={hasRole('admin', 'product_manager', 'scrum_master', 'developer')}
                    />

                    {/* Actions */}
                    <div className="req-actions">
                      {hasRole('admin', 'scrum_master') && selected.status === 'review' && (
                        <>
                          <button type="button" className="btn btn-success btn-sm" onClick={() => handleApprove(selected.id, 'approved')}>✓ Approve</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleApprove(selected.id, 'rejected')}>✕ Reject</button>
                        </>
                      )}
                      {selected.status === 'approved' && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleConvert(selected.id)}>→ Convert to Backlog</button>
                      )}
                    </div>

                    {/* Comments */}
                    <div>
                      <div className="form-label mb-2">Comments ({selected.comments?.length || 0})</div>
                      <div className="comments-list">
                        {selected.comments?.map((c, i) => (
                          <div key={i} className="comment-item">
                            <strong>{c.author}</strong>: {c.content}
                            <span className="text-sm text-muted" style={{ marginLeft: 8 }}>{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <form onSubmit={handleComment} className="flex gap-2 mt-2">
                        <input className="form-control" value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." />
                        <button type="submit" className="btn btn-secondary btn-sm">Post</button>
                      </form>
                    </div>
                  </div>

                  {/* Right Sidebar */}
                  <div className="req-modal-right">
                    <div className="form-group">
                      <label className="form-label">Assignee</label>
                      <select className="form-control" value={selected.assignee_id || ''} onChange={e => setSelected({...selected, assignee_id: e.target.value})}>
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reporter</label>
                      <div className="req-reporter">{selected.creator_name}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tags</label>
                      <div className="tags-input-wrap">
                        {(selected.tags || []).map(tag => (
                          <span key={tag} className="req-tag removable">
                            {tag} <button type="button" onClick={() => removeTagSelected(tag)}>×</button>
                          </span>
                        ))}
                        <input
                          className="tags-input"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={addTagSelected}
                          placeholder="Add tag..."
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Watchers / Stakeholders</label>
                      <div className="watchers-list">
                        {(selected.watchers || []).map((w, i) => (
                          <div key={i} className="watcher-item">
                            <span className={`watcher-badge ${w.watcher_type}`}>{w.watcher_type === 'stakeholder' ? '⭐' : '👁'}</span>
                            <span>{w.user_name || w.email}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <input className="form-control" value={watcherEmail} onChange={e => setWatcherEmail(e.target.value)} placeholder="Email address..." />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddWatcher}>+ Add</button>
                      </div>
                    </div>

                    {/* Attachments */}
                    {selected.attachments?.length > 0 && (
                      <div className="form-group">
                        <label className="form-label">Attachments</label>
                        {selected.attachments.map((a, i) => (
                          <div key={i} className="attachment-item">
                            <span>📎 {a.file_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
