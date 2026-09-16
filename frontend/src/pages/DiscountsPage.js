import React, { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/Toast';
import ChatBot from '../components/ChatBot';

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { const r = await productsAPI.discounts(); setDiscounts(r.data); }
    catch { toast.error('Failed to load discounts'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'500' }}>AI Discount Recommendations</h2>
          <button className="btn btn-primary" onClick={load} disabled={loading}>Recalculate</button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : discounts.length === 0 ? (
          <div className="empty-state">
            <h3>No discounts needed</h3>
            <p style={{ fontSize:'12px', marginTop:'4px' }}>All products are well within their expiry dates</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'14px' }}>
            {discounts.map(p => (
              <div key={p.id} style={{ background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:'14px', padding:'16px', position:'relative', overflow:'hidden' }}>
                {/* top bar */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px',
                  background: p.discount_tier==='hot'?'var(--danger)':p.discount_tier==='medium'?'var(--warn)':'var(--success)' }} />

                <span className={`badge ${p.discount_tier==='hot'?'badge-danger':p.discount_tier==='medium'?'badge-warn':'badge-ok'}`}
                  style={{ marginBottom:'8px' }}>
                  {p.discount_tier==='hot' ? 'Urgent' : 'Recommended'}
                </span>

                <div style={{ fontWeight:'500', marginBottom:'4px' }}>{p.name}</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'8px' }}>{p.category} · {p.supplier}</div>

                <div style={{ fontSize:'26px', fontWeight:'600',
                  color: p.discount_tier==='hot'?'var(--danger)':p.discount_tier==='medium'?'var(--warn)':'var(--success)' }}>
                  {p.discount_pct}% OFF
                </div>
                <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'10px' }}>{p.discount_label}</div>

                <div style={{ display:'flex', alignItems:'baseline', gap:'7px' }}>
                  <span style={{ fontSize:'16px', fontWeight:'500' }}>₹{p.sale_price}</span>
                  <span style={{ fontSize:'11px', color:'var(--muted)', textDecoration:'line-through' }}>₹{p.price}</span>
                  <span style={{ fontSize:'11px', color:'var(--success)' }}>save ₹{p.savings}</span>
                </div>

                <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'6px' }}>
                  Expiry: {p.expiry_date} · Qty: {p.quantity}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ChatBot products={discounts} />
    </div>
  );
}
