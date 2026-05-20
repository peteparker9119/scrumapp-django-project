import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { employeeMasterAPI } from '../../services/api';
import './AdminEmployees.css';

const PERFORM_IQ_ROLES = ['EMPLOYEE', 'MANAGER', 'CTO'];
const LEVELS = ['L0', 'L1', 'L2', 'L3'];

const emptyForm = {
  emis_user_id: '', name: '', is_lead: 0, scrum_team: '', cohort: '',
  designation: '', phone: '', email: '', role: '', perform_iq_role: 'EMPLOYEE',
  is_manager: 0, is_master_admin: 0, reports_to_emis_id: '', level: 'L2',
  dob: '', address: '', status: 'active'
};

const ROLE_COLORS = {
  MANAGER: '#e0f2fe',
  CTO: '#fef3c7',
  EMPLOYEE: '#f0fdf4',
};
const LEVEL_COLORS = {
  L0: '#7c3aed', L1: '#2563eb', L2: '#059669', L3: '#d97706',
};

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterTeam, setFilterTeam] = useState('');

  const load = async () => {
    try {
      const res = await employeeMasterAPI.getAll();
      setEmployees(res.data);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (emp) => {
    setEditing(emp);
    setShowDetail(null);
    setForm({
      emis_user_id: emp.emis_user_id, name: emp.name, is_lead: emp.is_lead,
      scrum_team: emp.scrum_team || '', cohort: emp.cohort || '',
      designation: emp.designation || '', phone: emp.phone || '',
      email: emp.email, role: emp.role || '',
      perform_iq_role: emp.perform_iq_role, is_manager: emp.is_manager,
      is_master_admin: emp.is_master_admin,
      reports_to_emis_id: emp.reports_to_emis_id || '',
      level: emp.level || 'L2',
      dob: emp.dob ? emp.dob.split('T')[0] : '',
      address: emp.address || '', status: emp.status
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await employeeMasterAPI.update(editing.id, form);
        toast.success('Employee updated!');
      } else {
        await employeeMasterAPI.create(form);
        toast.success('Employee added!');
      }
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this employee from master?')) return;
    try {
      await employeeMasterAPI.remove(id);
      toast.success('Employee removed');
      setShowDetail(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const handleExportCSV = () => {
    const headers = ['emis_user_id','name','designation','role','perform_iq_role','level','scrum_team','cohort','phone','email','is_lead','is_manager','is_master_admin','dob','address','status'];
    const rows = filtered.map(e => headers.map(h => JSON.stringify(e[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'employees_master.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique teams for filter
  const allTeams = [...new Set(
    employees.flatMap(e => e.scrum_team ? e.scrum_team.split(',').map(t => t.trim()) : [])
  )].sort((a, b) => Number(a) - Number(b));

  let filtered = employees;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q) ||
      (e.role || '').toLowerCase().includes(q) ||
      String(e.emis_user_id).includes(q)
    );
  }
  if (filterRole) filtered = filtered.filter(e => e.perform_iq_role === filterRole);
  if (filterLevel) filtered = filtered.filter(e => e.level === filterLevel);
  if (filterTeam) filtered = filtered.filter(e =>
    e.scrum_team && e.scrum_team.split(',').map(t => t.trim()).includes(filterTeam)
  );

  const managers = employees.filter(e => e.is_manager || e.perform_iq_role === 'CTO');

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="admin-employees">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Master</h1>
          <p className="page-subtitle">{filtered.length} of {employees.length} employees · EMIS / HR source of truth</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleExportCSV}>↓ Export CSV</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Employee</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="emp-stats-bar">
        <div className="emp-stat">
          <span className="emp-stat-num">{employees.filter(e => e.perform_iq_role === 'MANAGER').length}</span>
          <span className="emp-stat-lbl">Managers</span>
        </div>
        <div className="emp-stat">
          <span className="emp-stat-num">{employees.filter(e => e.is_lead).length}</span>
          <span className="emp-stat-lbl">Team Leads</span>
        </div>
        <div className="emp-stat">
          <span className="emp-stat-num">{employees.filter(e => e.perform_iq_role === 'EMPLOYEE').length}</span>
          <span className="emp-stat-lbl">Employees</span>
        </div>
        <div className="emp-stat">
          <span className="emp-stat-num">{employees.filter(e => e.status === 'active').length}</span>
          <span className="emp-stat-lbl">Active</span>
        </div>
      </div>

      {/* Filters */}
      <div className="emp-filters">
        <input
          className="form-control"
          style={{ width: 220 }}
          placeholder="Search name / email / role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="form-control" style={{ width: 'auto' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Types</option>
          {PERFORM_IQ_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
          <option value="">All Scrum Teams</option>
          {allTeams.map(t => <option key={t} value={t}>Team {t}</option>)}
        </select>
        {(search || filterRole || filterLevel || filterTeam) && (
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setFilterRole(''); setFilterLevel(''); setFilterTeam(''); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="admin-table emp-table">
          <thead>
            <tr>
              <th>EMIS ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Role</th>
              <th>Type</th>
              <th>Level</th>
              <th>Scrum Team</th>
              <th>Cohort</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Lead</th>
              <th>Manager</th>
              <th>Reports To</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id} onClick={() => setShowDetail(emp)} style={{ cursor: 'pointer' }}>
                <td><span className="emp-code">{emp.emis_user_id}</span></td>
                <td className="font-medium">{emp.name}</td>
                <td className="text-muted">{emp.designation || '—'}</td>
                <td>{emp.role || '—'}</td>
                <td>
                  <span className="role-pill" style={{ background: ROLE_COLORS[emp.perform_iq_role] }}>
                    {emp.perform_iq_role}
                  </span>
                </td>
                <td>
                  <span style={{
                    background: LEVEL_COLORS[emp.level] || '#6b7280',
                    color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600
                  }}>
                    {emp.level || '—'}
                  </span>
                </td>
                <td>{emp.scrum_team || '—'}</td>
                <td className="text-muted">{emp.cohort || '—'}</td>
                <td className="text-muted">{emp.phone || '—'}</td>
                <td className="text-muted" style={{ fontSize: 12 }}>{emp.email}</td>
                <td style={{ textAlign: 'center' }}>{emp.is_lead ? '✓' : ''}</td>
                <td style={{ textAlign: 'center' }}>{emp.is_manager ? '✓' : ''}</td>
                <td className="text-muted" style={{ fontSize: 12 }}>{emp.manager_name || '—'}</td>
                <td>
                  <span className={`status-badge-emp ${emp.status}`}>{emp.status}</span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(emp.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={15} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No employees found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{showDetail.name}</h2>
              <button className="btn-icon" onClick={() => setShowDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['EMIS ID', showDetail.emis_user_id],
                  ['Level', showDetail.level],
                  ['Designation', showDetail.designation],
                  ['Role', showDetail.role],
                  ['Type', showDetail.perform_iq_role],
                  ['Scrum Team(s)', showDetail.scrum_team],
                  ['Cohort', showDetail.cohort],
                  ['Phone', showDetail.phone],
                  ['Email', showDetail.email],
                  ['DOB', showDetail.dob ? new Date(showDetail.dob).toLocaleDateString('en-IN') : '—'],
                  ['Team Lead', showDetail.is_lead ? 'Yes' : 'No'],
                  ['Is Manager', showDetail.is_manager ? 'Yes' : 'No'],
                  ['Master Admin', showDetail.is_master_admin ? 'Yes' : 'No'],
                  ['Reports To', showDetail.manager_name || '—'],
                  ['Status', showDetail.status],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 500 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
              {showDetail.address && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Address</div>
                  <div style={{ fontSize: 13 }}>{showDetail.address}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetail(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => openEdit(showDetail)}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">EMIS User ID *</label>
                  <input type="number" className="form-control" value={form.emis_user_id} onChange={e => setForm({...form, emis_user_id: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation (as per record)</label>
                  <input className="form-control" value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role (Perform IQ)</label>
                  <input className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})} placeholder="e.g. Senior Software Engineer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.perform_iq_role} onChange={e => setForm({...form, perform_iq_role: e.target.value})}>
                    {PERFORM_IQ_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Level</label>
                  <select className="form-control" value={form.level} onChange={e => setForm({...form, level: e.target.value})}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Scrum Team(s)</label>
                  <input className="form-control" value={form.scrum_team} onChange={e => setForm({...form, scrum_team: e.target.value})} placeholder="e.g. 3 or 3,4,5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cohort</label>
                  <input type="number" className="form-control" value={form.cohort} onChange={e => setForm({...form, cohort: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reports To (EMIS User ID)</label>
                  <select className="form-control" value={form.reports_to_emis_id} onChange={e => setForm({...form, reports_to_emis_id: e.target.value})}>
                    <option value="">None</option>
                    {managers.filter(m => !editing || m.id !== editing.id).map(m => (
                      <option key={m.emis_user_id} value={m.emis_user_id}>{m.name} ({m.emis_user_id})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className="form-control" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.is_lead} onChange={e => setForm({...form, is_lead: e.target.checked ? 1 : 0})} />
                    Team Lead
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.is_manager} onChange={e => setForm({...form, is_manager: e.target.checked ? 1 : 0})} />
                    Manager
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.is_master_admin} onChange={e => setForm({...form, is_master_admin: e.target.checked ? 1 : 0})} />
                    Master Admin
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <textarea className="form-control" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
