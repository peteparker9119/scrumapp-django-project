import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { retroAPI, sprintAPI, authAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import './Retrospective.css';

const COLUMNS = [
  { key: 'went_well',    label: '✅ Went Well',          color: '#10B981', bg: '#ECFDF5', border: '#6EE7B7' },
  { key: 'improvement',  label: '🔧 Needs Improvement',  color: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D' },
  { key: 'action_item',  label: '🎯 Action Items',        color: '#6366F1', bg: '#EEF2FF', border: '#A5B4FC' },
];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function AddCardInline({ onAdd, col, users }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const isAction = col.key === 'action_item';

  const submit = () => {
    if (!content.trim()) return;
    onAdd(col.key, content, assignedTo || null, dueDate || null);
    setContent(''); setAssignedTo(''); setDueDate('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="retro-add-btn" onClick={() => setOpen(true)} style={{ borderColor: col.border }}>
        + Add card
      </button>
    );
  }

  return (
    <div className="retro-add-card" style={{ borderColor: col.border }}>
      <textarea
        autoFocus
        className="retro-add-textarea"
        placeholder={isAction ? 'What action should we take?' : col.key === 'went_well' ? 'What went well this sprint?' : 'What can we improve?'}
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit(); if (e.key === 'Escape') setOpen(false); }}
        rows={3}
      />
      {isAction && (
        <div className="retro-add-extras">
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="retro-mini-select">
            <option value="">— Owner —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="retro-mini-date" />
        </div>
      )}
      <div className="retro-add-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setOpen(false); setContent(''); }}>Cancel</button>
        <span className="retro-add-hint">Ctrl+Enter to save</span>
      </div>
    </div>
  );
}

function RetroCard({ item, col, onVote, onDelete, onUpdate, users, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editAssignee, setEditAssignee] = useState(item.assigned_to || '');
  const [editDue, setEditDue] = useState(item.due_date ? item.due_date.split('T')[0] : '');
  const isAction = col.key === 'action_item';
  const isDone = item.status === 'done';

  const saveEdit = () => {
    if (!editContent.trim()) return;
    onUpdate(item.id, { content: editContent, assigned_to: editAssignee || null, due_date: editDue || null, status: item.status });
    setEditing(false);
  };

  return (
    <div className={`retro-card ${isDone ? 'retro-card-done' : ''}`} style={{ borderLeftColor: col.color }}>
      {editing ? (
        <div className="retro-edit-form">
          <textarea className="retro-add-textarea" value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} autoFocus />
          {isAction && (
            <div className="retro-add-extras">
              <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} className="retro-mini-select">
                <option value="">— Owner —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} className="retro-mini-date" />
            </div>
          )}
          <div className="retro-add-actions">
            <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="retro-card-content" onDoubleClick={() => setEditing(true)}>{item.content}</div>
          {isAction && (
            <div className="retro-card-meta">
              {item.assignee_name && <span className="retro-meta-tag">👤 {item.assignee_name}</span>}
              {item.due_date && <span className="retro-meta-tag">📅 {fmtDate(item.due_date)}</span>}
              <button
                className={`retro-status-btn ${isDone ? 'done' : ''}`}
                onClick={() => onUpdate(item.id, { content: item.content, assigned_to: item.assigned_to, due_date: item.due_date, status: isDone ? 'open' : 'done' })}
              >
                {isDone ? '✅ Done' : '⬜ Mark Done'}
              </button>
            </div>
          )}
          <div className="retro-card-footer">
            <span className="retro-author">{item.created_by_name}</span>
            <div className="retro-card-actions">
              <button
                className={`retro-vote-btn ${item.user_voted ? 'voted' : ''}`}
                onClick={() => onVote(item.id)}
                title={item.user_voted ? 'Remove vote' : 'Upvote'}
              >
                👍 <span>{item.vote_count || 0}</span>
              </button>
              <button className="retro-icon-btn" onClick={() => setEditing(true)} title="Edit">✏</button>
              {canDelete && (
                <button className="retro-icon-btn danger" onClick={() => onDelete(item.id)} title="Delete">🗑</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Retrospective() {
  const { currentProject } = useProject();
  const { user, hasRole } = useAuth();
  const [sprints, setSprints] = useState([]);
  const [retros, setRetros] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [retro, setRetro] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRetro, setLoadingRetro] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const canManage = hasRole('admin', 'scrum_master');

  const loadBase = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [sRes, rRes, uRes] = await Promise.all([
        sprintAPI.getAll({ project_id: currentProject.id }),
        retroAPI.getAll({ project_id: currentProject.id }),
        authAPI.getUsers(),
      ]);
      setSprints(sRes.data);
      setRetros(rRes.data);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [currentProject]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const loadRetro = useCallback(async (retroId) => {
    setLoadingRetro(true);
    try {
      const res = await retroAPI.getOne(retroId);
      setRetro(res.data);
    } catch { toast.error('Failed to load retrospective'); }
    finally { setLoadingRetro(false); }
  }, []);

  const handleSprintSelect = async (sprintId) => {
    setSelectedSprintId(sprintId);
    setRetro(null);
    if (!sprintId) return;

    // Check if retro exists for this sprint
    const existing = retros.find(r => r.sprint_id === Number(sprintId));
    if (existing) {
      loadRetro(existing.id);
    } else {
      // Create new retro
      try {
        const sprint = sprints.find(s => s.id === Number(sprintId));
        const res = await retroAPI.getOrCreate({ sprint_id: Number(sprintId), project_id: currentProject.id });
        await loadRetro(res.data.id);
        if (res.data.created) {
          setRetros(prev => [...prev, { id: res.data.id, sprint_id: Number(sprintId), sprint_name: sprint?.name }]);
        }
      } catch { toast.error('Failed to create retrospective'); }
    }
  };

  const handleAddItem = async (category, content, assignedTo, dueDate) => {
    if (!retro) return;
    try {
      const res = await retroAPI.addItem(retro.id, { category, content, assigned_to: assignedTo, due_date: dueDate });
      setRetro(prev => ({ ...prev, items: [...(prev.items || []), res.data] }));
    } catch { toast.error('Failed to add item'); }
  };

  const handleVote = async (itemId) => {
    if (!retro) return;
    try {
      const res = await retroAPI.voteItem(retro.id, itemId);
      setRetro(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId
          ? { ...i, user_voted: res.data.voted ? 1 : 0, vote_count: i.vote_count + (res.data.voted ? 1 : -1) }
          : i
        ),
      }));
    } catch { toast.error('Failed to vote'); }
  };

  const handleDelete = async (itemId) => {
    if (!retro) return;
    try {
      await retroAPI.deleteItem(retro.id, itemId);
      setRetro(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
    } catch { toast.error('Failed to delete'); }
  };

  const handleUpdate = async (itemId, data) => {
    if (!retro) return;
    try {
      await retroAPI.updateItem(retro.id, itemId, data);
      setRetro(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, ...data, assignee_name: users.find(u => u.id === Number(data.assigned_to))?.name || i.assignee_name } : i),
      }));
    } catch { toast.error('Failed to update'); }
  };

  const handlePublish = async () => {
    if (!retro || retro.status === 'published') return;
    setPublishing(true);
    try {
      await retroAPI.publish(retro.id);
      setRetro(prev => ({ ...prev, status: 'published' }));
      toast.success('Retrospective published!');
    } catch { toast.error('Failed to publish'); }
    finally { setPublishing(false); }
  };

  const isPublished = retro?.status === 'published';

  if (!currentProject) return (
    <div>
      <h1 className="page-title">Retrospective</h1>
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', marginTop: 20 }}>
        Please select a project from the Dashboard first.
      </div>
    </div>
  );

  return (
    <div className="retro-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🔄 Retrospective</h1>
          <p className="page-subtitle">{currentProject.name} · Reflect, improve, act</p>
        </div>
        {retro && canManage && !isPublished && (
          <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publishing...' : '📢 Publish Retro'}
          </button>
        )}
        {isPublished && <span className="badge badge-completed" style={{ fontSize: 13, padding: '6px 14px' }}>✅ Published</span>}
      </div>

      {/* Sprint Picker */}
      <div className="retro-sprint-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontWeight: 600, fontSize: 14 }}>Sprint:</label>
          <select
            className="form-control"
            style={{ width: 280 }}
            value={selectedSprintId}
            onChange={e => handleSprintSelect(e.target.value)}
          >
            <option value="">— Select a sprint —</option>
            {sprints.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status}) {retros.find(r => r.sprint_id === s.id) ? '· has retro' : ''}
              </option>
            ))}
          </select>
        </div>

        {retro && (
          <div className="retro-sprint-info">
            <span>📅 {fmtDate(retro.start_date)} → {fmtDate(retro.end_date)}</span>
            {retro.sprint_goal && <span>🎯 {retro.sprint_goal}</span>}
            <span className="retro-item-count">{retro.items?.length || 0} items</span>
          </div>
        )}
      </div>

      {/* Board */}
      {!selectedSprintId ? (
        <div className="retro-empty-state">
          <div style={{ fontSize: 48 }}>🔄</div>
          <h3>Select a sprint to start or view a retrospective</h3>
          <p>Retrospectives help your team learn and improve each sprint.</p>
        </div>
      ) : loadingRetro ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : retro ? (
        <div className="retro-board">
          {COLUMNS.map(col => {
            const colItems = (retro.items || []).filter(i => i.category === col.key);
            const sortedItems = [...colItems].sort((a, b) => b.votes - a.votes);

            return (
              <div key={col.key} className="retro-column">
                <div className="retro-col-header" style={{ background: col.bg, borderColor: col.border }}>
                  <span className="retro-col-title" style={{ color: col.color }}>{col.label}</span>
                  <span className="retro-col-count" style={{ background: col.color }}>{colItems.length}</span>
                </div>

                <div className="retro-col-body">
                  {sortedItems.map(item => (
                    <RetroCard
                      key={item.id}
                      item={item}
                      col={col}
                      onVote={handleVote}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                      users={users}
                      canDelete={canManage || item.created_by === user?.id}
                    />
                  ))}

                  {!isPublished && (
                    <AddCardInline onAdd={handleAddItem} col={col} users={users} />
                  )}

                  {isPublished && colItems.length === 0 && (
                    <div className="retro-col-empty">No items</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Retro List (sidebar strip) */}
      {retros.length > 0 && (
        <div className="retro-history">
          <div className="retro-history-title">Past Retrospectives</div>
          <div className="retro-history-list">
            {retros.map(r => (
              <div
                key={r.id}
                className={`retro-history-item ${selectedSprintId === String(r.sprint_id) ? 'active' : ''}`}
                onClick={() => handleSprintSelect(String(r.sprint_id))}
              >
                <span className="rhi-sprint">{r.sprint_name}</span>
                <span className={`badge badge-${r.status}`}>{r.status}</span>
                {r.open_actions > 0 && <span className="rhi-actions">{r.open_actions} actions</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
