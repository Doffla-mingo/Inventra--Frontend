import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/',          label: 'Scanner'   },
  { to: '/inventory', label: 'Inventory' },
  { to: '/triggers',  label: 'Triggers'  },
  { to: '/discounts', label: 'Discounts' },
  { to: '/settings',  label: 'Settings'  },
  { to: '/growth',   label: 'Growth'   },
  { to: '/forecast', label: '🔮 Forecast' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 24px', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
          <div style={{ fontSize:'16px', fontWeight:'600', letterSpacing:'-0.3px' }}>
            <span style={{ color:'var(--accent)' }}>In</span>
            <span style={{ fontWeight:'300' }}>ventra</span>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display:'flex', gap:'3px' }}>
          {navItems.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              style={({ isActive }) => ({
                padding:'6px 14px', borderRadius:'7px', textDecoration:'none',
                fontSize:'12px', transition:'all .18s',
                background: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--muted)',
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
              })}>
              {n.label}
            </NavLink>
          ))}
        </div>

        {/* User bar */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'11px', color:'var(--muted)' }}>{user?.email}</span>
          <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'var(--accent2)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'12px', fontWeight:'500', color:'#fff' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <button className="btn btn-ghost" style={{ padding:'5px 12px', fontSize:'11px' }}
            onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>
        <Outlet />
      </div>
    </div>
  );
}