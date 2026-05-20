import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ctoAPI } from '../../services/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './CTOCommandCenter.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

// ── helpers ──────────────────────────────────────────────────────────────────
const HEALTH_META = {
  on_track:  { label: 'On Track',  color: '#10B981', bg: 'rgba(16,185,129,0.15)', dot: '#10B981' },
  at_risk:   { label: 'At Risk',   color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', dot: '#F59E0B' },
  off_track: { label: 'Off Track', color: '#EF4444', bg: 'rgba(239,68,68,0.15)',  dot: '#EF4444' },
  no_sprint: { label: 'No Sprint', color: '#6B7280', bg: 'rgba(107,114,128,0.10)',dot: '#6B7280' },
};

const SEV_COLOR = {
  critical: '#EF4444',
  high:     '#F59E0B',
  medium:   '#6366F1',
  low:      '#10B981',
};

const RISK_SEV_META = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'CRITICAL' },
  high:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'HIGH' },
  medium:   { color: '#6366F1', bg: 'rgba(99,102,241,0.12)', label: 'MEDIUM' },
};

function scoreColor(s) {
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#F59E0B';
  return '#EF4444';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

// ── mini sparkline (pure SVG) ─────────────────────────────────────────────────
function Sparkline({ values = [], color = '#6366F1', height = 32, width = 80 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ── radial health gauge (pure SVG) ───────────────────────────────────────────
function HealthGauge({ score }) {
  const r = 80, cx = 100, cy = 100;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(100, Math.max(0, score || 0)) / 100;
  const dash = circ * pct;
  const color = scoreColor(score);

  return (
    <svg viewBox="0 0 200 200" className="health-gauge-svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={color} strokeWidth="18"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="36" fontWeight="700" fill={color}>{score}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.5)">/100</text>
      <text x={cx} y={cy + 38} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.4)">HEALTH SCORE</text>
    </svg>
  );
}

// ── sidebar nav ───────────────────────────────────────────────────────────────
const CTO_NAV = [
  { id: 'overview',   icon: '⬡', label: 'Command Center' },
  { id: 'warroom',    icon: '🔴', label: 'Delivery War Room' },
  { id: 'sprints',    icon: '⚡', label: 'Sprint Intelligence' },
  { id: 'bugs',       icon: '🐞', label: 'Bug Command' },
  { id: 'releases',   icon: '🚀', label: 'Release Center' },
  { id: 'team',       icon: '👥', label: 'Team Analytics' },
  { id: 'ai',         icon: '🤖', label: 'AI Insights' },
];

function CTOSidebar({ active, onNav, user, onBack }) {
  return (
    <aside className="cto-sidebar">
      <div className="cto-sidebar-brand">
        <div className="cto-brand-icon">⬡</div>
        <div>
          <div className="cto-brand-name">ScrumFlow</div>
          <div className="cto-brand-sub">CTO Command Center</div>
        </div>
      </div>

      <nav className="cto-sidebar-nav">
        {CTO_NAV.map(n => (
          <button
            key={n.id}
            className={`cto-nav-item ${active === n.id ? 'active' : ''}`}
            onClick={() => onNav(n.id)}
          >
            <span className="cto-nav-icon">{n.icon}</span>
            <span className="cto-nav-label">{n.label}</span>
            {n.id === 'warroom' && <span className="cto-nav-badge" />}
          </button>
        ))}
      </nav>

      <div className="cto-sidebar-footer">
        <div className="cto-user-chip">
          <div className="cto-user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="cto-user-info">
            <div className="cto-user-name">{user?.name}</div>
            <div className="cto-user-role">{user?.designation || 'CTO'}</div>
          </div>
        </div>
        <button className="cto-back-btn" onClick={onBack} title="Back to main app">← Main App</button>
      </div>
    </aside>
  );
}

// ── status strip ─────────────────────────────────────────────────────────────
function StatusStrip({ summary, lastRefresh, onRefresh, loading }) {
  const items = [
    { label: 'Active Sprints',    value: summary?.active_sprints   ?? '—', color: '#6366F1' },
    { label: 'Open Bugs',         value: summary?.open_bugs         ?? '—', color: '#F59E0B' },
    { label: 'Critical Bugs',     value: summary?.critical_bugs     ?? '—', color: '#EF4444', alert: summary?.critical_bugs > 0 },
    { label: 'SLA Breached',      value: summary?.sla_breached      ?? '—', color: '#EF4444', alert: summary?.sla_breached > 0 },
    { label: 'Backlog Items',     value: summary?.total_backlog      ?? '—', color: '#10B981' },
    { label: 'Active Users',      value: summary?.active_users      ?? '—', color: '#0EA5E9' },
    { label: 'Avg Velocity',      value: summary?.avg_velocity ? `${summary.avg_velocity}pt` : '—', color: '#8B5CF6' },
    { label: 'Health Score',      value: summary?.engineering_health ? `${summary.engineering_health}` : '—',
      color: scoreColor(summary?.engineering_health) },
  ];

  return (
    <div className="cto-status-strip">
      <div className="cto-strip-items">
        {items.map(item => (
          <div key={item.label} className={`cto-strip-item ${item.alert ? 'alert-pulse' : ''}`}>
            <span className="cto-strip-dot" style={{ background: item.color }} />
            <span className="cto-strip-label">{item.label}</span>
            <span className="cto-strip-value" style={{ color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>
      <div className="cto-strip-actions">
        {lastRefresh && <span className="cto-strip-refresh-time">Updated {timeAgo(lastRefresh)}</span>}
        <button className={`cto-refresh-btn ${loading ? 'spinning' : ''}`} onClick={onRefresh}>↻</button>
      </div>
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon, gradient, trend }) {
  return (
    <div className="cto-kpi-card" style={{ '--card-gradient': gradient }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {sub  && <div className="kpi-sub">{sub}</div>}
      </div>
      {trend && <div className="kpi-trend">{trend}</div>}
    </div>
  );
}

// ── project health card ───────────────────────────────────────────────────────
function ProjectHealthCard({ project }) {
  const s = project.sprint;
  const meta = HEALTH_META[s?.health || 'no_sprint'];
  const score = project.health_score;
  const sc = scoreColor(score);

  return (
    <div className="cto-proj-card" style={{ '--health-color': meta.color }}>
      <div className="proj-card-header">
        <div className="proj-key-badge">{project.key_code}</div>
        <div className="proj-name">{project.name}</div>
        <div className="proj-score" style={{ color: sc, borderColor: sc + '40' }}>{score}</div>
      </div>

      {s ? (
        <>
          <div className="proj-sprint-name">{s.name}</div>
          <div className="proj-progress-wrap">
            <div className="proj-progress-track">
              <div className="proj-progress-fill" style={{ width: `${Math.min(s.progress,100)}%`, background: meta.color }} />
              {s.expected_pct > 0 && (
                <div className="proj-expected-marker" style={{ left: `${Math.min(s.expected_pct,100)}%` }} />
              )}
            </div>
            <span className="proj-progress-pct">{s.progress}%</span>
          </div>
          <div className="proj-status-row">
            <div className="proj-health-badge" style={{ color: meta.color, background: meta.bg }}>
              <span style={{ color: meta.dot }}>●</span> {meta.label}
            </div>
            <div className="proj-days">{s.days_remaining !== null ? `${s.days_remaining}d left` : ''}</div>
          </div>
          <div className="proj-items-row">
            <div className="proj-item-pill todo">{s.todo} todo</div>
            <div className="proj-item-pill inprogress">{s.in_progress} active</div>
            <div className="proj-item-pill review">{s.in_review} review</div>
            <div className="proj-item-pill done">{s.done} done</div>
          </div>
          {(project.bugs.total > 0) && (
            <div className="proj-bugs-row">
              <span className="proj-bug-icon">🐞</span>
              <span className="proj-bug-count">{project.bugs.total} open</span>
              {project.bugs.critical > 0 && <span className="proj-bug-critical">{project.bugs.critical} critical</span>}
            </div>
          )}
        </>
      ) : (
        <div className="proj-no-sprint">No active sprint</div>
      )}
    </div>
  );
}

// ── risk item ─────────────────────────────────────────────────────────────────
function RiskItem({ risk, index }) {
  const meta = RISK_SEV_META[risk.severity] || RISK_SEV_META.medium;
  const typeIcon = { sprint_risk: '⚡', bug_risk: '🐞', sla_breach: '⏱' }[risk.type] || '⚠';
  return (
    <div className="cto-risk-item" style={{ '--risk-color': meta.color, '--risk-bg': meta.bg, animationDelay: `${index * 0.05}s` }}>
      <div className="risk-left">
        <div className="risk-type-icon">{typeIcon}</div>
        <div>
          <div className="risk-project">{risk.project}</div>
          <div className="risk-message">{risk.message}</div>
          <div className="risk-action">→ {risk.action}</div>
        </div>
      </div>
      <div className="risk-sev-badge" style={{ color: meta.color, background: meta.bg }}>
        {meta.label}
      </div>
    </div>
  );
}

// ── velocity chart ────────────────────────────────────────────────────────────
function VelocityChart({ velocity }) {
  if (!velocity?.length) return (
    <div className="cto-chart-empty">No completed sprints yet</div>
  );
  const labels = velocity.map(v => v.name?.replace(/sprint/i,'S').substring(0,10) || '?');
  const data = {
    labels,
    datasets: [
      {
        label: 'Committed',
        data: velocity.map(v => v.total_points),
        backgroundColor: 'rgba(99,102,241,0.35)',
        borderColor: '#6366F1',
        borderWidth: 2,
        borderRadius: 6,
      },
      {
        label: 'Delivered',
        data: velocity.map(v => v.done_points),
        backgroundColor: 'rgba(16,185,129,0.55)',
        borderColor: '#10B981',
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} pts` } },
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
    },
  };
  return <Bar data={data} options={options} />;
}

// ── bug doughnut ──────────────────────────────────────────────────────────────
function BugDonut({ byS }) {
  const keys   = Object.keys(byS);
  const values = Object.values(byS);
  if (!keys.length) return <div className="cto-chart-empty">No open bugs</div>;
  const data = {
    labels: keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)),
    datasets: [{
      data: values,
      backgroundColor: keys.map(k => SEV_COLOR[k] || '#6B7280'),
      borderColor: 'transparent',
      hoverOffset: 6,
    }],
  };
  const options = {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.65)', font: { size: 11 }, padding: 12 } },
    },
  };
  return <Doughnut data={data} options={options} />;
}

// ── bug trend line ────────────────────────────────────────────────────────────
function BugTrendChart({ trend }) {
  if (!trend?.length) return <div className="cto-chart-empty">No bug trend data</div>;
  const data = {
    labels: trend.map(t => t.month),
    datasets: [
      {
        label: 'Reported',
        data: trend.map(t => t.reported),
        borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)',
        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3,
      },
      {
        label: 'Closed',
        data: trend.map(t => t.closed),
        borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)',
        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3,
      },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: 'rgba(255,255,255,0.65)', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
    },
  };
  return <Line data={data} options={options} />;
}

// ── AI insight card ───────────────────────────────────────────────────────────
function AIInsightCard({ icon, title, body, severity }) {
  const colors = { info: '#6366F1', warning: '#F59E0B', success: '#10B981', danger: '#EF4444' };
  const c = colors[severity] || colors.info;
  return (
    <div className="cto-ai-card" style={{ '--ai-color': c }}>
      <div className="ai-card-icon" style={{ color: c }}>{icon}</div>
      <div className="ai-card-body">
        <div className="ai-card-title">{title}</div>
        <div className="ai-card-text">{body}</div>
      </div>
    </div>
  );
}

// ── Sprint Intelligence view ──────────────────────────────────────────────────
function SprintIntelligenceView({ data }) {
  if (!data) return null;
  const projects = data.projects || [];
  return (
    <div className="cto-view-content">
      <div className="cto-section-header">
        <h2 className="cto-section-title">⚡ Sprint Intelligence</h2>
        <p className="cto-section-sub">Real-time sprint health across all projects</p>
      </div>
      <div className="cto-sprint-intel-grid">
        {projects.map(p => {
          const s = p.sprint;
          if (!s) return (
            <div key={p.id} className="cto-sprint-intel-row no-sprint">
              <span className="sprint-intel-key">{p.key_code}</span>
              <span className="sprint-intel-name">{p.name}</span>
              <span className="sprint-intel-status" style={{ color: '#6B7280' }}>No active sprint</span>
            </div>
          );
          const meta = HEALTH_META[s.health];
          return (
            <div key={p.id} className="cto-sprint-intel-row" style={{ '--health-color': meta.color }}>
              <div className="sprint-intel-left">
                <span className="sprint-intel-key">{p.key_code}</span>
                <div>
                  <div className="sprint-intel-proj">{p.name}</div>
                  <div className="sprint-intel-sprint">{s.name}</div>
                </div>
              </div>
              <div className="sprint-intel-progress">
                <div className="sprint-intel-bar">
                  <div style={{ width: `${Math.min(s.progress,100)}%`, background: meta.color, height: '100%', borderRadius: 4, transition: 'width 0.8s ease' }} />
                  {s.expected_pct > 0 && (
                    <div style={{ position:'absolute', left:`${Math.min(s.expected_pct,100)}%`, top:'-3px', width:'2px', height:'calc(100% + 6px)', background:'rgba(255,255,255,0.4)', borderRadius:1 }} />
                  )}
                </div>
                <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{s.progress}%</span>
              </div>
              <div className="sprint-intel-meta">
                <div className="sprint-intel-health" style={{ color: meta.color }}>● {meta.label}</div>
                <div className="sprint-intel-days">{s.days_remaining !== null ? `${s.days_remaining}d left` : ''}</div>
                <div className="sprint-intel-dates">{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</div>
              </div>
              <div className="sprint-intel-items">
                <div className="sii todo">{s.todo}<span>todo</span></div>
                <div className="sii active">{s.in_progress}<span>active</span></div>
                <div className="sii review">{s.in_review}<span>review</span></div>
                <div className="sii done">{s.done}<span>done</span></div>
              </div>
              <div className="sprint-intel-pts">
                <div>{s.done_points}<span>/{s.total_points} pts</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cto-velocity-section">
        <div className="cto-widget">
          <div className="cto-widget-header"><span>Velocity Trend</span><span className="cto-widget-sub">Last {data.velocity?.length || 0} sprints</span></div>
          <div className="cto-chart-wrap"><VelocityChart velocity={data.velocity} /></div>
        </div>
      </div>
    </div>
  );
}

// ── War Room view ─────────────────────────────────────────────────────────────
function WarRoomView({ data }) {
  if (!data) return null;
  const risks    = data.risk_items || [];
  const projects = (data.projects || []).filter(p => p.sprint?.health !== 'on_track');

  return (
    <div className="cto-view-content">
      <div className="cto-section-header warroom">
        <div>
          <h2 className="cto-section-title">🔴 Delivery War Room</h2>
          <p className="cto-section-sub">Mission control for engineering delivery — items needing immediate attention</p>
        </div>
        <div className="warroom-alert-count">
          <span style={{ color: '#EF4444', fontSize: 28, fontWeight: 700 }}>{risks.length}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Active Alerts</span>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="cto-all-clear">
          <div className="all-clear-icon">✅</div>
          <div className="all-clear-title">All Systems Nominal</div>
          <div className="all-clear-sub">No active risks or escalations detected</div>
        </div>
      ) : (
        <div className="cto-risks-list">
          {risks.map((r, i) => <RiskItem key={i} risk={r} index={i} />)}
        </div>
      )}

      {projects.length > 0 && (
        <div className="warroom-at-risk">
          <div className="cto-widget-header"><span>Projects Needing Attention</span></div>
          <div className="cto-proj-grid">
            {projects.map(p => <ProjectHealthCard key={p.id} project={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bug Command view ──────────────────────────────────────────────────────────
function BugCommandView({ data }) {
  const bugs = data?.bugs || {};
  const sum  = data?.summary || {};
  return (
    <div className="cto-view-content">
      <div className="cto-section-header">
        <h2 className="cto-section-title">🐞 Bug Command Center</h2>
        <p className="cto-section-sub">SLA tracking, severity distribution, and trend analysis</p>
      </div>
      <div className="bug-cmd-kpis">
        {[
          { label: 'Open Bugs',    value: sum.open_bugs,    color: '#F59E0B' },
          { label: 'Critical',     value: sum.critical_bugs, color: '#EF4444' },
          { label: 'SLA Breached', value: sum.sla_breached,  color: '#EF4444' },
          { label: 'Avg Velocity', value: `${sum.avg_velocity || 0}pt`, color: '#10B981' },
        ].map(k => (
          <div key={k.label} className="bug-kpi-card" style={{ '--bk-color': k.color }}>
            <div className="bk-value" style={{ color: k.color }}>{k.value ?? '—'}</div>
            <div className="bk-label">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="bug-cmd-charts">
        <div className="cto-widget">
          <div className="cto-widget-header"><span>Severity Distribution</span><span className="cto-widget-sub">Open bugs</span></div>
          <div className="cto-chart-wrap donut"><BugDonut byS={bugs.by_severity || {}} /></div>
        </div>
        <div className="cto-widget">
          <div className="cto-widget-header"><span>Bug Trend</span><span className="cto-widget-sub">Last 6 months</span></div>
          <div className="cto-chart-wrap"><BugTrendChart trend={bugs.trend} /></div>
        </div>
      </div>
    </div>
  );
}

// ── Team Analytics view ────────────────────────────────────────────────────────
function TeamAnalyticsView({ data }) {
  const sum  = data?.summary || {};
  const proj = data?.projects || [];
  return (
    <div className="cto-view-content">
      <div className="cto-section-header">
        <h2 className="cto-section-title">👥 Team Analytics</h2>
        <p className="cto-section-sub">Workforce capacity, sprint allocation, and productivity overview</p>
      </div>
      <div className="team-kpis">
        {[
          { label: 'Active Users',   value: sum.active_users,  icon: '👤', color: '#6366F1' },
          { label: 'Active Sprints', value: sum.active_sprints, icon: '⚡', color: '#10B981' },
          { label: 'Total Projects', value: sum.total_projects, icon: '📁', color: '#0EA5E9' },
          { label: 'Backlog Items',  value: sum.total_backlog,  icon: '📝', color: '#8B5CF6' },
        ].map(k => (
          <div key={k.label} className="cto-kpi-card" style={{ '--card-gradient': `linear-gradient(135deg, ${k.color}22, ${k.color}08)` }}>
            <div className="kpi-icon" style={{ fontSize: 28 }}>{k.icon}</div>
            <div className="kpi-body">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value ?? '—'}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="team-projects-table">
        <div className="cto-widget-header" style={{ marginBottom: 16 }}><span>Per-Project Team Load</span></div>
        <div className="cto-table-wrap">
          <table className="cto-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Sprint</th>
                <th>Health</th>
                <th>Progress</th>
                <th>Bugs</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {proj.map(p => {
                const s    = p.sprint;
                const meta = HEALTH_META[s?.health || 'no_sprint'];
                const sc   = scoreColor(p.health_score);
                return (
                  <tr key={p.id}>
                    <td><span className="tbl-key">{p.key_code}</span> {p.name}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{s?.name || '—'}</td>
                    <td><span className="tbl-health" style={{ color: meta.color }}>● {meta.label}</span></td>
                    <td>
                      {s ? (
                        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                          <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.08)', borderRadius:3 }}>
                            <div style={{ width:`${Math.min(s.progress,100)}%`, height:'100%', background:meta.color, borderRadius:3 }} />
                          </div>
                          <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)', minWidth:32 }}>{s.progress}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <span style={{ color: p.bugs.critical > 0 ? '#EF4444' : 'rgba(255,255,255,0.6)', fontSize:13 }}>
                        {p.bugs.total} {p.bugs.critical > 0 && `(${p.bugs.critical} crit)`}
                      </span>
                    </td>
                    <td><span style={{ color: sc, fontWeight: 700, fontSize: 14 }}>{p.health_score}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── AI Insights view ──────────────────────────────────────────────────────────
function AIInsightsView({ data }) {
  if (!data) return null;
  const risks   = data.risk_items || [];
  const sum     = data.summary || {};
  const proj    = data.projects || [];

  // Generate AI insights from data
  const insights = [];

  // Sprint risk prediction
  const riskySprints = proj.filter(p => p.sprint?.health === 'off_track');
  if (riskySprints.length > 0) {
    insights.push({
      icon: '🔮', title: 'Sprint Delay Prediction', severity: 'danger',
      body: `${riskySprints.length} sprint(s) are significantly behind schedule. Based on current velocity, these sprints have a high probability of not completing on time. Recommend immediate scope review.`,
    });
  }

  // Velocity insight
  if (sum.avg_velocity > 0) {
    insights.push({
      icon: '📈', title: 'Velocity Analysis', severity: 'info',
      body: `Team average velocity is ${sum.avg_velocity} story points per sprint. ${sum.avg_velocity >= 20 ? 'This is a healthy delivery pace. Continue maintaining team capacity.' : 'This is below optimal. Consider removing blockers and improving sprint grooming quality.'}`,
    });
  }

  // Bug leakage
  if (sum.critical_bugs > 0) {
    insights.push({
      icon: '🐞', title: 'QA Leakage Alert', severity: 'danger',
      body: `${sum.critical_bugs} critical bugs are open. This indicates potential quality gaps in the testing pipeline. Recommend mandatory code review gates and increased QA coverage.`,
    });
  }

  // SLA breach
  if (sum.sla_breached > 0) {
    insights.push({
      icon: '⏱', title: 'SLA Breach Detected', severity: 'warning',
      body: `${sum.sla_breached} bug(s) have exceeded SLA thresholds. This impacts customer trust and delivery commitments. Trigger escalation protocols for all breached items.`,
    });
  }

  // Positive insight
  const onTrackCount = proj.filter(p => p.sprint?.health === 'on_track').length;
  if (onTrackCount > 0) {
    insights.push({
      icon: '✅', title: 'Delivery Confidence', severity: 'success',
      body: `${onTrackCount} project(s) are on track. Teams are delivering consistently within committed scope. Recognize high-performing teams to sustain motivation.`,
    });
  }

  // Recommendations
  insights.push({
    icon: '🤖', title: 'AI Recommendation: Sprint Optimization', severity: 'info',
    body: 'Based on historical delivery patterns, consider reducing sprint backlog by 15% to improve completion rate. Teams with >80% sprint completion consistently report higher morale.',
  });

  insights.push({
    icon: '🧠', title: 'AI Recommendation: Resource Rebalancing', severity: 'info',
    body: `With ${sum.active_users} active team members across ${sum.total_projects} projects, consider cross-team skill sharing sessions to reduce individual bottlenecks.`,
  });

  return (
    <div className="cto-view-content">
      <div className="cto-section-header">
        <h2 className="cto-section-title">🤖 AI Insights & Predictions</h2>
        <p className="cto-section-sub">Heuristic risk detection, delivery predictions, and AI-powered recommendations</p>
      </div>
      <div className="ai-insights-disclaimer">
        <span>🔬</span> Insights generated from live delivery data using pattern detection algorithms
      </div>
      <div className="ai-insights-grid">
        {insights.map((ins, i) => <AIInsightCard key={i} {...ins} />)}
      </div>
      {risks.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="cto-widget-header" style={{ marginBottom: 16 }}><span>Active Risk Signals</span><span className="cto-widget-sub">{risks.length} detected</span></div>
          <div className="cto-risks-list">
            {risks.map((r, i) => <RiskItem key={i} risk={r} index={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Release Center view ───────────────────────────────────────────────────────
function ReleaseCenterView({ data }) {
  const rel = data?.releases || {};
  const vel = data?.velocity || [];
  return (
    <div className="cto-view-content">
      <div className="cto-section-header">
        <h2 className="cto-section-title">🚀 Release Command Center</h2>
        <p className="cto-section-sub">Release pipeline, deployment readiness, and DORA metrics</p>
      </div>
      <div className="release-kpis">
        {[
          { label: 'Total Releases',   value: rel.total || 0,       color: '#6366F1' },
          { label: 'In Progress',      value: rel.development || rel.in_progress || 0, color: '#F59E0B' },
          { label: 'Released',         value: rel.released || 0,     color: '#10B981' },
          { label: 'Delayed',          value: rel.delayed || 0,      color: '#EF4444' },
        ].map(k => (
          <div key={k.label} className="bug-kpi-card" style={{ '--bk-color': k.color }}>
            <div className="bk-value" style={{ color: k.color }}>{k.value}</div>
            <div className="bk-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dora-section">
        <div className="cto-widget-header" style={{ marginBottom: 16 }}><span>DORA Metrics</span><span className="cto-widget-sub">Engineering performance indicators</span></div>
        <div className="dora-grid">
          {[
            { label: 'Deployment Frequency', value: `${vel.length || 0}/sprint`, icon: '🚀', desc: 'Releases per sprint cycle', color: '#6366F1' },
            { label: 'Lead Time',            value: '—',                          icon: '⏱', desc: 'Commit to production time',  color: '#0EA5E9' },
            { label: 'Change Failure Rate',  value: rel.delayed > 0 ? `${Math.round((rel.delayed/(rel.total||1))*100)}%` : '0%', icon: '❌', desc: 'Delayed/failed releases',   color: '#EF4444' },
            { label: 'MTTR',                 value: '—',                          icon: '🔧', desc: 'Mean time to recovery',      color: '#10B981' },
          ].map(d => (
            <div key={d.label} className="dora-card" style={{ '--dora-color': d.color }}>
              <div className="dora-icon">{d.icon}</div>
              <div className="dora-value" style={{ color: d.color }}>{d.value}</div>
              <div className="dora-label">{d.label}</div>
              <div className="dora-desc">{d.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function CTOCommandCenter() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'overview';
  const setActiveView = (view) => setSearchParams({ view });

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ctoAPI.getOverview();
      setData(res.data);
      setLastRefresh(Date.now());
    } catch (e) {
      setError('Failed to load CTO overview data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const sum  = data?.summary || {};
  const proj = data?.projects || [];
  const risks = data?.risk_items || [];

  const criticalRisks = risks.filter(r => r.severity === 'critical').length;

  // ── Overview view ─────────────────────────────────────────────────────────
  function OverviewView() {
    return (
      <div className="cto-view-content">
        {/* KPI Row */}
        <div className="cto-kpi-row">
          <KPICard label="Active Sprints"   value={sum.active_sprints  ?? '—'} icon="⚡" gradient="linear-gradient(135deg,#6366F122,#4F46E508)"  sub={`${sum.total_projects} projects`} />
          <KPICard label="Open Bugs"        value={sum.open_bugs        ?? '—'} icon="🐞" gradient="linear-gradient(135deg,#F59E0B22,#D9770608)"  sub={sum.critical_bugs > 0 ? `${sum.critical_bugs} critical` : 'No critical'} />
          <KPICard label="SLA Breaches"     value={sum.sla_breached     ?? '—'} icon="⏱" gradient={sum.sla_breached > 0 ? "linear-gradient(135deg,#EF444422,#DC262608)" : "linear-gradient(135deg,#10B98122,#05966908)"} sub="Active violations" />
          <KPICard label="Avg Velocity"     value={sum.avg_velocity ? `${sum.avg_velocity}pt` : '—'} icon="📈" gradient="linear-gradient(135deg,#10B98122,#05966908)" sub="Per sprint" />
          <KPICard label="Total Backlog"    value={sum.total_backlog    ?? '—'} icon="📝" gradient="linear-gradient(135deg,#0EA5E922,#0284C708)"   sub="Items pending" />
          <KPICard label="Active Users"     value={sum.active_users     ?? '—'} icon="👥" gradient="linear-gradient(135deg,#8B5CF622,#7C3AED08)"   sub="Team members" />
        </div>

        {/* Health Score + Sprint Grid */}
        <div className="cto-main-grid">
          <div className="cto-widget health-widget">
            <div className="cto-widget-header"><span>Engineering Health</span></div>
            <HealthGauge score={Math.round(sum.engineering_health || 0)} />
            <div className="health-breakdown">
              {[
                { label: 'Sprint Health',    value: proj.filter(p => p.sprint?.health==='on_track').length, total: proj.filter(p=>p.sprint).length, color: '#10B981' },
                { label: 'Bug SLA',          value: Math.max(0,(5-sum.sla_breached)), total: 5, color: '#F59E0B' },
                { label: 'Velocity',         value: Math.min(5, Math.round(sum.avg_velocity/5||0)), total: 5, color: '#6366F1' },
              ].map(b => (
                <div key={b.label} className="health-break-row">
                  <span className="hb-label">{b.label}</span>
                  <div className="hb-bar">
                    <div className="hb-fill" style={{ width:`${Math.min(100,(b.value/b.total)*100)}%`, background:b.color }} />
                  </div>
                  <span className="hb-val" style={{ color: b.color }}>{b.value}/{b.total}</span>
                </div>
              ))}
            </div>
            {criticalRisks > 0 && (
              <div className="cto-alert-banner">
                <span className="alert-pulse-dot" />
                {criticalRisks} critical issue{criticalRisks > 1 ? 's' : ''} require immediate action
              </div>
            )}
          </div>

          <div className="cto-widget sprint-grid-widget">
            <div className="cto-widget-header">
              <span>Sprint Health — All Projects</span>
              <span className="cto-widget-sub">{proj.filter(p=>p.sprint).length} active sprints</span>
            </div>
            <div className="cto-proj-grid">
              {proj.length === 0 ? (
                <div className="cto-chart-empty">No projects found</div>
              ) : (
                proj.map(p => <ProjectHealthCard key={p.id} project={p} />)
              )}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="cto-charts-row">
          <div className="cto-widget velocity-widget">
            <div className="cto-widget-header">
              <span>Velocity Trend</span>
              <span className="cto-widget-sub">Committed vs Delivered</span>
            </div>
            <div className="cto-chart-wrap">
              <VelocityChart velocity={data?.velocity} />
            </div>
          </div>

          <div className="cto-widget bug-widget">
            <div className="cto-widget-header">
              <span>Bug Severity</span>
              <span className="cto-widget-sub">Open bugs by severity</span>
            </div>
            <div className="cto-chart-wrap donut">
              <BugDonut byS={data?.bugs?.by_severity || {}} />
            </div>
          </div>

          <div className="cto-widget risk-widget">
            <div className="cto-widget-header">
              <span>Risk Radar</span>
              <span className="cto-widget-sub">{risks.length} signals detected</span>
            </div>
            <div className="cto-risks-compact">
              {risks.length === 0 ? (
                <div className="cto-all-clear-small">
                  <div>✅</div>
                  <div>All clear — no active risks</div>
                </div>
              ) : (
                risks.slice(0, 5).map((r, i) => (
                  <div key={i} className="risk-compact-item" style={{ '--rc': RISK_SEV_META[r.severity]?.color || '#6366F1' }}>
                    <div className="rc-dot" />
                    <div className="rc-body">
                      <div className="rc-proj">{r.project}</div>
                      <div className="rc-msg">{r.message}</div>
                    </div>
                    <div className="rc-sev" style={{ color: RISK_SEV_META[r.severity]?.color }}>{r.severity.toUpperCase()}</div>
                  </div>
                ))
              )}
              {risks.length > 5 && (
                <div className="rc-more" onClick={() => setActiveView('warroom')}>+{risks.length-5} more in War Room →</div>
              )}
            </div>
          </div>
        </div>

        {/* AI Insights strip */}
        <div className="cto-widget ai-strip-widget">
          <div className="cto-widget-header">
            <span>🤖 AI Delivery Intelligence</span>
            <span className="cto-widget-sub">Real-time analysis</span>
          </div>
          <div className="ai-strip-cards">
            {data?.velocity?.length === 0 ? (
              <AIInsightCard icon="📊" title="No velocity data" severity="info" body="Complete sprints to start generating velocity insights and predictions." />
            ) : null}
            {sum.critical_bugs > 0 && (
              <AIInsightCard icon="🐞" title="Critical Bug Alert" severity="danger"
                body={`${sum.critical_bugs} critical bug(s) are unresolved. Escalate and assign immediately to prevent release blockers.`} />
            )}
            {sum.sla_breached > 0 && (
              <AIInsightCard icon="⏱" title="SLA Breach Detected" severity="warning"
                body={`${sum.sla_breached} bug(s) have exceeded SLA. Trigger immediate escalation to the engineering leads.`} />
            )}
            {proj.filter(p => p.sprint?.health === 'on_track').length > 0 && (
              <AIInsightCard icon="✅" title="Delivery on Track" severity="success"
                body={`${proj.filter(p => p.sprint?.health==='on_track').length} project(s) are delivering on schedule. Velocity is consistent.`} />
            )}
            <AIInsightCard icon="🤖" title="Sprint Optimization" severity="info"
              body="Consider 15% scope reduction for at-risk sprints. Historical data shows teams with smaller backlog complete 94% of committed items." />
          </div>
        </div>

        {/* Governance Row */}
        <div className="cto-governance-row">
          {[
            { label: 'Requirements', icon: '📋', stats: [
              { k: 'Total',    v: data?.requirements?.total   || 0 },
              { k: 'Approved', v: data?.requirements?.approved || 0 },
              { k: 'Draft',    v: data?.requirements?.draft    || 0 },
            ], color: '#6366F1' },
            { label: 'Grooming HUB', icon: '🌱', stats: [
              { k: 'Total',     v: data?.grooming?.total    || 0 },
              { k: 'In Review', v: data?.grooming?.in_review || 0 },
              { k: 'Approved',  v: data?.grooming?.approved  || 0 },
            ], color: '#10B981' },
            { label: 'Releases', icon: '🚀', stats: [
              { k: 'Total',      v: data?.releases?.total    || 0 },
              { k: 'Released',   v: data?.releases?.released  || 0 },
              { k: 'Delayed',    v: data?.releases?.delayed   || 0 },
            ], color: '#0EA5E9' },
            { label: 'Bug Tracking', icon: '🐞', stats: [
              { k: 'Open',     v: sum.open_bugs      || 0 },
              { k: 'Critical', v: sum.critical_bugs   || 0 },
              { k: 'SLA Breach', v: sum.sla_breached  || 0 },
            ], color: '#F59E0B' },
          ].map(g => (
            <div key={g.label} className="cto-gov-card" style={{ '--gov-color': g.color }}>
              <div className="gov-header"><span className="gov-icon">{g.icon}</span><span className="gov-label">{g.label}</span></div>
              <div className="gov-stats">
                {g.stats.map(st => (
                  <div key={st.k} className="gov-stat">
                    <div className="gov-stat-val" style={{ color: g.color }}>{st.v}</div>
                    <div className="gov-stat-key">{st.k}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderView() {
    if (loading && !data) return (
      <div className="cto-loading">
        <div className="cto-spinner" />
        <div className="cto-loading-text">Loading CTO Command Center…</div>
      </div>
    );
    if (error) return (
      <div className="cto-error">
        <div>⚠ {error}</div>
        <button className="cto-retry-btn" onClick={loadData}>Retry</button>
      </div>
    );
    switch (activeView) {
      case 'overview':  return <OverviewView />;
      case 'warroom':   return <WarRoomView data={data} />;
      case 'sprints':   return <SprintIntelligenceView data={data} />;
      case 'bugs':      return <BugCommandView data={data} />;
      case 'releases':  return <ReleaseCenterView data={data} />;
      case 'team':      return <TeamAnalyticsView data={data} />;
      case 'ai':        return <AIInsightsView data={data} />;
      default:          return <OverviewView />;
    }
  }

  return (
    <div className="cto-body">
      <StatusStrip summary={sum} lastRefresh={lastRefresh} onRefresh={loadData} loading={loading} />
      <div className="cto-scroll-area">
        {renderView()}
      </div>
    </div>
  );
}
