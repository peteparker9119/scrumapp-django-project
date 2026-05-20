import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { projectAPI, authAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import './Projects.css';

export default function Projects() {
  const { hasRole } = useAuth();
  const { currentProject, selectProject } = useProject();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [memberModal, setMemberModal] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', key_code: '' });
  const [memberForm, setMemberForm] = useState({ user_id: '', role: 'developer' });

  const load = async () => {
    try {
      const [pRes, uRes] = await Promise.all([projectAPI.getAll(), authAPI.getUsers()]);
      setProjects(pRes.data);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load projects'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await projectAPI.create(form);
      toast.success('Project created!');
      setShowModal(false);
      setForm({ name: '', description: '', key_code: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create project'); }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await projectAPI.addMember(memberModal.id, memberForm);
      toast.success('Member added!');
      setMemberModal(null);
      setMemberForm({ user_id: '', role: 'developer' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add member'); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
      </div>

      <div className="projects-list">
        {projects.map(p => (
          <div key={p.id} className={`project-row card ${currentProject?.id === p.id ? 'selected' : ''}`}>
            <div className="project-row-left">
              <div className="project-key-badge-lg">{p.key_code}</div>
              <div>
                <div className="project-row-name">{p.name}</div>
                <div className="project-row-desc">{p.description || 'No description'}</div>
                <div className="project-row-meta">
                  <span>By {p.creator_name}</span>
                  <span>·</span>
                  <span>{p.backlog_count} backlog items</span>
                  <span>·</span>
                  <span>{p.active_sprints} active sprint(s)</span>
                </div>
              </div>
            </div>
            <div className="project-row-actions">
              <span className={`badge badge-${p.status}`}>{p.status}</span>
              {hasRole('admin', 'scrum_master') && (
                <button className="btn btn-secondary btn-sm" onClick={() => setMemberModal(p)}>Add Member</button>
              )}
              <button
                className={`btn btn-sm ${currentProject?.id === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => selectProject(currentProject?.id === p.id ? null : p)}
              >
                {currentProject?.id === p.id ? '✓ Selected' : 'Select'}
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No projects yet. Create your first project!
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Project</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. E-Commerce Platform" />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Key *</label>
                  <input className="form-control" value={form.key_code} onChange={e => setForm({...form, key_code: e.target.value.toUpperCase().slice(0,10)})} required placeholder="e.g. ECP" maxLength={10} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief project description..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {memberModal && (
        <div className="modal-overlay" onClick={() => setMemberModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Member to {memberModal.name}</h2>
              <button className="btn-icon" onClick={() => setMemberModal(null)}>✕</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">User *</label>
                  <select className="form-control" value={memberForm.user_id} onChange={e => setMemberForm({...memberForm, user_id: e.target.value})} required>
                    <option value="">Select user...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value})}>
                    <option value="developer">Developer</option>
                    <option value="scrum_master">Scrum Master</option>
                    <option value="product_manager">Product Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setMemberModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
