import React, { useState, useEffect } from 'react';
import { triggersAPI, emailsAPI } from '../services/api';
import { useToast } from '../components/Toast';
import ChatBot from '../components/ChatBot';

export default function TriggersPage() {
  const [triggers, setTriggers] = useState([]);
  const [emails, setEmails]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [checking, setChecking] = useState(false);
  const [form, setForm]         = useState({ product_name:'', trigger_type:'quantity', threshold:'' });
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [tr, em] = await Promise.all([triggersAPI.list(), emailsAPI.list({ limit: 20 })]);
      setTriggers(tr.data);
      setEmails(em.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const addTrigger = async () => {
    if (!form.product_name || !form.threshold) return toast.error('Product name and threshold required');
    try {
      await triggersAPI.create({ ...form, threshold: parseInt(form.threshold) });
      toast.success('Trigger added');
      setForm({ product_name:'', trigger_type:'quantity', threshold:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add trigger'); }
  };

  const toggleTrigger = async (t) => {
    try {
      await triggersAPI.update(t.id, { enabled: !t.enabled });
      load();
    } catch { toast.error('Failed to update'); }
  };

  const deleteTrigger = async (id) => {
    try { await triggersAPI.delete(id); toast.success('Trigger deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const r = await triggersAPI.check();
      toast.success(`Checked! ${r.data.low_stock_alerts} stock + ${r.data.expiry_alerts} expiry alerts sent`);
      load();
    } catch { toast.error('Check failed'); }
    finally { setChecking(false); }
  };

  const qtyTriggers = triggers.filter(t => t.trigger_type === 'quantity');
  const expTriggers = triggers.filter(t => t.trigger_type === 'expiry');

  const TriggerRow = ({ t }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight:'500' }}>{t.product_name || 'All products'}</div>
        <div style={{ fontSize:'11px', color:'var(--muted)' }}>
          {t.trigger_type === 'quantity' ? `Alert when qty < ${t.threshold}` : `Alert ${t.threshold} days before expiry`}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <label className="toggle">
          <input type="checkbox" checked={!!t.enabled} onChange={() => toggleTrigger(t)} />
          <span className="toggle-slider" />
        </label>
        <button className="btn btn-ghost" style={{ padding:'3px 8px', fontSize:'10px' }}
          onClick={() => deleteTrigger(t.id)}>✕</button>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px', marginBottom:'18px' }}>

          {/* Qty Triggers */}
          <div className="card">
            <div className="section-title">Quantity triggers</div>
            {loading ? <div className="spinner" /> :
              qtyTriggers.length ? qtyTriggers.map(t => <TriggerRow key={t.id} t={t} />) :
              <div style={{ color:'var(--muted)', fontSize:'12px' }}>No quantity triggers</div>}
          </div>

          {/* Expiry Triggers */}
          <div className="card">
            <div className="section-title">Expiry triggers</div>
            {loading ? <div className="spinner" /> :
              expTriggers.length ? expTriggers.map(t => <TriggerRow key={t.id} t={t} />) :
              <div style={{ color:'var(--muted)', fontSize:'12px' }}>No expiry triggers</div>}
          </div>
        </div>

        {/* Add trigger */}
        <div className="card" style={{ marginBottom:'18px' }}>
          <div className="section-title">Add new trigger</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px 100px', gap:'10px', alignItems:'flex-end' }}>
            <div>
              <label>Product name</label>
              <input placeholder="e.g. Milk 1L" value={form.product_name}
                onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div>
              <label>Trigger type</label>
              <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                <option value="quantity">Quantity</option>
                <option value="expiry">Expiry</option>
              </select>
            </div>
            <div>
              <label>{form.trigger_type === 'quantity' ? 'Min qty' : 'Days before'}</label>
              <input type="number" placeholder={form.trigger_type==='quantity'?'10':'7'} value={form.threshold}
                onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={addTrigger}>Add</button>
          </div>
        </div>

        {/* Check & Email Log */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <div className="section-title" style={{ marginBottom:0 }}>Email alert log</div>
            <button className="btn btn-primary" style={{ fontSize:'11px', padding:'6px 14px' }}
              onClick={checkNow} disabled={checking}>
              {checking ? <><span className="spinner" /> Checking...</> : '⚡ Check & Send Emails Now'}
            </button>
          </div>

          {emails.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:'12px' }}>No emails sent yet. Click "Check & Send Emails Now" to fire all active triggers.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'300px', overflowY:'auto' }}>
              {emails.map(e => (
                <div key={e.id} style={{ padding:'10px 12px', background:'var(--bg)',
                  border:'1px solid var(--border)', borderRadius:'8px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span className={`badge ${e.status==='sent'?'badge-ok':e.status==='failed'?'badge-danger':'badge-warn'}`}>
                      {e.status}
                    </span>
                    <span style={{ fontSize:'10px', color:'var(--muted)' }}>{new Date(e.sent_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontWeight:'500', fontSize:'12px' }}>{e.subject}</div>
                  <div style={{ fontSize:'11px', color:'var(--muted)' }}>To: {e.to_email}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ChatBot products={[]} />
    </div>
  );
}
