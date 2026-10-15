import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const verificationRequests = new Map();

function verifyToken(token) {
  if (!verificationRequests.has(token)) {
    verificationRequests.set(
      token,
      api.get('/auth/verify-email', { params: { token } })
    );
  }
  return verificationRequests.get(token);
}

export default function VerifyEmailPage() {
  const [status, setStatus]   = useState('verifying'); // verifying | success | error | expired
  const [message, setMessage] = useState('');
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { completeLogin, logout } = useAuth();
  const token     = params.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No token found in URL.'); return; }

    verifyToken(token)
      .then(res => {
        const { token: jwt, user } = res.data;
        completeLogin(jwt, user);
        setStatus('success');
        setTimeout(() => navigate('/'), 2000);
      })
      .catch(err => {
        const msg = err.response?.data?.error;
        logout();
        if (msg === 'expired') {
          setStatus('expired');
        } else {
          setStatus('error');
          setMessage(msg === 'invalid_token'
            ? 'This link is invalid or has been replaced by a newer verification email. Open the latest verification email or request another link from the login page.'
            : msg || 'Verification failed.');
        }
      });
  }, [token, completeLogin]);

  const icon    = { verifying:'⏳', success:'✅', error:'❌', expired:'⌛' }[status];
  const heading = {
    verifying: 'Verifying your email...',
    success:   'Email verified!',
    error:     'Verification failed',
    expired:   'Link expired',
  }[status];
  const color = {
    verifying: 'var(--accent)',
    success:   'var(--success)',
    error:     'var(--danger)',
    expired:   'var(--warn)',
  }[status];

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}>
            <div style={{ fontSize:'28px', fontWeight:'600', letterSpacing:'-0.5px' }}>
              <span style={{ color:'var(--accent)' }}>In</span>
              <span style={{ fontWeight:'300' }}>ventra</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ textAlign:'center', padding:'36px 24px' }}>
          <div style={{ fontSize:'52px', marginBottom:'16px' }}>{icon}</div>
          <div style={{ fontSize:'17px', fontWeight:'600', color, marginBottom:'10px' }}>{heading}</div>

          {status === 'verifying' && (
            <div style={{ color:'var(--muted)', fontSize:'13px' }}>
              <span className="spinner" style={{ display:'inline-block', marginRight:'8px' }}/>
              Please wait...
            </div>
          )}

          {status === 'success' && (
            <div style={{ color:'var(--muted)', fontSize:'13px' }}>
              Your account is now active. Redirecting to the app...
            </div>
          )}

          {status === 'expired' && (
            <>
              <div style={{ color:'var(--muted)', fontSize:'13px', marginBottom:'20px' }}>
                Your verification link has expired. Request a new one from the login page.
              </div>
              <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ color:'var(--muted)', fontSize:'13px', marginBottom:'20px' }}>
                {message || 'Something went wrong. Please try again.'}
              </div>
              <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}