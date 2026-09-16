import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, emailsAPI } from '../services/api';
import { useToast } from '../components/Toast';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: user?.name||'', store_name: user?.store_name||'' });
  const [notifs, setNotifs]   = useState(user?.notifications || { lowStock:true, expiry:true, expired:true, daily:false });
  const [passwords, setPasswords] = useState({ current_password:'', new_password:'' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass]       = useState(false);
  const [sendingTest, setSendingTest]     = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await authAPI.profile({ name: profile.name, store_name: profile.store_name, notifications: notifs });
      updateUser({ name: profile.name, store_name: profile.store_name, notifications: notifs });
      toast.success('Profile saved!');
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (!passwords.current_password || !passwords.new_password) return toast.error('Both passwords required');
    if (passwords.new_password.length < 6) return toast.error('New password must be at least 6 characters');
    setSavingPass(true);
    try {
      await authAPI.password(passwords);
      toast.success('Password changed!');
      setPasswords({ current_password:'', new_password:'' });
    } catch (err) { toast.error(err.response?.data?.error || 'Change failed'); }
    finally { setSavingPass(false); }
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      await emailsAPI.sendTest();
      toast.success(`Test email sent to ${user?.email}!`);
    } catch { toast.error('Failed to send test email'); }
    finally { setSendingTest(false); }
  };

  const NotifRow = ({ label, k }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:'13px' }}>{label}</span>
      <label className="toggle">
        <input type="checkbox" checked={!!notifs[k]}
          onChange={e => setNotifs(n => ({ ...n, [k]: e.target.checked }))} />
        <span className="toggle-slider" />
      </label>
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
      <h2 style={{ fontSize:'16px', fontWeight:'500', marginBottom:'20px' }}>Account & Settings</h2>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px', maxWidth:'900px' }}>

        {/* Profile */}
        <div className="card">
          <div className="section-title">Account details</div>
          <div style={{ marginBottom:'10px', padding:'10px 12px', background:'var(--bg)',
            borderRadius:'8px', fontSize:'12px', color:'var(--muted)' }}>
            Email: <strong style={{ color:'var(--accent)' }}>{user?.email}</strong>
            <div style={{ fontSize:'11px', marginTop:'2px' }}>Alert emails will be sent to this address</div>
          </div>
          <div className="form-group">
            <label>Full name</label>
            <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Store / Business name</label>
            <input value={profile.store_name} onChange={e => setProfile(p => ({ ...p, store_name: e.target.value }))} />
          </div>
          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? <><span className="spinner" /> Saving...</> : 'Save changes'}
          </button>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="section-title">Email notifications</div>
          <NotifRow label="Low stock alerts"         k="lowStock" />
          <NotifRow label="Expiry warnings"          k="expiry" />
          <NotifRow label="Expired product alerts"   k="expired" />
          <NotifRow label="Daily inventory summary"  k="daily" />
          <div style={{ marginTop:'16px', paddingTop:'14px', borderTop:'1px solid var(--border)' }}>
            <div className="section-title">Test email</div>
            <p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'10px' }}>
              Send a test alert to <strong style={{ color:'var(--text)' }}>{user?.email}</strong>
            </p>
            <button className="btn btn-ghost btn-full" onClick={sendTest} disabled={sendingTest}>
              {sendingTest ? <><span className="spinner" /> Sending...</> : 'Send test email'}
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="section-title">Change password</div>
          <div className="form-group">
            <label>Current password</label>
            <input type="password" value={passwords.current_password}
              onChange={e => setPasswords(p => ({ ...p, current_password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={passwords.new_password}
              onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))} />
          </div>
          <button className="btn btn-warn btn-full" onClick={changePassword} disabled={savingPass}>
            {savingPass ? <><span className="spinner" /> Updating...</> : 'Change password'}
          </button>
        </div>

        {/* Account info */}
        <div className="card">
          <div className="section-title">Account info</div>
          {[
            { label:'Name',       value: user?.name },
            { label:'Email',      value: user?.email },
            { label:'Store',      value: user?.store_name },
            { label:'Role',       value: user?.role },
          ].map(r => (
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between',
              padding:'9px 0', borderBottom:'1px solid var(--border)', fontSize:'12px' }}>
              <span style={{ color:'var(--muted)' }}>{r.label}</span>
              <span style={{ fontWeight:'500' }}>{r.value}</span>
            </div>
          ))}
          <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid var(--border)' }}>
            <p style={{ fontSize:'11px', color:'var(--muted)' }}>
              Daily cron runs at 8:00 AM — checks all triggers and sends emails automatically.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
