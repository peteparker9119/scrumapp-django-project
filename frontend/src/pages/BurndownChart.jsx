import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import { sprintAPI } from '../services/api';
import { useProject } from '../context/ProjectContext';
import './BurndownChart.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function generateIdealLine(startDate, endDate, totalPoints) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      points: Math.max(0, totalPoints - (totalPoints / (days - 1)) * i),
    };
  });
}

export default function BurndownChart() {
  const { currentProject } = useProject();
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject) { setLoading(false); return; }
    sprintAPI.getAll({ project_id: currentProject.id })
      .then(res => {
        setSprints(res.data);
        const active = res.data.find(s => s.status === 'active');
        if (active) setSelectedSprintId(String(active.id));
      })
      .catch(() => toast.error('Failed to load sprints'))
      .finally(() => setLoading(false));
  }, [currentProject]);

  useEffect(() => {
    if (!selectedSprintId) { setData(null); return; }
    sprintAPI.getBurndown(selectedSprintId)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load burndown data'));
  }, [selectedSprintId]);

  const chartData = React.useMemo(() => {
    if (!data) return null;
    const ideal = generateIdealLine(data.sprint.start_date, data.sprint.end_date, data.total_points);
    const snapMap = {};
    // Normalize snapshot_date: MySQL DATE columns are returned as ISO datetimes ("2026-05-19T00:00:00.000Z")
    // but labels use plain date strings ("2026-05-19"), so we strip the time portion.
    data.snapshots.forEach(s => {
      const dateKey = typeof s.snapshot_date === 'string' ? s.snapshot_date.split('T')[0] : s.snapshot_date;
      snapMap[dateKey] = s.remaining_points;
    });

    const labels = ideal.map(d => d.date);
    const idealLine = ideal.map(d => parseFloat(d.points.toFixed(1)));
    const actualLine = labels.map(d => snapMap[d] !== undefined ? snapMap[d] : null);

    return {
      labels,
      datasets: [
        {
          label: 'Ideal Burndown',
          data: idealLine,
          borderColor: '#94A3B8',
          borderDash: [6, 4],
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.1,
        },
        {
          label: 'Actual Remaining',
          data: actualLine,
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79,70,229,0.08)',
          fill: true,
          pointBackgroundColor: '#4F46E5',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.3,
          spanGaps: false,
        },
      ],
    };
  }, [data]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} points`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: '#F1F5F9' },
        ticks: { maxTicksLimit: 10, color: '#64748B', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#F1F5F9' },
        ticks: { color: '#64748B', font: { size: 11 } },
        title: { display: true, text: 'Story Points Remaining', color: '#64748B' },
      },
    },
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  if (!currentProject) return (
    <div>
      <h1 className="page-title">Burndown Chart</h1>
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', marginTop: 20 }}>
        Please select a project from the Dashboard first.
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Burndown Chart</h1>
          <p className="page-subtitle">{currentProject.name} · Sprint Progress</p>
        </div>
        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={selectedSprintId}
          onChange={e => setSelectedSprintId(e.target.value)}
        >
          <option value="">Select Sprint...</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
      </div>

      {!selectedSprintId && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Select a sprint to view its burndown chart.
        </div>
      )}

      {data && (
        <>
          <div className="burndown-stats">
            {[
              { label: 'Total Points', value: data.total_points, icon: '📊', color: '#4F46E5' },
              { label: 'Completed', value: data.snapshots[data.snapshots.length - 1]?.completed_points || 0, icon: '✅', color: '#10B981' },
              { label: 'Remaining', value: data.snapshots[data.snapshots.length - 1]?.remaining_points ?? data.total_points, icon: '⏳', color: '#F59E0B' },
              { label: 'Sprint Days', value: Math.ceil((new Date(data.sprint.end_date) - new Date(data.sprint.start_date)) / (1000 * 60 * 60 * 24)) + 1, icon: '📅', color: '#7C3AED' },
            ].map((s, i) => (
              <div key={i} className="burndown-stat card">
                <div className="bs-icon" style={{ color: s.color }}>{s.icon}</div>
                <div className="bs-value" style={{ color: s.color }}>{s.value}</div>
                <div className="bs-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card burndown-chart-wrap">
            <div className="chart-header">
              <div className="chart-title">{data.sprint.name} — Burndown</div>
              <div className="chart-dates">
                {new Date(data.sprint.start_date).toLocaleDateString()} → {new Date(data.sprint.end_date).toLocaleDateString()}
              </div>
            </div>
            {data.sprint.goal && <div className="sprint-goal-text">Goal: {data.sprint.goal}</div>}
            <div className="chart-container">
              {chartData && <Line data={chartData} options={chartOptions} />}
            </div>
          </div>

          {data.snapshots.length > 0 && (
            <div className="card burndown-table">
              <div style={{ padding: '16px 20px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Daily Progress</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Points</th>
                    <th>Completed</th>
                    <th>Remaining</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((s, i) => (
                    <tr key={i}>
                      <td>{new Date(s.snapshot_date).toLocaleDateString()}</td>
                      <td>{s.total_points}</td>
                      <td style={{ color: '#10B981', fontWeight: 600 }}>{s.completed_points}</td>
                      <td style={{ color: '#EF4444', fontWeight: 600 }}>{s.remaining_points}</td>
                      <td>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${s.total_points > 0 ? (s.completed_points / s.total_points) * 100 : 0}%` }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {s.total_points > 0 ? Math.round((s.completed_points / s.total_points) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.snapshots.length === 0 && (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', marginTop: 16 }}>
              No progress data yet. Move items to "Done" on the Kanban board to generate burndown data.
            </div>
          )}
        </>
      )}
    </div>
  );
}
