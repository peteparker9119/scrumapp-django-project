import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';
import './AdminUsers.css';

const ROLES = ['admin', 'product_manager', 'scrum_master', 'developer'];
const ROLE_COLORS = {
  admin: { bg: '#EDE9FE', color: '#4C1D95' },
  product_manager: { bg: '#EDE9FE', color: '#7C3AED' },
  scrum_master: { bg: '#CFFAFE', color: '#164E63' },
  developer: { bg: '#D1FAE5', color: '#065F46' },
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'developer' });

  const load = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createUser(form);
      toast.success('User created!');
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'developer' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleRoleChange = async (id, role) => {
    try {
      const user = users.find(u => u.id === id);
      await adminAPI.updateUser(id, { role, status: user.status || 'active' });
      toast.success('Role updated');
      load();
    } catch { toast.error('Failed to update role'); }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await adminAPI.updateUser(user.id, { role: user.role, status: newStatus });
      toast.success(`User ${newStatus}`);
      load();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      await adminAPI.deleteUser(id);
      toast.success('User deleted');
      load();
    } catch { toast.error('Failed to delete user'); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="admin-users">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{users.length} total users</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>

      <div className="card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const rc = ROLE_COLORS[user.role] || { bg: '#F3F4F6', color: '#374151' };
              return (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm" style={{ background: rc.color }}>{user.name?.[0]?.toUpperCase()}</div>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="text-muted">{user.email}</td>
                  <td>
                    <select
                      className="role-select"
                      style={{ background: rc.bg, color: rc.color }}
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    {user.emp_code ? (
                      <span className="text-sm">
                        <strong>{user.emp_code}</strong> · {user.department}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`status-toggle ${user.status === 'active' ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.status === 'active' ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td className="text-sm text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleDelete(user.id)} title="Delete user">🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New User</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="john@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-control" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Min 8 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
