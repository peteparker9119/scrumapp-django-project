import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { projectAPI, dashboardAPI } from '../services/api';
import './Dashboard.css';

const HEALTH_CONFIG = {
  on_track: { label: 'On Track',  color: '#10B981', bg: '#D1FAE5', icon: '●' },
  at_risk:  { label: 'At Risk',   color: '#F59E0B', bg: '#FEF3C7', icon: '▲' },
  blocked:  { label: 'Blocked',   color: '#EF4444', bg: '#FEE2E2', icon: '■' },
};

const SEVERITY_COLOR = { critical: '#EF4444', high: '#F59E0B', medium: '#6366F1', low: '#6B7280' };

function ProgressBar({ pct, expected, color = '#4F46E5' }) {
  return (
    <div className="db-progress-wrap">
      <div className="db-progress-track">
        <div className="db-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        {expected > 0 && (
          <div className="db-progress-expected" style={{ left: `${Math.min(expected, 100)}%` }} title={`Expected: ${expected}%`} />
        )}
      </div>
      <span className="db-progress-pct">{pct}%</span>
    </div>
  );
}

function VelocityChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="db-velocity-empty">No completed sprints yet</div>
  );
  const max = Math.max(...data.map(d => Number(d.total_points)), 1);
  return (
    <div className="db-velocity-chart">
      {data.map((d, i) => {
        const donePct  = Math.round((Number(d.done_points) / max) * 100);
        const totalPct = Math.round((Number(d.total_points) / max) * 100);
        return (
          <div key={i} className="db-velocity-col">
            <div className="db-velocity-bars">
              <div className="db-velocity-bar-bg" style={{ height: `${totalPct}%` }}>
                <div className="db-velocity-bar-done" style={{ height: `${donePct ? Math.round((Number(d.done_points)/Number(d.total_points))*100) : 0}%` }} />
              </div>
            </div>
            <div className="db-velocity-pts">{d.done_points}<span>pt</span></div>
            <div className="db-velocity-label">{d.sprint_name.replace(/sprint/i, 'S').substring(0, 8)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentProject, selectProject } = useProject();
  const navigate = useNavigate();
  const [projects, setProjects]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    projectAPI.getAll().then(r => setProjects(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadStats = useCallback(async () => {
    if (!currentProject) return;
    setStatsLoading(true);
    try {
      const res = await dashboardAPI.getStats(currentProject.id);
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const sprint  = stats?.sprint;
  const health  = sprint ? HEALTH_CONFIG[sprint.health] : null;
  const backlog = stats?.backlog;
  const bugs    = stats?.bugs;
  const release = stats?.release;
  const velocity = stats?.velocity || [];
  const grooming = stats?.grooming;

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="db-root">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {currentProject ? currentProject.name : 'Welcome back'}, {user?.name}
            {currentProject && <span className="db-role-tag">PM / Scrum Master</span>}
          </p>
        </div>
        {currentProject && (
          <button className="btn btn-secondary" onClick={loadStats} disabled={statsLoading}>
            {statsLoading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        )}
      </div>

      {/* ── No project banner ── */}
      {!currentProject && (
        <div className="select-project-banner">
          <div className="banner-icon">📁</div>
          <div>
            <div className="banner-title">No project selected</div>
            <div className="banner-sub">Select a project below to load your dashboard</div>
          </div>
        </div>
      )}

      {currentProject && stats && (
        <>
          {/* ── Row 1: Sprint Health + Key Metrics ── */}
          <div className="db-row db-row-top">

            {/* Sprint Health Card */}
            <div className="db-card db-sprint-card">
              <div className="db-card-header">
                <span className="db-card-title">Active Sprint</span>
                {health && (
                  <span className="db-health-badge" style={{ background: health.bg, color: health.color }}>
                    {health.icon} {health.label}
                  </span>
                )}
              </div>

              {sprint ? (
                <>
                  <div className="db-sprint-name">{sprint.name}</div>
                  {sprint.goal && <div className="db-sprint-goal">"{sprint.goal}"</div>}

                  <div className="db-sprint-dates">
                    <span>{new Date(sprint.start_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
                    <span className="db-dates-arrow">→</span>
                    <span>{new Date(sprint.end_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
                    <span className="db-days-pill">
                      {sprint.days_remaining > 0
                        ? `${sprint.days_remaining}d left`
                        : sprint.days_remaining === 0 ? 'Ends today' : 'Overdue'}
                    </span>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="db-pts-row">
                      <span className="db-pts-done">{sprint.done_points} pts done</span>
                      <span className="db-pts-total">of {sprint.total_points} pts</span>
                    </div>
                    <ProgressBar pct={sprint.progress_pct} expected={sprint.expected_pct} color={health?.color || '#4F46E5'} />
                  </div>

                  <div className="db-sprint-items">
                    {[
                      { label: 'Todo',        val: sprint.todo,        color: '#9CA3AF' },
                      { label: 'In Progress', val: sprint.in_progress, color: '#3B82F6' },
                      { label: 'In Review',   val: sprint.in_review,   color: '#8B5CF6' },
                      { label: 'Done',        val: sprint.done,        color: '#10B981' },
                    ].map(item => (
                      <div key={item.label} className="db-sprint-item-stat">
                        <div className="db-sprint-item-dot" style={{ background: item.color }} />
                        <div className="db-sprint-item-val">{item.val || 0}</div>
                        <div className="db-sprint-item-lbl">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="db-sprint-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/board')}>Open Board</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/burndown')}>Burndown</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sprints')}>All Sprints</button>
                  </div>
                </>
              ) : (
                <div className="db-no-sprint">
                  <div className="db-no-sprint-icon">🏁</div>
                  <div>No active sprint</div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/sprints')}>
                    Plan a Sprint
                  </button>
                </div>
              )}
            </div>

            {/* Right column: metric pills */}
            <div className="db-metrics-col">
              {/* Backlog */}
              <div className="db-metric-card" onClick={() => navigate('/backlog')} role="button">
                <div className="db-metric-icon" style={{ background: '#EEF2FF', color: '#4F46E5' }}>📝</div>
                <div className="db-metric-body">
                  <div className="db-metric-val">{backlog?.total || 0}</div>
                  <div className="db-metric-lbl">Backlog Items</div>
                  <div className="db-metric-sub">{backlog?.ready || 0} ready · {backlog?.in_sprint || 0} in sprint</div>
                </div>
              </div>

              {/* Bugs */}
              <div className="db-metric-card" onClick={() => navigate('/bugs')} role="button"
                style={{ borderColor: (bugs?.sla_breached > 0) ? '#FCA5A5' : undefined }}>
                <div className="db-metric-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>🐛</div>
                <div className="db-metric-body">
                  <div className="db-metric-val">{bugs?.open_count || 0}</div>
                  <div className="db-metric-lbl">Open Bugs</div>
                  <div className="db-metric-sub">
                    {bugs?.critical_open > 0 && <span style={{ color: '#EF4444' }}>{bugs.critical_open} critical · </span>}
                    {bugs?.sla_breached > 0
                      ? <span style={{ color: '#F59E0B' }}>{bugs.sla_breached} SLA breached</span>
                      : 'No SLA breaches'}
                  </div>
                </div>
              </div>

              {/* Next Release */}
              <div className="db-metric-card" onClick={() => navigate('/releases')} role="button">
                <div className="db-metric-icon" style={{ background: '#F0FDF4', color: '#10B981' }}>🚀</div>
                <div className="db-metric-body">
                  {release ? (
                    <>
                      <div className="db-metric-val">{release.days_to_release}d</div>
                      <div className="db-metric-lbl">Next Release</div>
                      <div className="db-metric-sub">{release.name} v{release.version} · {release.status}</div>
                    </>
                  ) : (
                    <>
                      <div className="db-metric-val">—</div>
                      <div className="db-metric-lbl">No Upcoming Release</div>
                      <div className="db-metric-sub">Plan a release</div>
                    </>
                  )}
                </div>
              </div>

              {/* Grooming */}
              <div className="db-metric-card" onClick={() => navigate('/grooming')} role="button">
                <div className="db-metric-icon" style={{ background: '#FFF7ED', color: '#F59E0B' }}>🔍</div>
                <div className="db-metric-body">
                  <div className="db-metric-val">{grooming?.in_review || 0}</div>
                  <div className="db-metric-lbl">Pending Review</div>
                  <div className="db-metric-sub">{grooming?.draft || 0} drafts · {grooming?.approved || 0} approved</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Velocity + Critical Bugs ── */}
          <div className="db-row db-row-bottom">

            {/* Velocity Chart */}
            <div className="db-card db-velocity-card">
              <div className="db-card-header">
                <span className="db-card-title">Sprint Velocity</span>
                <span className="db-card-sub">Last {velocity.length} completed sprints</span>
              </div>
              <VelocityChart data={velocity} />
              {velocity.length > 0 && (
                <div className="db-velocity-avg">
                  Avg velocity: <strong>
                    {Math.round(velocity.reduce((a, d) => a + Number(d.done_points), 0) / velocity.length)} pts/sprint
                  </strong>
                </div>
              )}
            </div>

            {/* Critical Bugs */}
            <div className="db-card db-bugs-card">
              <div className="db-card-header">
                <span className="db-card-title">Critical & High Bugs</span>
                <button className="db-card-link" onClick={() => navigate('/bugs')}>View all →</button>
              </div>
              {bugs?.critical_bugs?.length > 0 ? (
                <div className="db-bug-list">
                  {bugs.critical_bugs.map(bug => (
                    <div key={bug.bug_id} className="db-bug-row">
                      <span className="db-bug-sev" style={{ background: SEVERITY_COLOR[bug.severity] + '18', color: SEVERITY_COLOR[bug.severity] }}>
                        {bug.severity}
                      </span>
                      <span className="db-bug-id">{bug.bug_id}</span>
                      <span className="db-bug-title">{bug.title}</span>
                      {bug.due_date && new Date(bug.due_date) < new Date() && (
                        <span className="db-bug-sla-breach">SLA</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="db-no-bugs">
                  <div style={{ fontSize: 28 }}>✓</div>
                  <div>No critical or high bugs open</div>
                </div>
              )}
            </div>

            {/* Quick Nav */}
            <div className="db-card db-quicknav-card">
              <div className="db-card-header">
                <span className="db-card-title">Quick Navigation</span>
              </div>
              <div className="db-quicknav-grid">
                {[
                  { label: 'Kanban Board',    icon: '▦',  path: '/board',     color: '#4F46E5' },
                  { label: 'Backlog',         icon: '📋', path: '/backlog',   color: '#2563EB' },
                  { label: 'Sprint Planning', icon: '🗓', path: '/sprints',   color: '#7C3AED' },
                  { label: 'Grooming Hub',    icon: '🔍', path: '/grooming',  color: '#F59E0B' },
                  { label: 'Bug Tracker',     icon: '🐛', path: '/bugs',      color: '#EF4444' },
                  { label: 'Releases',        icon: '🚀', path: '/releases',  color: '#10B981' },
                  { label: 'Burndown',        icon: '📉', path: '/burndown',  color: '#6366F1' },
                  { label: 'Requirements',    icon: '📄', path: '/requirements', color: '#8B5CF6' },
                ].map(item => (
                  <button key={item.path} className="db-quicknav-btn" onClick={() => navigate(item.path)}>
                    <span className="db-quicknav-icon" style={{ color: item.color }}>{item.icon}</span>
                    <span className="db-quicknav-lbl">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Projects Section ── */}
      <div className="db-section-title">
        {currentProject ? 'Switch Project' : 'Your Projects'}
      </div>
      <div className="projects-grid">
        {projects.map(p => (
          <div
            key={p.id}
            className={`project-card card ${currentProject?.id === p.id ? 'selected' : ''}`}
            onClick={() => selectProject(p)}
          >
            <div className="project-card-header">
              <div className="project-key-badge">{p.key_code}</div>
              <span className={`badge badge-${p.status}`}>{p.status}</span>
            </div>
            <div className="project-card-name">{p.name}</div>
            <div className="project-card-desc">{p.description || 'No description'}</div>
            <div className="project-card-meta">
              <span>🗂 {p.backlog_count} items</span>
              <span>🏃 {p.active_sprints} active</span>
            </div>
            {currentProject?.id === p.id
              ? <div className="selected-indicator">✓ Current Project</div>
              : <button className="btn btn-secondary btn-sm mt-2" onClick={e => { e.stopPropagation(); selectProject(p); }}>Select</button>
            }
          </div>
        ))}
        {projects.length === 0 && (
          <div className="empty-state">
            No projects yet.{' '}
            <button className="link-btn" onClick={() => navigate('/projects')}>Create one!</button>
          </div>
        )}
      </div>
    </div>
  );
}
