import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { sprintAPI, backlogAPI, employeeMasterAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import './SprintPlanning.css';

const STATUS_LABELS = { planning: '🗓 Planning', active: '🏃 Active', completed: '✅ Completed', cancelled: '❌ Cancelled' };

function CriteriaBadge({ item }) {
  if (!item.requirement_id) return <span className="criteria-badge criteria-ok">✓ Eligible</span>;
  const met = [item.stakeholder_email_sent && item.stakeholder_email_confirmed, item.wireframe_uploaded && item.wireframe_confirmed, !!item.tl_comment, !!item.manager_comment].filter(Boolean).length;
  if (item.all_criteria_met) return <span className="criteria-badge criteria-ok">✓ Criteria Met</span>;
  return <span className="criteria-badge criteria-warn" title="Cannot add to sprint">⚠ {met}/4 Pending</span>;
}

function CapacityBar({ committed, capacity }) {
  const pct = capacity > 0 ? Math.min(Math.round((committed / capacity) * 100), 110) : 0;
  const color = pct > 100 ? '#EF4444' : pct > 80 ? '#F59E0B' : '#10B981';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--text-muted)' }}>
        <span>{committed} pts committed</span>
        <span style={{ color, fontWeight: 700 }}>{pct}% of capacity</span>
      </div>
      <div style={{ height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export default function SprintPlanning() {
  const { currentProject } = useProject();
  const [sprints, setSprints]           = useState([]);
  const [backlog, setBacklog]           = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [showAddItem, setShowAddItem]   = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', start_date: '', end_date: '' });
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [addingBulk, setAddingBulk]     = useState(false);

  // Capacity state
  const [capacity, setCapacity]         = useState(null);   // { members, total_capacity, committed_points }
  const [allEmployees, setAllEmployees] = useState([]);
  const [showCapacity, setShowCapacity] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [localMembers, setLocalMembers] = useState([]);     // edited members list
  const [savingCapacity, setSavingCapacity] = useState(false);

  const load = useCallback(async () => {
    if (!currentProject) { setLoading(false); return; }
    try {
      const [sRes, bRes, bRes2, eRes] = await Promise.all([
        sprintAPI.getAll({ project_id: currentProject.id }),
        backlogAPI.getAll({ project_id: currentProject.id, status: 'backlog' }),
        backlogAPI.getAll({ project_id: currentProject.id, status: 'ready' }),
        employeeMasterAPI.getAll(),
      ]);
      setSprints(sRes.data);
      setBacklog([...bRes.data, ...bRes2.data]);
      setAllEmployees(eRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [currentProject]);

  const loadSprint = async (id) => {
    try {
      const [sRes, capRes] = await Promise.all([sprintAPI.getOne(id), sprintAPI.getCapacity(id)]);
      setSelectedSprint(sRes.data);
      setCapacity(capRes.data);
      setLocalMembers(capRes.data.members.map(m => ({ ...m })));
    } catch { toast.error('Failed to load sprint'); }
  };

  useEffect(() => { load(); }, [load]);

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (!currentProject) return toast.error('Select a project first');
    try {
      await sprintAPI.create({ ...form, project_id: currentProject.id });
      toast.success('Sprint created!');
      setShowModal(false);
      setForm({ name: '', goal: '', start_date: '', end_date: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const s = sprints.find(sp => sp.id === id);
      await sprintAPI.update(id, { name: s.name, goal: s.goal, start_date: s.start_date, end_date: s.end_date, status });
      toast.success(`Sprint ${status}!`);
      load();
      if (selectedSprint?.id === id) loadSprint(id);
    } catch { toast.error('Failed'); }
  };

  const handleAddItem = async (backlogItemId) => {
    try {
      await sprintAPI.addItem(selectedSprint.id, { backlog_item_id: backlogItemId });
      toast.success('Item added!');
      const [sRes, bRes, bRes2, capRes] = await Promise.all([
        sprintAPI.getOne(selectedSprint.id),
        backlogAPI.getAll({ project_id: currentProject.id, status: 'backlog' }),
        backlogAPI.getAll({ project_id: currentProject.id, status: 'ready' }),
        sprintAPI.getCapacity(selectedSprint.id),
      ]);
      setSelectedSprint(sRes.data);
      setBacklog([...bRes.data, ...bRes2.data]);
      setCapacity(capRes.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleRemoveItem = async (backlogItemId) => {
    try {
      await sprintAPI.removeItem(selectedSprint.id, backlogItemId);
      toast.success('Item removed!');
      const [sRes, capRes] = await Promise.all([sprintAPI.getOne(selectedSprint.id), sprintAPI.getCapacity(selectedSprint.id)]);
      setSelectedSprint(sRes.data);
      setCapacity(capRes.data);
      load();
    } catch { toast.error('Failed'); }
  };

  const handleBulkAdd = async () => {
    if (!selectedIds.size) return;
    setAddingBulk(true);
    try {
      const res = await sprintAPI.addItemsBulk(selectedSprint.id, { backlog_item_ids: [...selectedIds] });
      const data = res.data;
      toast.success(`Added ${data.added.length} items${data.skipped.length ? `, skipped ${data.skipped.length}` : ''}`);
      setSelectedIds(new Set());
      const [sRes, bRes, bRes2, capRes] = await Promise.all([
        sprintAPI.getOne(selectedSprint.id),
        backlogAPI.getAll({ project_id: currentProject.id, status: 'backlog' }),
        backlogAPI.getAll({ project_id: currentProject.id, status: 'ready' }),
        sprintAPI.getCapacity(selectedSprint.id),
      ]);
      setSelectedSprint(sRes.data);
      setBacklog([...bRes.data, ...bRes2.data]);
      setCapacity(capRes.data);
    } catch { toast.error('Bulk add failed'); }
    finally { setAddingBulk(false); }
  };

  // ── Capacity helpers ──────────────────────────────────────────────────────────
  const handleAddMember = (emp) => {
    if (localMembers.find(m => m.emis_user_id === emp.emis_user_id)) return;
    const sprintDays = selectedSprint
      ? Math.max(1, Math.round((new Date(selectedSprint.end_date) - new Date(selectedSprint.start_date)) / 86400000))
      : 10;
    setLocalMembers(prev => [...prev, {
      emis_user_id: emp.emis_user_id, name: emp.name,
      designation: emp.designation, role: emp.role, level: emp.level,
      working_days: sprintDays, daily_capacity: 2.0,
    }]);
    setShowMemberPicker(false);
    setMemberSearch('');
  };

  const handleRemoveMember = (emis_user_id) => setLocalMembers(prev => prev.filter(m => m.emis_user_id !== emis_user_id));

  const updateMember = (emis_user_id, field, value) => {
    setLocalMembers(prev => prev.map(m => m.emis_user_id === emis_user_id ? { ...m, [field]: Number(value) } : m));
  };

  const totalLocalCapacity = Math.round(localMembers.reduce((s, m) => s + (m.working_days * m.daily_capacity), 0));

  const handleSaveCapacity = async () => {
    setSavingCapacity(true);
    try {
      await sprintAPI.saveCapacity(selectedSprint.id, { members: localMembers.map(m => ({ emis_user_id: m.emis_user_id, working_days: m.working_days, daily_capacity: m.daily_capacity })) });
      const capRes = await sprintAPI.getCapacity(selectedSprint.id);
      setCapacity(capRes.data);
      setLocalMembers(capRes.data.members.map(m => ({ ...m })));
      toast.success('Team capacity saved!');
    } catch { toast.error('Failed to save capacity'); }
    finally { setSavingCapacity(false); }
  };

  const isEligible = (item) => !item.requirement_id || !!item.all_criteria_met;
  const availableBacklog = backlog.filter(b => !selectedSprint?.items?.some(i => i.id === b.id));
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllEligible = () => setSelectedIds(new Set(availableBacklog.filter(isEligible).map(b => b.id)));

  const committedPoints = selectedSprint?.items?.reduce((s, i) => s + (i.story_points || 0), 0) || 0;

  const pickerEmployees = allEmployees.filter(e =>
    !localMembers.find(m => m.emis_user_id === e.emis_user_id) &&
    (memberSearch === '' || e.name.toLowerCase().includes(memberSearch.toLowerCase()) || (e.designation || '').toLowerCase().includes(memberSearch.toLowerCase()))
  );

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!currentProject) return (
    <div><h1 className="page-title">Sprint Planning</h1>
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', marginTop: 20 }}>Please select a project from the Dashboard first.</div>
    </div>
  );

  return (
    <div className="sprint-planning">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sprint Planning</h1>
          <p className="page-subtitle">{currentProject.name} · {sprints.length} sprint{sprints.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Sprint</button>
      </div>

      <div className="sp-layout">
        {/* Sprint List */}
        <div className="sp-sidebar">
          <div className="sp-sidebar-title">Sprints</div>
          {sprints.map(s => (
            <div key={s.id} className={`sprint-item ${selectedSprint?.id === s.id ? 'active' : ''}`} onClick={() => { loadSprint(s.id); setShowCapacity(false); }}>
              <div className="sprint-item-header">
                <span className="sprint-item-name">{s.name}</span>
                <span className={`badge badge-${s.status}`}>{s.status}</span>
              </div>
              <div className="sprint-item-meta">📅 {new Date(s.start_date).toLocaleDateString()} → {new Date(s.end_date).toLocaleDateString()}</div>
              <div className="sprint-item-stats">
                <span>{s.total_items} items</span><span>·</span>
                <span>{s.total_points} pts</span><span>·</span>
                <span>{s.done_items} done</span>
              </div>
              <div className="sprint-actions">
                {s.status === 'planning' && <button className="btn btn-success btn-sm" onClick={e => { e.stopPropagation(); handleStatusChange(s.id, 'active'); }}>▶ Start</button>}
                {s.status === 'active'   && <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); handleStatusChange(s.id, 'completed'); }}>✓ Complete</button>}
              </div>
            </div>
          ))}
          {sprints.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No sprints yet</div>}
        </div>

        {/* Main Area */}
        <div className="sp-main">
          {selectedSprint ? (
            <>
              {/* Sprint header */}
              <div className="sprint-detail-header">
                <div>
                  <div className="sprint-detail-name">{selectedSprint.name}</div>
                  <div className="sprint-detail-goal">{selectedSprint.goal || 'No goal set'}</div>
                  <div className="sprint-detail-dates">
                    {new Date(selectedSprint.start_date).toLocaleDateString()} → {new Date(selectedSprint.end_date).toLocaleDateString()}
                    &nbsp;·&nbsp;<strong>{committedPoints} story points</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className={`btn btn-sm ${showCapacity ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowCapacity(v => !v)}>
                    👥 Capacity {capacity?.members?.length > 0 ? `(${capacity.members.length})` : ''}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedIds(new Set()); setShowAddItem(true); }}>+ Add Item</button>
                </div>
              </div>

              <div className="sp-body">
                {/* Items list */}
                <div className="sp-items-col">
                  <div className="sprint-items-list">
                    {selectedSprint.items?.length === 0 && (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No items yet. Add from backlog!</div>
                    )}
                    {selectedSprint.items?.map(item => (
                      <div key={item.id} className="sprint-backlog-item card">
                        <div className="sbi-left">
                          <span className={`badge badge-${item.item_type}`}>{item.item_type}</span>
                          <span className="sbi-title">{item.title}</span>
                          <span className={`badge badge-${item.priority}`}>{item.priority}</span>
                          {item.open_bugs > 0 && (
                            <span className="sbi-bug-badge" title={`${item.open_bugs} open bug${item.open_bugs > 1 ? 's' : ''}`}>
                              🐛 {item.open_bugs}
                            </span>
                          )}
                        </div>
                        <div className="sbi-right">
                          {item.story_points && <span className="points-badge">{item.story_points}</span>}
                          <span className="text-sm text-muted">{item.assignee_name || 'Unassigned'}</span>
                          <span className={`status-dot status-${item.board_status}`}>{item.board_status?.replace('_', ' ')}</span>
                          <button className="btn-icon" onClick={() => handleRemoveItem(item.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Capacity Panel */}
                {showCapacity && (
                  <div className="sp-capacity-panel">
                    <div className="cap-header">
                      <span className="cap-title">Team Capacity</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowMemberPicker(v => !v)}>+ Member</button>
                    </div>

                    {/* Member picker dropdown */}
                    {showMemberPicker && (
                      <div className="cap-picker">
                        <input
                          className="form-control"
                          placeholder="Search employee..."
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                          autoFocus
                          style={{ marginBottom: 8 }}
                        />
                        <div className="cap-picker-list">
                          {pickerEmployees.slice(0, 12).map(emp => (
                            <div key={emp.emis_user_id} className="cap-picker-item" onClick={() => handleAddMember(emp)}>
                              <div className="cap-picker-name">{emp.name}</div>
                              <div className="cap-picker-role">{emp.designation} · {emp.level}</div>
                            </div>
                          ))}
                          {pickerEmployees.length === 0 && <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>No employees found</div>}
                        </div>
                      </div>
                    )}

                    {/* Members table */}
                    <div className="cap-members">
                      {localMembers.length === 0 && (
                        <div className="cap-empty">Add team members to calculate capacity</div>
                      )}
                      {localMembers.map(m => (
                        <div key={m.emis_user_id} className="cap-member-row">
                          <div className="cap-member-info">
                            <div className="cap-member-name">{m.name}</div>
                            <div className="cap-member-role">{m.designation || m.role}</div>
                          </div>
                          <div className="cap-member-inputs">
                            <div className="cap-input-group">
                              <label>Days</label>
                              <input type="number" min="1" max="30" value={m.working_days}
                                onChange={e => updateMember(m.emis_user_id, 'working_days', e.target.value)} />
                            </div>
                            <div className="cap-input-group">
                              <label>Pts/day</label>
                              <input type="number" min="0.5" max="10" step="0.5" value={m.daily_capacity}
                                onChange={e => updateMember(m.emis_user_id, 'daily_capacity', e.target.value)} />
                            </div>
                            <div className="cap-member-pts">
                              {Math.round(m.working_days * m.daily_capacity)} pts
                            </div>
                          </div>
                          <button className="btn-icon" style={{ color: '#EF4444' }} onClick={() => handleRemoveMember(m.emis_user_id)}>✕</button>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <div className="cap-summary">
                      <div className="cap-summary-row">
                        <span>Total capacity</span>
                        <strong>{totalLocalCapacity} pts</strong>
                      </div>
                      <div className="cap-summary-row">
                        <span>Committed</span>
                        <strong>{committedPoints} pts</strong>
                      </div>
                      <div className="cap-summary-row">
                        <span>Remaining</span>
                        <strong style={{ color: totalLocalCapacity - committedPoints >= 0 ? '#10B981' : '#EF4444' }}>
                          {totalLocalCapacity - committedPoints} pts
                        </strong>
                      </div>
                      <CapacityBar committed={committedPoints} capacity={totalLocalCapacity} />
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={handleSaveCapacity} disabled={savingCapacity}>
                      {savingCapacity ? 'Saving…' : '💾 Save Team Capacity'}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 40 }}>🗓</div>
              <div>Select a sprint to manage items and team capacity</div>
            </div>
          )}
        </div>
      </div>

      {/* Create Sprint Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Sprint</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSprint}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Sprint Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Sprint 1" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sprint Goal</label>
                  <textarea className="form-control" rows={2} value={form.goal} onChange={e => setForm({...form, goal: e.target.value})} placeholder="What do we aim to achieve?" />
                </div>
                <div className="flex gap-3">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-control" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">End Date *</label>
                    <input type="date" className="form-control" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Sprint</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Backlog Item Modal */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Items to Sprint</h2>
              <button className="btn-icon" onClick={() => setShowAddItem(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="add-items-toolbar">
                <span className="text-sm text-muted">{availableBacklog.length} available · {selectedIds.size} selected</span>
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={selectAllEligible}>✓ Select All Eligible</button>
                  <button className="btn btn-primary btn-sm" onClick={handleBulkAdd} disabled={!selectedIds.size || addingBulk}>
                    {addingBulk ? 'Adding...' : `Add Selected (${selectedIds.size})`}
                  </button>
                </div>
              </div>
              {availableBacklog.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>All backlog items are already in this sprint!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {availableBacklog.map(item => {
                    const eligible = isEligible(item);
                    return (
                      <div key={item.id} className={`backlog-add-item ${!eligible ? 'ineligible' : ''} ${selectedIds.has(item.id) ? 'selected' : ''}`}>
                        <div className="backlog-add-left">
                          {eligible && <input type="checkbox" className="item-checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />}
                          <span className={`badge badge-${item.item_type}`}>{item.item_type}</span>
                          <span style={{ fontWeight: 500 }}>{item.title}</span>
                          <span className={`badge badge-${item.priority}`}>{item.priority}</span>
                          <CriteriaBadge item={item} />
                          {item.open_bugs > 0 && <span className="sbi-bug-badge">🐛 {item.open_bugs}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.story_points && <span className="points-badge">{item.story_points}</span>}
                          <button className="btn btn-primary btn-sm" onClick={() => handleAddItem(item.id)} disabled={!eligible}>+ Add</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddItem(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
