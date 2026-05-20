import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { reportAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import './VelocityReport.css';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

// ── Simple Bar Chart ───────────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = '#6366F1', label = '' }) {
  if (!data?.length) return <div className="vr-chart-empty">No data yet</div>;
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);

  return (
    <div className="vr-bar-chart">
      <div className="vr-bars">
        {data.map((d, i) => {
          const val = d[valueKey] || 0;
          const pct = Math.round((val / maxVal) * 100);
          return (
            <div key={i} className="vr-bar-group">
              <div className="vr-bar-wrap">
                <div className="vr-bar-value">{val}</div>
                <div className="vr-bar" style={{ height: `${Math.max(pct, 4)}%`, background: color }} title={`${val} ${label}`} />
              </div>
              <div className="vr-bar-label">{d[labelKey]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dual Bar Chart (e.g., total vs completed) ──────────────────────────────────
function DualBarChart({ data, keyA, keyB, labelKey, colorA = '#6366F1', colorB = '#10B981', labelA = 'A', labelB = 'B' }) {
  if (!data?.length) return <div className="vr-chart-empty">No data yet</div>;
  const maxVal = Math.max(...data.flatMap(d => [d[keyA] || 0, d[keyB] || 0]), 1);

  return (
    <div className="vr-bar-chart">
      <div className="vr-chart-legend">
        <span><span className="vr-legend-dot" style={{ background: colorA }} />{labelA}</span>
        <span><span className="vr-legend-dot" style={{ background: colorB }} />{labelB}</span>
      </div>
      <div className="vr-bars">
        {data.map((d, i) => {
          const a = d[keyA] || 0, b = d[keyB] || 0;
          return (
            <div key={i} className="vr-bar-group">
              <div className="vr-bar-wrap dual">
                <div className="vr-bar-value">{a}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
                  <div className="vr-bar" style={{ height: `${Math.max((a / maxVal) * 100, 4)}%`, background: colorA, flex: 1 }} title={`${a} ${labelA}`} />
                  <div className="vr-bar" style={{ height: `${Math.max((b / maxVal) * 100, 4)}%`, background: colorB, flex: 1 }} title={`${b} ${labelB}`} />
                </div>
              </div>
              <div className="vr-bar-label">{d[labelKey]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = '#6366F1' }) {
  return (
    <div className="vr-stat-card">
      <div className="vr-stat-icon" style={{ background: color + '20', color }}>{icon}</div>
      <div className="vr-stat-body">
        <div className="vr-stat-value" style={{ color }}>{value ?? '—'}</div>
        <div className="vr-stat-label">{label}</div>
        {sub && <div className="vr-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function VelocityReport() {
  const { currentProject } = useProject();
  const [velocity, setVelocity] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [bugTrend, setBugTrend] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('velocity');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = currentProject?.id ? { project_id: currentProject.id } : {};
      const [vRes, sRes, bRes, tRes] = await Promise.all([
        reportAPI.getVelocity(params),
        reportAPI.getSprints(params),
        reportAPI.getBugs(params),
        reportAPI.getTeam(params),
      ]);
      setVelocity(vRes.data);
      setSprints(sRes.data);
      setBugTrend(bRes.data);
      setTeam(tRes.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, [currentProject]);

  useEffect(() => { load(); }, [load]);

  // Derived stats
  const avgVelocity = velocity.length
    ? Math.round(velocity.reduce((s, v) => s + Number(v.completed_points), 0) / velocity.length)
    : 0;
  const completedSprints = sprints.filter(s => s.status === 'completed').length;
  const activeSprint = sprints.find(s => s.status === 'active');
  const totalPtsDelivered = velocity.reduce((s, v) => s + Number(v.completed_points), 0);

  const TABS = [
    { key: 'velocity', label: '📈 Velocity' },
    { key: 'sprints', label: '🗓 Sprint History' },
    { key: 'bugs', label: '🐞 Bug Trend' },
    { key: 'team', label: '👥 Team Stats' },
  ];

  return (
    <div className="vr-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Velocity & Reports</h1>
          <p className="page-subtitle">{currentProject?.name || 'All Projects'} · Analytics & performance insights</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {/* KPI Row */}
      <div className="vr-kpi-row">
        <StatCard label="Avg Velocity" value={`${avgVelocity} pts`} sub="per completed sprint" icon="⚡" color="#6366F1" />
        <StatCard label="Sprints Done" value={completedSprints} sub={`${sprints.length} total`} icon="✅" color="#10B981" />
        <StatCard label="Points Delivered" value={totalPtsDelivered} sub={`last ${velocity.length} sprints`} icon="🎯" color="#F59E0B" />
        <StatCard
          label="Active Sprint"
          value={activeSprint?.name || 'None'}
          sub={activeSprint ? `${activeSprint.done_items}/${activeSprint.total_items} items done` : ''}
          icon="🏃"
          color="#3B82F6"
        />
      </div>

      {/* Tabs */}
      <div className="vr-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`vr-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <div className="vr-content">

          {/* ── Velocity Tab ──────────────────────────────────────────────── */}
          {activeTab === 'velocity' && (
            <div className="vr-panel">
              <div className="vr-section">
                <h3 className="vr-section-title">Story Points Completed Per Sprint</h3>
                <div className="vr-chart-container">
                  <DualBarChart
                    data={velocity.map(v => ({ ...v, name: v.name.length > 12 ? v.name.slice(0, 12) + '…' : v.name }))}
                    keyA="total_points" keyB="completed_points"
                    labelKey="name"
                    colorA="#C7D2FE" colorB="#6366F1"
                    labelA="Planned" labelB="Completed"
                  />
                </div>
              </div>

              <div className="vr-section">
                <h3 className="vr-section-title">Items Completed Per Sprint</h3>
                <div className="vr-chart-container">
                  <DualBarChart
                    data={velocity.map(v => ({ ...v, name: v.name.length > 12 ? v.name.slice(0, 12) + '…' : v.name }))}
                    keyA="total_items" keyB="done_items"
                    labelKey="name"
                    colorA="#FDE68A" colorB="#F59E0B"
                    labelA="Total Items" labelB="Done"
                  />
                </div>
              </div>

              {velocity.length === 0 && (
                <div className="vr-empty">
                  <div>📊</div>
                  <p>No completed sprints yet. Complete sprints to see velocity data.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Sprint History Tab ─────────────────────────────────────────── */}
          {activeTab === 'sprints' && (
            <div className="vr-panel">
              <table className="vr-table">
                <thead>
                  <tr>
                    <th>Sprint</th>
                    <th>Status</th>
                    <th>Dates</th>
                    <th>Duration</th>
                    <th>Team</th>
                    <th>Items</th>
                    <th>Completion</th>
                    <th>Pts Planned</th>
                    <th>Pts Done</th>
                  </tr>
                </thead>
                <tbody>
                  {sprints.map(s => {
                    const completionPct = s.total_items > 0 ? Math.round((s.done_items / s.total_items) * 100) : 0;
                    const ptsPct = s.total_points > 0 ? Math.round((s.completed_points / s.total_points) * 100) : 0;
                    return (
                      <tr key={s.id}>
                        <td className="vr-cell-name">{s.name}</td>
                        <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                        <td className="vr-cell-muted">{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</td>
                        <td className="vr-cell-muted">{s.duration_days}d</td>
                        <td>{s.team_size > 0 ? `${s.team_size} members` : <span className="vr-cell-muted">—</span>}</td>
                        <td>{s.done_items}/{s.total_items}</td>
                        <td>
                          <div className="vr-mini-bar-wrap">
                            <div className="vr-mini-bar" style={{ width: `${completionPct}%`, background: completionPct >= 80 ? '#10B981' : completionPct >= 50 ? '#F59E0B' : '#EF4444' }} />
                            <span className="vr-mini-pct">{completionPct}%</span>
                          </div>
                        </td>
                        <td>{s.total_points}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: ptsPct >= 80 ? '#10B981' : ptsPct >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {s.completed_points}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sprints.length === 0 && <div className="vr-empty"><div>🗓</div><p>No sprints found.</p></div>}
            </div>
          )}

          {/* ── Bug Trend Tab ──────────────────────────────────────────────── */}
          {activeTab === 'bugs' && (
            <div className="vr-panel">
              <div className="vr-section">
                <h3 className="vr-section-title">Bug Trend (Last 6 Months)</h3>
                <div className="vr-chart-container">
                  <DualBarChart
                    data={bugTrend}
                    keyA="total" keyB="closed"
                    labelKey="month"
                    colorA="#FCA5A5" colorB="#10B981"
                    labelA="Reported" labelB="Closed"
                  />
                </div>
              </div>
              <div className="vr-section">
                <h3 className="vr-section-title">Critical Bugs Per Month</h3>
                <div className="vr-chart-container">
                  <BarChart data={bugTrend} valueKey="critical" labelKey="month" color="#EF4444" label="critical" />
                </div>
              </div>
              {bugTrend.length === 0 && <div className="vr-empty"><div>🐞</div><p>No bug data in the last 6 months.</p></div>}
            </div>
          )}

          {/* ── Team Stats Tab ─────────────────────────────────────────────── */}
          {activeTab === 'team' && (
            <div className="vr-panel">
              <table className="vr-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Backlog Assigned</th>
                    <th>Backlog Done</th>
                    <th>Pts Delivered</th>
                    <th>Bugs Assigned</th>
                    <th>Bugs Closed</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map(m => {
                    const eff = m.backlog_assigned > 0 ? Math.round((m.backlog_done / m.backlog_assigned) * 100) : 0;
                    return (
                      <tr key={m.id}>
                        <td className="vr-cell-name">
                          <div className="vr-member-avatar">{m.name?.[0]?.toUpperCase()}</div>
                          {m.name}
                        </td>
                        <td><span className="badge">{m.role?.replace(/_/g, ' ')}</span></td>
                        <td>{m.backlog_assigned}</td>
                        <td>{m.backlog_done}</td>
                        <td><strong style={{ color: '#6366F1' }}>{m.points_delivered}</strong></td>
                        <td>{m.bugs_assigned}</td>
                        <td>{m.bugs_closed}</td>
                        <td>
                          <div className="vr-mini-bar-wrap">
                            <div className="vr-mini-bar" style={{ width: `${eff}%`, background: eff >= 80 ? '#10B981' : eff >= 50 ? '#F59E0B' : '#EF4444' }} />
                            <span className="vr-mini-pct">{eff}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {team.length === 0 && <div className="vr-empty"><div>👥</div><p>No team assignment data yet.</p></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
