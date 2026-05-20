import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { backlogAPI, authAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import './Backlog.css';

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const TYPES = ['story', 'bug', 'task', 'epic'];
const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

const TYPE_ICONS = { story: '📖', bug: '🐛', task: '✅', epic: '⚡' };

export default function Backlog() {
  const { currentProject } = useProject();
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', acceptance_criteria: '',
    story_points: '', priority: 'medium', item_type: 'story', assigned_to: ''
  });

  const load = async () => {
    try {
      const params = {};
      if (currentProject) params.project_id = currentProject.id;
      if (filterStatus) params.status = filterStatus;
      const [bRes, uRes] = await Promise.all([backlogAPI.getAll(params), authAPI.getUsers()]);
      setItems(bRes.data);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load backlog'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentProject, filterStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentProject) return toast.error('Please select a project first');
    try {
      await backlogAPI.create({ ...form, project_id: currentProject.id, story_points: form.story_points || null, assigned_to: form.assigned_to || null });
      toast.success('Backlog item created!');
      setShowModal(false);
      setForm({ title: '', description: '', acceptance_criteria: '', story_points: '', priority: 'medium', item_type: 'story', assigned_to: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await backlogAPI.update(selected.id, {
        title: selected.title, description: selected.description,
        acceptance_criteria: selected.acceptance_criteria,
        story_points: selected.story_points, priority: selected.priority,
        status: selected.status, item_type: selected.item_type,
        assigned_to: selected.assigned_to || null
      });
      toast.success('Updated!');
      setSelected(null);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this backlog item?')) return;
    try {
      await backlogAPI.remove(id);
      toast.success('Deleted!');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const openDetail = async (id) => {
    try {
      const res = await backlogAPI.getOne(id);
      setSelected(res.data);
    } catch { toast.error('Failed to load'); }
  };

  const filtered = filterType ? items.filter(i => i.item_type === filterType) : items;

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Backlog</h1>
          <p className="page-subtitle">{filtered.length} item{filtered.length !== 1 ? 's' : ''}{currentProject ? ` in ${currentProject.name}` : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="form-control" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="ready">Ready</option>
            <option value="in_sprint">In Sprint</option>
            <option value="done">Done</option>
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Item</button>
        </div>
      </div>

      <div className="backlog-table card">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Points</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="backlog-row">
                <td><span className="type-icon">{TYPE_ICONS[item.item_type]}</span><span className={`badge badge-${item.item_type}`}>{item.item_type}</span></td>
                <td className="backlog-title" onClick={() => openDetail(item.id)}>{item.title}</td>
                <td><span className={`badge badge-${item.priority}`}>{item.priority}</span></td>
                <td><span className="points-badge">{item.story_points ?? '—'}</span></td>
                <td><span className={`status-dot status-${item.status}`}>{item.status?.replace('_', ' ')}</span></td>
                <td className="text-muted">{item.assignee_name || '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-icon" title="Edit" onClick={() => openDetail(item.id)}>✏️</button>
                    {hasRole('admin', 'scrum_master', 'product_manager') && (
                      <button className="btn-icon" title="Delete" onClick={() => handleDelete(item.id)}>🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No backlog items. Add your first one!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Backlog Item</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="As a user, I want to..." />
                </div>
                <div className="flex gap-3">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Type</label>
                    <select className="form-control" value={form.item_type} onChange={e => setForm({...form, item_type: e.target.value})}>
                      {TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Priority</label>
                    <select className="form-control" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Story Points</label>
                    <select className="form-control" value={form.story_points} onChange={e => setForm({...form, story_points: e.target.value})}>
                      <option value="">—</option>
                      {STORY_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <select className="form-control" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Acceptance Criteria</label>
                  <textarea className="form-control" rows={2} value={form.acceptance_criteria} onChange={e => setForm({...form, acceptance_criteria: e.target.value})} placeholder="Given/When/Then..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add to Backlog</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail/Edit Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{TYPE_ICONS[selected.item_type]} #{selected.id}</h2>
              <button className="btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={selected.title} onChange={e => setSelected({...selected, title: e.target.value})} />
                </div>
                <div className="flex gap-3">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Type</label>
                    <select className="form-control" value={selected.item_type} onChange={e => setSelected({...selected, item_type: e.target.value})}>
                      {TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Priority</label>
                    <select className="form-control" value={selected.priority} onChange={e => setSelected({...selected, priority: e.target.value})}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Story Points</label>
                    <select className="form-control" value={selected.story_points || ''} onChange={e => setSelected({...selected, story_points: e.target.value || null})}>
                      <option value="">—</option>
                      {STORY_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Status</label>
                    <select className="form-control" value={selected.status} onChange={e => setSelected({...selected, status: e.target.value})}>
                      <option value="backlog">Backlog</option>
                      <option value="ready">Ready</option>
                      <option value="in_sprint">In Sprint</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Assignee</label>
                    <select className="form-control" value={selected.assigned_to || ''} onChange={e => setSelected({...selected, assigned_to: e.target.value || null})}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} value={selected.description || ''} onChange={e => setSelected({...selected, description: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Acceptance Criteria</label>
                  <textarea className="form-control" rows={2} value={selected.acceptance_criteria || ''} onChange={e => setSelected({...selected, acceptance_criteria: e.target.value})} />
                </div>
                {selected.tasks?.length > 0 && (
                  <div>
                    <div className="form-label mb-2">Sub-tasks</div>
                    {selected.tasks.map(t => (
                      <div key={t.id} className="subtask-item">
                        <span className={`status-dot status-${t.status}`}>{t.title}</span>
                        <span className="text-sm text-muted">{t.assignee_name || 'Unassigned'}</span>
                      </div>
                    ))}
                  </div>
                )}
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
