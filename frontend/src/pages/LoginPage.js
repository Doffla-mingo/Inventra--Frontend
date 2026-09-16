import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../services/api';

export default function LoginPage() {
  const [tab, setTab]           = useState('login');
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({ name:'', email:'', password:'', store_name:'' });
  const [pendingEmail, setPendingEmail] = useState(''); // show "check your inbox" screen
  const [resending, setResending]       = useState(false);
  const { login, register }     = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async e => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Email and password required');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === 'email_not_verified') {
        setPendingEmail(data.email || form.email);
      } else {
        toast.error(data?.error || 'Login failed');
      }
    } finally { setLoading(false); }
  };

  const handleRegister = async e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('All fields required');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      if (res.data.message === 'verification_sent') {
        setPendingEmail(res.data.email || form.email);
      } else {
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: pendingEmail });
      toast.success('Verification email resent — check your inbox');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resend');
    } finally { setResending(false); }
  };

  const Logo = () => (
    <div style={{ textAlign:'center', marginBottom:'32px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'8px' }}>
        <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="12" fill="#1a1e28"/>
          <rect x="4" y="4" width="56" height="56" rx="10" fill="none" stroke="#4f8ef7" strokeWidth="2"/>
          <rect x="10" y="10" width="18" height="18" rx="3" fill="#4f8ef7"/>
          <rect x="36" y="10" width="18" height="18" rx="3" fill="#4f8ef7"/>
          <rect x="10" y="36" width="18" height="18" rx="3" fill="#4f8ef7"/>
          <rect x="30" y="30" width="7" height="7" rx="1" fill="#7c5cfc"/>
          <rect x="38" y="38" width="7" height="7" rx="1" fill="#7c5cfc"/>
          <rect x="38" y="30" width="7" height="7" rx="1" fill="#4f8ef7" opacity="0.5"/>
          <rect x="30" y="38" width="7" height="7" rx="1" fill="#4f8ef7" opacity="0.5"/>
          <line x1="4" y1="32" x2="60" y2="32" stroke="#22c55e" strokeWidth="2" opacity="0.9"/>
          <circle cx="60" cy="32" r="3" fill="#22c55e"/>
        </svg>
        <div style={{ fontSize:'32px', fontWeight:'600', letterSpacing:'-0.5px' }}>
          <span style={{ color:'var(--accent)' }}>In</span>
          <span style={{ fontWeight:'300' }}>ventra</span>
        </div>
      </div>
      <div style={{ color:'var(--muted)', fontSize:'13px' }}>Inventory Intelligence Platform</div>
    </div>
  );

  // ── "Check your inbox" screen ─────────────────────────────────────────────
  if (pendingEmail) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <Logo />
        <div className="card" style={{ textAlign:'center', padding:'32px 24px' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📬</div>
          <div style={{ fontSize:'16px', fontWeight:'600', marginBottom:'8px' }}>Check your inbox</div>
          <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'6px' }}>
            We sent a verification link to
          </div>
          <div style={{ fontSize:'14px', fontWeight:'600', color:'var(--accent)', marginBottom:'20px', wordBreak:'break-all' }}>
            {pendingEmail}
          </div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'24px', lineHeight:'1.6' }}>
            Click the link in the email to activate your account.<br/>
            The link expires in <strong>24 hours</strong>.
          </div>
          <button className="btn btn-ghost btn-full" onClick={resendVerification} disabled={resending}>
            {resending ? <><span className="spinner"/> Sending...</> : '↻ Resend verification email'}
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop:'8px', fontSize:'11px', color:'var(--muted)' }}
            onClick={() => { setPendingEmail(''); setTab('login'); }}>
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <Logo />
        <div className="card">
          {/* Tabs */}
          <div style={{ display:'flex', background:'var(--bg)', borderRadius:'8px', padding:'3px', marginBottom:'22px' }}>
            {['login','register'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex:1, padding:'8px', borderRadius:'6px', border:'none', cursor:'pointer',
                  fontFamily:'var(--font)', fontSize:'13px', transition:'all .2s',
                  background: tab===t ? 'var(--card)' : 'transparent',
                  color: tab===t ? 'var(--text)' : 'var(--muted)',
                }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email address</label>
                <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? <><span className="spinner"/> Signing in...</> : 'Sign In'}
              </button>
              <div style={{ textAlign:'center', margin:'14px 0', color:'var(--muted)', fontSize:'12px' }}>— demo account —</div>
              <button type="button" className="btn btn-ghost btn-full"
                onClick={() => setForm(f => ({ ...f, email:'demo@inventra.com', password:'demo123' }))}>
                Fill demo credentials
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full name</label>
                <input placeholder="Your name" value={form.name} onChange={set('name')} />
              </div>
              <div className="form-group">
                <label>Email address</label>
                <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} />
              </div>
              <div className="form-group">
                <label>Store / Business name</label>
                <input placeholder="My Store" value={form.store_name} onChange={set('store_name')} />
              </div>
              <button className="btn btn-success btn-full" type="submit" disabled={loading}>
                {loading ? <><span className="spinner"/> Creating account...</> : 'Create Account'}
              </button>
              <div style={{ fontSize:'11px', color:'var(--muted)', textAlign:'center', marginTop:'12px', lineHeight:'1.5' }}>
                A verification email will be sent to your address.<br/>You must verify before signing in.
              </div>
            </form>
          )}
        </div>
        <div style={{ textAlign:'center', marginTop:'20px', fontSize:'11px', color:'var(--muted)' }}>
          © 2026 Inventra · Inventory Intelligence Platform
        </div>
      </div>
    </div>   
  );
}