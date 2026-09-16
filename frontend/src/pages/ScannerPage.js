import React, { useState, useEffect, useRef, useCallback } from 'react';
import { productsAPI } from '../services/api';
import api from '../services/api';
import { useToast } from '../components/Toast';
import ChatBot from '../components/ChatBot';

const SCAN_TIMEOUT = 80;
const EMPTY_FORM = { qr_code:'', name:'', category:'Other', quantity:'1', expiry_date:'', price:'', supplier:'', shelf:'' };

const DEMO_BARCODES = [
  { code: '3017620422003', label: 'Nutella'             },
  { code: '5449000000996', label: 'Coca-Cola'           },
  { code: '4005900061492', label: 'Nivea Cream'         },
  { code: '8901058857298', label: 'Britannia Good Day'  },
  { code: '8906072671018', label: 'Amul Butter'         },
  { code: '0012000001086', label: 'Pepsi'               },
  { code: '8901030895968', label: 'Maggi Noodles'       },
  { code: '8901719110498', label: 'Haldiram Bhujia'     },
];


// Auto-suggest expiry date based on category (typical shelf life)
function suggestExpiry(category, name) {
  const n = (name || "").toLowerCase();
  const addDays = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  if (n.match(/milk/))                    return addDays(7);
  if (n.match(/bread/))                   return addDays(5);
  if (n.match(/yogurt|curd/))             return addDays(14);
  if (n.match(/butter/))                  return addDays(90);
  if (n.match(/cheese|paneer/))           return addDays(30);
  if (n.match(/egg/))                     return addDays(21);
  if (n.match(/juice/))                   return addDays(180);
  if (n.match(/water/))                   return addDays(365);
  if (n.match(/chips|wafer/))             return addDays(180);
  if (n.match(/biscuit|cookie|cracker/))  return addDays(180);
  if (n.match(/chocolate/))               return addDays(365);
  if (n.match(/noodle|pasta|maggi/))      return addDays(365);
  if (n.match(/oil|ghee/))               return addDays(365);
  switch (category) {
    case "Dairy":         return addDays(14);
    case "Bakery":        return addDays(7);
    case "Produce":       return addDays(7);
    case "Beverages":     return addDays(180);
    case "Snacks":        return addDays(180);
    case "Frozen":        return addDays(180);
    case "Medicines":     return addDays(730);
    case "Personal Care": return addDays(1095);
    case "Household":     return addDays(1095);
    default:              return addDays(365);
  }
}
export default function ScannerPage() {
  const [stats, setStats]             = useState({});
  const [products, setProducts]       = useState([]);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [isUpdate, setIsUpdate]       = useState(false);
  const [scanLog, setScanLog]         = useState([]);
  const [activeTab, setActiveTab]     = useState('scanner');
  const [scannerMode, setScannerMode] = useState('auto');
  const [scanStatus, setScanStatus]   = useState('idle');
  const [lastScanned, setLastScanned] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [buffer, setBuffer]           = useState('');
  const [scanning, setScanning]       = useState(false);
  const [lookupMsg, setLookupMsg]     = useState('');
  const [productImage, setProductImage] = useState('');
  const [demoIndex, setDemoIndex]     = useState(0);

  const bufferRef   = useRef('');
  const lastKeyTime = useRef(0);
  const bufferTimer = useRef(null);
  const scanningRef = useRef(false);
  const inputRef    = useRef(null);
  const toast       = useToast();

  useEffect(() => { loadStats(); loadProducts(); }, []);

  useEffect(() => {
    if (scannerMode === 'manual') return;
    const handleKey = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'select') return;
      if (tag === 'input' && e.target !== inputRef.current) return;
      const now  = Date.now();
      const diff = now - lastKeyTime.current;
      lastKeyTime.current = now;
      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = ''; setBuffer('');
        clearTimeout(bufferTimer.current);
        if (code.length >= 3) processBarcode(code);
        return;
      }
      if (e.key.length === 1) {
        if (diff < SCAN_TIMEOUT || bufferRef.current.length > 0) {
          bufferRef.current += e.key;
          setBuffer(bufferRef.current);
          clearTimeout(bufferTimer.current);
          bufferTimer.current = setTimeout(() => {
            const code = bufferRef.current.trim();
            bufferRef.current = ''; setBuffer('');
            if (code.length >= 3) processBarcode(code);
          }, 250);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(bufferTimer.current); };
  }, [scannerMode]);

  const loadStats    = async () => { try { const r = await productsAPI.stats(); setStats(r.data); } catch {} };
  const loadProducts = async () => { try { const r = await productsAPI.list();  setProducts(r.data); } catch {} };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const processBarcode = useCallback(async (code) => {
    if (!code || scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setScanStatus('scanning');
    setLastScanned(code);
    setLookupMsg('Checking inventory...');
    setProductImage('');
    setActiveTab('scanner');
    const ts = new Date().toLocaleTimeString();

    try {
      // ── Step 1: check our own DB (always returns 200 now) ──────────────────
      let foundInDB = false;
      try {
        const res = await productsAPI.scanQR(code);
        if (res.data && res.data.found) {
          const p = res.data.product;
          setForm({
            qr_code:     p.qr_code,
            name:        p.name,
            category:    p.category,
            quantity:    String(p.quantity),
            expiry_date: p.expiry_date ? p.expiry_date.slice(0, 10) : '',
            price:       String(p.price),
            supplier:    p.supplier || '',
          });
          setIsUpdate(true);
          setScanStatus('found');
          setLookupMsg('✓ Found in your inventory — all fields loaded');
          setScanLog(l => [{ code, name: p.name, time: ts, status: 'found', qty: p.quantity, category: p.category }, ...l.slice(0, 29)]);
          toast.info(`Found: ${p.name}`);
          foundInDB = true;
        }
      } catch (dbErr) {
        // 404 or network error from scanQR — treat as not found, continue to barcode lookup
        console.warn('[Scanner] DB lookup error (treating as not found):', dbErr.message);
      }

      if (foundInDB) return;

      // ── Step 2: look up in global barcode DB via backend ───────────────────
      setIsUpdate(false);
      setForm({ ...EMPTY_FORM, qr_code: code });
      setScanStatus('new');
      setLookupMsg('Looking up product info...');

      try {
        const lookup = await api.get(`/barcode/${code}`);
        const info   = lookup.data;

        if (info && info.found) {
          const cat = info.category || 'Other';
          const nm  = info.name || '';
          const localExpiry = suggestExpiry(cat, nm);
          setForm({
            qr_code:     code,
            name:        nm,
            category:    cat,
            supplier:    info.supplier || '',
            price:       info.price    || '',
            quantity:    '1',
            expiry_date: localExpiry,
          });
          if (info.image) setProductImage(info.image);
          setLookupMsg(`✓ Auto-filled · predicting expiry with AI...`);
          // Ask Gemini AI for a smarter expiry prediction
          try {
            const pred = await api.get(`/barcode/${code}/predict-expiry`, { params: { name: nm, category: cat } });
            if (pred.data?.expiry_date) {
              setForm(f => ({ ...f, expiry_date: pred.data.expiry_date }));
              setLookupMsg(`✓ Auto-filled · AI expiry: ${pred.data.expiry_date} (${pred.data.reasoning || ''})`);
            }
          } catch {
            setLookupMsg(`✓ Auto-filled · expiry estimated from category`);
          }
          setScanLog(l => [{ code, name: info.name || 'New product', time: ts, status: 'new' }, ...l.slice(0, 29)]);
          toast.info(`Auto-filled: ${info.name}`);
        } else {
          setForm(f => ({ ...f, expiry_date: f.expiry_date || suggestExpiry('Other', '') }));
          setLookupMsg('Not in database — fill manually · expiry pre-filled');
          setScanLog(l => [{ code, name: 'Unknown', time: ts, status: 'new' }, ...l.slice(0, 29)]);
          toast.info('New barcode — fill in details');
        }
      } catch (lookupErr) {
        console.error('[Scanner] Barcode lookup error:', lookupErr.message);
        setLookupMsg(`Lookup error: ${lookupErr.response?.data?.error || lookupErr.message}`);
        setScanLog(l => [{ code, name: 'Lookup failed', time: ts, status: 'new' }, ...l.slice(0, 29)]);
        toast.info('Fill in product details manually');
      }

    } catch (err) {
      setScanStatus('error');
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      setLookupMsg(`Error: ${msg}`);
      setScanLog(l => [{ code, name: 'Error', time: ts, status: 'error' }, ...l.slice(0, 29)]);
      toast.error(`Scan error: ${msg}`);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const code = manualInput.trim();
    if (!code) return;
    setManualInput('');
    processBarcode(code);
  };

  const simulateScan = () => {
    const demo = DEMO_BARCODES[demoIndex % DEMO_BARCODES.length];
    setDemoIndex(i => (i + 1) % DEMO_BARCODES.length);
    processBarcode(demo.code);
  };

  const saveProduct = async () => {
    if (!form.qr_code || !form.name || !form.expiry_date)
      return toast.error('Barcode, name and expiry date required');
    setSaving(true);
    try {
      if (isUpdate) {
        const existing = products.find(p => p.qr_code === form.qr_code);
        if (!existing) return toast.error('Product not found for update');
        await productsAPI.update(existing.id, { ...form, quantity: parseInt(form.quantity) || 0, price: parseFloat(form.price) || 0 });
        toast.success(`${form.name} updated!`);
      } else {
        await productsAPI.create({ ...form, quantity: parseInt(form.quantity) || 0, price: parseFloat(form.price) || 0 });
        toast.success(`${form.name} added!`);
      }
      setForm(EMPTY_FORM);
      setIsUpdate(false);
      setScanStatus('idle');
      setLastScanned(''); setLookupMsg(''); setProductImage('');
      loadStats(); loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const daysLeft = d => Math.ceil((new Date(d) - new Date()) / 86400000);

  const sc = {
    idle:     { color: 'var(--muted)',   text: 'Ready — scan a barcode or click Simulate',  bg: 'var(--bg)' },
    scanning: { color: 'var(--accent)',  text: 'Processing...',                              bg: 'rgba(79,142,247,.08)' },
    found:    { color: 'var(--success)', text: 'Found in your inventory',                    bg: 'rgba(34,197,94,.08)' },
    new:      { color: 'var(--warn)',    text: 'New product — set expiry & qty',             bg: 'rgba(245,158,11,.08)' },
    error:    { color: 'var(--danger)',  text: 'Error — see message below',                  bg: 'rgba(239,68,68,.08)' },
  }[scanStatus];

  const getAnalytics = () => {
    if (!products.length) return null;
    const totalValue = products.reduce((a, p) => a + (p.quantity * p.price), 0);
    const expiredVal = products.filter(p => daysLeft(p.expiry_date) <= 0).reduce((a, p) => a + (p.quantity * p.price), 0);
    const atRiskVal  = products.filter(p => { const d = daysLeft(p.expiry_date); return d > 0 && d <= 30; }).reduce((a, p) => a + (p.quantity * p.price), 0);
    const cats = {};
    products.forEach(p => { cats[p.category] = cats[p.category] || { count: 0, value: 0 }; cats[p.category].count++; cats[p.category].value += p.quantity * p.price; });
    const avgExp = Math.round(products.filter(p => daysLeft(p.expiry_date) > 0).reduce((a, p) => a + daysLeft(p.expiry_date), 0) / (products.filter(p => daysLeft(p.expiry_date) > 0).length || 1));
    const health = Math.max(0, Math.round(100 - (products.filter(p => daysLeft(p.expiry_date) <= 0).length / products.length * 40) - (products.filter(p => p.quantity <= 5).length / products.length * 30) - (products.filter(p => { const d = daysLeft(p.expiry_date); return d > 0 && d <= 7; }).length / products.length * 30)));
    const urgent  = products.filter(p => daysLeft(p.expiry_date) <= 7).sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date));
    const savings = urgent.reduce((a, p) => { const d = daysLeft(p.expiry_date); return a + (p.price * p.quantity * (d <= 3 ? 50 : 30) / 100); }, 0);
    return { totalValue, expiredVal, atRiskVal, cats, avgExp, health, urgent, savings };
  };
  const data = getAnalytics();
  const sc2  = data ? (data.health >= 80 ? 'var(--success)' : data.health >= 50 ? 'var(--warn)' : 'var(--danger)') : 'var(--muted)';
  const tabBtn = (t, l) => (<button onClick={() => setActiveTab(t)} style={{ padding: '6px 16px', borderRadius: '7px', border: '1px solid', borderColor: activeTab === t ? 'var(--border)' : 'transparent', background: activeTab === t ? 'var(--card)' : 'transparent', color: activeTab === t ? 'var(--text)' : 'var(--muted)', fontFamily: 'var(--font)', fontSize: '12px', cursor: 'pointer' }}>{l}</button>);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Products',     value: stats.total || 0,          color: 'var(--text)' },
            { label: 'Low Stock',    value: stats.low_stock || 0,      color: 'var(--warn)' },
            { label: 'Expiring ≤7d', value: stats.expiring_soon || 0,  color: 'var(--warn)' },
            { label: 'Expired',      value: stats.expired || 0,        color: 'var(--danger)' },
            { label: 'Health',       value: data ? `${data.health}%` : '—', color: sc2 },
          ].map(s => (<div key={s.label} className="card" style={{ padding: '12px 14px' }}><div className="section-title" style={{ marginBottom: '4px' }}>{s.label}</div><div style={{ fontSize: '20px', fontWeight: '600', color: s.color }}>{s.value}</div></div>))}
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
          {tabBtn('scanner', 'Barcode Scanner')}
          {tabBtn('analytics', 'Store Analytics')}
        </div>

        {activeTab === 'scanner' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* ── Left: Scanner panel ── */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Barcode Scanner</div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[['auto', 'Auto'], ['usb', 'USB'], ['manual', 'Manual']].map(([m, l]) => (
                    <button key={m} onClick={() => setScannerMode(m)} style={{ padding: '3px 9px', borderRadius: '6px', border: '1px solid', borderColor: scannerMode === m ? 'var(--accent)' : 'var(--border)', background: scannerMode === m ? 'rgba(79,142,247,.1)' : 'transparent', color: scannerMode === m ? 'var(--accent)' : 'var(--muted)', fontFamily: 'var(--font)', fontSize: '10px', cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Status box */}
              <div style={{ padding: '14px', borderRadius: '10px', border: `2px solid ${sc.color}`, background: sc.bg, marginBottom: '12px', transition: 'all .3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: sc.color, flexShrink: 0, animation: scanStatus === 'scanning' ? 'pulse 1s infinite' : 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: sc.color }}>{sc.text}</div>
                    {lastScanned && <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: '2px' }}>Barcode: {lastScanned}</div>}
                    {lookupMsg && <div style={{ fontSize: '10px', color: lookupMsg.startsWith('✓') ? 'var(--success)' : lookupMsg.startsWith('Error') || lookupMsg.startsWith('Lookup error') ? 'var(--danger)' : 'var(--accent)', marginTop: '2px' }}>{lookupMsg}</div>}
                  </div>
                  {scanning && <div className="spinner" />}
                </div>
                {buffer && <div style={{ marginTop: '8px', padding: '6px 10px', background: 'var(--bg)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '13px', letterSpacing: '2px', color: 'var(--accent)' }}>{buffer}</div>}
              </div>

              {/* Mode hints */}
              {scannerMode === 'auto' && <div style={{ padding: '9px 12px', background: 'var(--bg)', borderRadius: '8px', fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.6' }}><strong style={{ color: 'var(--text)' }}>Auto-detect:</strong> Just scan anywhere on the page — fast scanner keystrokes are auto-detected.</div>}
              {scannerMode === 'usb'  && <div style={{ padding: '9px 12px', background: 'var(--bg)', borderRadius: '8px', fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.6' }}><strong style={{ color: 'var(--text)' }}>USB mode:</strong> Click anywhere on the page, then scan with your USB/Bluetooth barcode scanner.</div>}
              {scannerMode === 'manual' && (
                <form onSubmit={handleManualSubmit} style={{ marginBottom: '10px' }}>
                  <label>Enter barcode manually</label>
                  <div style={{ display: 'flex', gap: '7px', marginTop: '5px' }}>
                    <input value={manualInput} onChange={e => setManualInput(e.target.value)} placeholder="Type barcode number..." autoFocus style={{ fontFamily: 'var(--mono)', letterSpacing: '1px', flex: 1 }} />
                    <button type="submit" className="btn btn-primary">Lookup</button>
                  </div>
                </form>
              )}

              {/* Simulate scan button */}
              <button className="btn btn-ghost btn-full" onClick={simulateScan} disabled={scanning} style={{ marginBottom: '6px', opacity: scanning ? 0.5 : 1 }}>
                🔲 Simulate Scan → {DEMO_BARCODES[demoIndex % DEMO_BARCODES.length].label}
              </button>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginBottom: '12px' }}>
                Cycles through {DEMO_BARCODES.length} demo products · all auto-fill instantly
              </div>

              {/* Scan log */}
              <div className="section-title">Scan history ({scanLog.length})</div>
              <div style={{ maxHeight: '190px', overflowY: 'auto' }}>
                {scanLog.length === 0
                  ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No scans yet</div>
                  : scanLog.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '11px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: s.status === 'found' ? 'var(--success)' : s.status === 'new' ? 'var(--accent)' : 'var(--danger)' }} />
                      <code style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)', minWidth: '110px' }}>{s.code}</code>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      {s.qty != null && <span style={{ color: 'var(--muted)', fontSize: '10px' }}>qty:{s.qty}</span>}
                      <span style={{ color: 'var(--muted)', fontSize: '10px', flexShrink: 0 }}>{s.time}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Right: Product form ── */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>{isUpdate ? '✏️ Update Product' : '➕ New Product'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {productImage && <img src={productImage} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'contain', background: '#fff', padding: '2px' }} onError={() => setProductImage('')} />}
                  {form.qr_code && <code style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent)', background: 'rgba(79,142,247,.1)', padding: '2px 8px', borderRadius: '6px' }}>{form.qr_code}</code>}
                </div>
              </div>

              <div className="form-row">
                <div><label>Barcode *</label><input ref={inputRef} value={form.qr_code} onChange={set('qr_code')} placeholder="auto-filled on scan" style={{ fontFamily: 'var(--mono)', letterSpacing: '1px', fontSize: '12px' }} /></div>
                <div><label>Product Name *</label><input value={form.name} onChange={set('name')} placeholder="auto-filled on scan" /></div>
              </div>
              <div className="form-row">
                <div>
                  <label>Category</label>
                  <select value={form.category} onChange={set('category')}>
                    {['Beverages', 'Dairy', 'Bakery', 'Snacks', 'Frozen', 'Produce', 'Medicines', 'Personal Care', 'Household', 'Other'].map(c => (<option key={c}>{c}</option>))}
                  </select>
                </div>
                <div><label>Quantity</label><input type="number" value={form.quantity} onChange={set('quantity')} placeholder="1" min="0" /></div>
              </div>
              <div className="form-row">
                <div>
                  <label>Expiry Date *</label>
                  <input type="date" value={form.expiry_date} onChange={set('expiry_date')} style={{ borderColor: !form.expiry_date && scanStatus === 'new' ? 'var(--warn)' : '' }} />
                  {!form.expiry_date && scanStatus === 'new' && <div style={{ fontSize: '10px', color: 'var(--warn)', marginTop: '2px' }}>⚠ Required — set an expiry date</div>}
                </div>
                <div><label>Price (₹)</label><input type="number" value={form.price} onChange={set('price')} placeholder="0.00" step="0.01" /></div>
              </div>
              <div className="form-row">
                <div><label>Supplier / Brand</label><input value={form.supplier} onChange={set('supplier')} placeholder="auto-filled on scan" /></div>
                <div><label>Shelf Location</label><input value={form.shelf} onChange={set('shelf')} placeholder="e.g. A-3, Row 2" /></div>
              </div>

              {/* Quick expiry buttons */}
              <div style={{ marginBottom: '12px', padding: '8px 10px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', fontWeight: '500' }}>QUICK EXPIRY</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {[['1wk', 7], ['1mo', 30], ['2mo', 60], ['3mo', 90], ['6mo', 180], ['1yr', 365], ['2yr', 730]].map(([label, days]) => (
                    <button key={label} className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: '10px' }}
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() + days); setForm(f => ({ ...f, expiry_date: d.toISOString().slice(0, 10) })); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-success btn-full" onClick={saveProduct} disabled={saving || !form.qr_code || !form.name || !form.expiry_date}>
                {saving ? <><span className="spinner" /> Saving...</> : (isUpdate ? 'Update in Database' : 'Save to Database')}
              </button>
              {(!form.name || !form.expiry_date) && form.qr_code && (
                <div style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginTop: '5px' }}>
                  {!form.name ? 'Enter product name  ·  ' : ''}{!form.expiry_date ? 'Set expiry date' : ''}
                </div>
              )}
              {isUpdate && (
                <button className="btn btn-ghost btn-full" style={{ marginTop: '8px' }}
                  onClick={() => { setForm(EMPTY_FORM); setIsUpdate(false); setScanStatus('idle'); setLastScanned(''); setLookupMsg(''); setProductImage(''); }}>
                  Clear — add new instead
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {!data ? (<div className="empty-state"><h3>No data yet</h3><p style={{ fontSize: '12px', marginTop: '4px' }}>Scan and add products to see analytics</p></div>) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
                  {[
                    { label: 'Total inventory value',       value: `₹${data.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--accent)' },
                    { label: 'Expired stock value',         value: `₹${data.expiredVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--danger)' },
                    { label: 'At-risk value (≤30d)',        value: `₹${data.atRiskVal.toLocaleString('en-IN',  { maximumFractionDigits: 0 })}`, color: 'var(--warn)' },
                    { label: 'Discount recovery potential', value: `₹${data.savings.toLocaleString('en-IN',   { maximumFractionDigits: 0 })}`, color: 'var(--success)' },
                  ].map(m => (<div key={m.label} className="card" style={{ padding: '14px 16px' }}><div className="section-title" style={{ marginBottom: '6px' }}>{m.label}</div><div style={{ fontSize: '18px', fontWeight: '600', color: m.color }}>{m.value}</div></div>))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="card">
                    <div className="section-title">Store health</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '14px' }}>
                      <div style={{ width: '74px', height: '74px', borderRadius: '50%', border: `5px solid ${sc2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '20px', fontWeight: '600', color: sc2 }}>{data.health}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: sc2 }}>{data.health >= 80 ? 'Excellent' : data.health >= 60 ? 'Good' : data.health >= 40 ? 'Fair' : 'Poor'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Avg expiry: {data.avgExp} days</div>
                      </div>
                    </div>
                    {[
                      { l: 'Expired',      v: products.filter(p => daysLeft(p.expiry_date) <= 0).length, c: 'var(--danger)' },
                      { l: 'Expiring ≤7d', v: products.filter(p => { const d = daysLeft(p.expiry_date); return d > 0 && d <= 7; }).length, c: 'var(--warn)' },
                      { l: 'Low stock ≤5', v: products.filter(p => p.quantity <= 5).length, c: 'var(--warn)' },
                      { l: 'Out of stock', v: products.filter(p => p.quantity === 0).length, c: 'var(--danger)' },
                      { l: 'Healthy',      v: products.filter(p => daysLeft(p.expiry_date) > 30 && p.quantity > 10).length, c: 'var(--success)' },
                    ].map(r => (<div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}><span style={{ color: 'var(--muted)' }}>{r.l}</span><span style={{ fontWeight: '500', color: r.c }}>{r.v}</span></div>))}
                  </div>
                  <div className="card">
                    <div className="section-title">Category breakdown</div>
                    {Object.entries(data.cats).sort((a, b) => b[1].count - a[1].count).map(([cat, info]) => {
                      const pct = Math.round(info.count / products.length * 100);
                      const exp = products.filter(p => p.category === cat && daysLeft(p.expiry_date) <= 0).length;
                      return (<div key={cat} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span style={{ fontWeight: '500' }}>{cat}</span><span style={{ color: 'var(--muted)' }}>{info.count} · ₹{info.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}{exp > 0 ? ` · ⚠${exp}` : ''}</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: exp > 0 ? 'var(--danger)' : 'var(--accent)' }} /></div></div>);
                    })}
                  </div>
                  <div className="card">
                    <div className="section-title">Urgent actions</div>
                    {data.urgent.length === 0 ? <div style={{ color: 'var(--success)', fontSize: '12px' }}>✅ No urgent actions</div> :
                      data.urgent.map(p => { const d = daysLeft(p.expiry_date); const pct = d <= 0 ? 70 : d <= 3 ? 50 : 30; return (<div key={p.id} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: '8px', marginBottom: '7px', border: `1px solid ${d <= 0 ? 'var(--danger)' : 'var(--warn)'}` }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500' }}><span>{p.name}</span><span style={{ color: d <= 0 ? 'var(--danger)' : 'var(--warn)' }}>{d <= 0 ? 'EXPIRED' : `${d}d left`}</span></div><div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{p.quantity} units · ₹{p.price} → {pct}% off → ₹{Math.round(p.price * (1 - pct / 100))}</div></div>); })}
                  </div>
                  <div className="card">
                    <div className="section-title">Key insights</div>
                    {[
                      { l: 'Total products',     v: products.length, c: 'var(--text)' },
                      { l: 'Total units',        v: products.reduce((a, p) => a + p.quantity, 0), c: 'var(--text)' },
                      { l: 'Reorder needed ≤10', v: products.filter(p => p.quantity <= 10).length, c: 'var(--warn)' },
                      { l: 'Out of stock',       v: products.filter(p => p.quantity === 0).length, c: 'var(--danger)' },
                      { l: 'Inventory loss',     v: `₹${data.expiredVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, c: 'var(--danger)' },
                      { l: 'Discount recovery',  v: `₹${data.savings.toLocaleString('en-IN',   { maximumFractionDigits: 0 })}`, c: 'var(--success)' },
                      { l: 'At-risk stock',      v: `₹${data.atRiskVal.toLocaleString('en-IN',  { maximumFractionDigits: 0 })}`, c: 'var(--warn)' },
                      { l: 'Categories',         v: Object.keys(data.cats).length, c: 'var(--accent)' },
                    ].map(r => (<div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}><span style={{ color: 'var(--muted)' }}>{r.l}</span><span style={{ fontWeight: '500', color: r.c }}>{r.v}</span></div>))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.5);opacity:.5}}`}</style>
      <ChatBot products={products} onProductsChanged={() => { loadStats(); loadProducts(); }} />
    </div>
  );
}