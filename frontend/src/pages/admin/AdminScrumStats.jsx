import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';
import './AdminScrumStats.css';

export default function AdminScrumStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getScrumStats()
      .then(res => setStats(res.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!stats) return null;

  const statCards = [
    { label: 'Total Projects', value: stats.total_projects, icon: '📁', color: '#4F46E5' },
    { label: 'Active Sprints', value: stats.active_sprints, icon: '🏃', color: '#10B981' },
    { label: 'Total Backlog Items', value: stats.total_items, icon: '📝', color: '#F59E0B' },
    { label: 'Avg Sprint Velocity', value: `${stats.avg_velocity}%`, icon: '⚡', color: '#7C3AED' },
  ];

  return (
    <div className="admin-stats">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scrum Stats</h1>
          <p className="page-subtitle">Aggregate project & sprint metrics</p>
        </div>
      </div>

      <div className="stats-cards">
        {statCards.map(card => (
          <div key={card.label} className="stat-card card">
            <div className="stat-icon" style={{ background: card.color + '20', color: card.color }}>{card.icon}</div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="stats-table-header">Per-Sprint Breakdown</div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Sprint</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Total Points</th>
              <th>Completed Points</th>
              <th>Velocity</th>
            </tr>
          </thead>
          <tbody>
            {stats.sprints.map(s => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                <td className="text-sm text-muted">{new Date(s.start_date).toLocaleDateString()}</td>
                <td className="text-sm text-muted">{new Date(s.end_date).toLocaleDateString()}</td>
                <td>{s.total_pts}</td>
                <td>{s.completed_pts}</td>
                <td>
                  <div className="velocity-cell">
                    <div className="velocity-bar">
                      <div className="velocity-fill" style={{ width: `${s.velocity_pct}%` }} />
                    </div>
                    <span className="velocity-pct">{s.velocity_pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {stats.sprints.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No sprint data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
