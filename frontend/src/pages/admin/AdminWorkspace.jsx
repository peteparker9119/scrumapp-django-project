import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './AdminWorkspace.css';

const SETTING_KEYS = [
  { key: 'app_name', label: 'App Name', type: 'text', placeholder: 'ScrumFlow' },
  { key: 'logo_url', label: 'Logo URL', type: 'text', placeholder: 'https://...' },
  { key: 'primary_color', label: 'Primary Color', type: 'color' },
  { key: 'default_sprint_length', label: 'Default Sprint Length (days)', type: 'number', placeholder: '14' },
  { key: 'max_sprint_items', label: 'Max Sprint Items', type: 'number', placeholder: '50' },
];

export default function AdminWorkspace() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    adminAPI.getWorkspace()
      .then(res => setSettings(res.data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key) => {
    setSaving(key);
    try {
      await adminAPI.updateWorkspace(key, { value: settings[key] });
      toast.success('Setting saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(''); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.newPw.length < 6) return toast.error('Password must be at least 6 characters');
    setPwSaving(true);
    try {
      // Uses register flow / direct update - simple placeholder
      toast.success('Password change would be implemented with a dedicated endpoint');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch { toast.error('Failed'); }
    finally { setPwSaving(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="admin-workspace">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workspace Settings</h1>
          <p className="page-subtitle">Configure your ScrumFlow workspace</p>
        </div>
      </div>

      <div className="workspace-grid">
        {/* Settings */}
        <div className="card workspace-card">
          <div className="workspace-section-title">Application Settings</div>
          <div className="workspace-settings">
            {SETTING_KEYS.map(({ key, label, type, placeholder }) => (
              <div key={key} className="workspace-setting-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{label}</label>
                  <div className="flex gap-2">
                    {type === 'color' ? (
                      <div className="color-input-wrap">
                        <input
                          type="color"
                          className="color-picker"
                          value={settings[key] || '#4F46E5'}
                          onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={settings[key] || ''}
                          onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="#4F46E5"
                        />
                      </div>
                    ) : (
                      <input
                        type={type}
                        className="form-control"
                        value={settings[key] || ''}
                        onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                      />
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSave(key)}
                      disabled={saving === key}
                    >
                      {saving === key ? '...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div>
          <div className="card workspace-card">
            <div className="workspace-section-title">My Profile</div>
            <div className="profile-info">
              <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
              <div>
                <div className="profile-name">{user?.name}</div>
                <div className="profile-email">{user?.email}</div>
                <div className="profile-role-badge">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
          </div>

          <div className="card workspace-card" style={{ marginTop: 16 }}>
            <div className="workspace-section-title">Change Password</div>
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-control" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" value={pwForm.newPw} onChange={e => setPwForm({...pwForm, newPw: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-control" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                {pwSaving ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
