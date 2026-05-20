import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';
import './AdminLogs.css';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);

  const load = async (p = page) => {
    try {
      const res = await adminAPI.getLogs({ page: p, limit: 50, user_id: filterUser || undefined, action: filterAction || undefined });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); setPage(1); }, [filterUser, filterAction]);
  useEffect(() => { load(page); }, [page]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(), 10000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, page, filterUser, filterAction]);

  const ACTION_COLORS = {
    login: { bg: '#D1FAE5', color: '#065F46' },
    create_user: { bg: '#DBEAFE', color: '#1E40AF' },
    delete_user: { bg: '#FEE2E2', color: '#991B1B' },
    update_user: { bg: '#FEF3C7', color: '#92400E' },
  };

  const getActionStyle = (action) => ACTION_COLORS[action] || { bg: '#F3F4F6', color: '#374151' };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="admin-logs">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="page-subtitle">{total} total log entries</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="auto-refresh-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            <span>Auto-refresh (10s)</span>
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => load()}>↻ Refresh</button>
        </div>
      </div>

      <div className="logs-filters">
        <input className="form-control" style={{ width: 160 }} value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="Filter by user ID..." />
        <input className="form-control" style={{ width: 200 }} value={filterAction} onChange={e => setFilterAction(e.target.value)} placeholder="Filter by action..." />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const ac = getActionStyle(log.action);
              return (
                <tr key={log.id}>
                  <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div>
                      <div className="font-medium">{log.user_name || 'System'}</div>
                      {log.user_email && <div className="text-sm text-muted">{log.user_email}</div>}
                    </div>
                  </td>
                  <td>
                    <span className="action-badge" style={{ background: ac.bg, color: ac.color }}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="text-sm">
                    {log.entity_type && <span>{log.entity_type} #{log.entity_id}</span>}
                  </td>
                  <td className="text-sm text-muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                  <td className="text-sm text-muted">{log.ip_address || '—'}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="logs-pagination">
        <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span className="text-muted text-sm">Page {page} · {total} entries</span>
        <button className="btn btn-secondary btn-sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
