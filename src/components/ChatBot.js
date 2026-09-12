import React, { useState, useRef, useEffect, useCallback } from 'react';

const QUICK = ['Expiring soon', 'Low stock', 'Discounts', 'Summary', 'Upload doc'];
const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 280;

export default function ChatBot({ products = [], onProductsChanged }) {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [docContent, setDocContent] = useState(null);
  const [docName, setDocName]       = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [open, setOpen]             = useState(true);
  const [width, setWidth]           = useState(DEFAULT_WIDTH);
  const [dragging, setDragging]     = useState(false);
  const dragStart                   = useRef(null);
  const widthStart                  = useRef(null);
  const endRef  = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'bot', text: `Hi! I'm **Inventra AI** (powered by Claude).\n\nTry:\n• "Show expiring products"\n• "Low stock report"\n• "Suggest discounts"\n• "Update Milk qty to 50"\n\n↔ Drag left edge to resize.` }]);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const onMouseDown = useCallback(e => {
    e.preventDefault();
    dragStart.current  = e.clientX;
    widthStart.current = width;
    setDragging(true);
  }, [width]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = e => {
      const delta = dragStart.current - e.clientX;
      const next  = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widthStart.current + delta));
      setWidth(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const daysLeft = d => Math.ceil((new Date(d) - new Date()) / 86400000);
  const addMsg   = (role, text) => setMessages(m => [...m, { role, text }]);

  const handleDoc = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setDocContent(ev.target.result);
      setDocName(file.name);
      setShowUpload(false);
      addMsg('bot', `📄 **${file.name}** uploaded! Ask me to analyze or import it.`);
    };
    reader.readAsText(file);
  };

  const callBackend = async userMsg => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not logged in — no token found');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMsg }],
        document_content: docContent,
        document_name: docName,
      }),
    });
    let data;
    try { data = await res.json(); } catch { throw new Error(`Backend returned HTTP ${res.status} (no JSON)`); }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    if (data.error) throw new Error(data.error);
    if (onProductsChanged) onProductsChanged();
    return data.reply;
  };



  const localFallback = text => {
    const lower = text.toLowerCase();
    if (lower.includes('expir')) {
      const soon = products.filter(p => { const d = daysLeft(p.expiry_date); return d > 0 && d <= 7; });
      const exp  = products.filter(p => daysLeft(p.expiry_date) <= 0);
      return `**Expiry Report:**\n${exp.length ? '🔴 Expired: ' + exp.map(p => p.name).join(', ') + '\n' : ''}${soon.length ? '🟡 Expiring ≤7d: ' + soon.map(p => `${p.name} (${daysLeft(p.expiry_date)}d)`).join(', ') : '✅ All products within range'}`;
    }
    if (lower.includes('low') || lower.includes('stock')) {
      const low = products.filter(p => p.quantity <= 10);
      return low.length ? `**Low Stock:**\n${low.map(p => `• **${p.name}**: ${p.quantity} units`).join('\n')}` : '✅ All products well stocked.';
    }
    if (lower.includes('discount')) {
      const items = products.map(p => {
        const d = daysLeft(p.expiry_date);
        const pct = d<=0?70:d<=3?50:d<=7?30:d<=14?15:d<=30?5:0;
        return pct ? `• **${p.name}**: ${pct}% off (${d<=0?'expired':`${d}d left`})` : null;
      }).filter(Boolean);
      return items.length ? `**Discount Recommendations:**\n${items.join('\n')}` : '✅ No urgent discounts needed.';
    }
    if (lower.includes('summary') || lower.includes('total')) {
      return `**Inventory Summary:**\n• Total products: **${products.length}**\n• Total units: **${products.reduce((a,p)=>a+p.quantity,0)}**\n• Low stock (≤10): **${products.filter(p=>p.quantity<=10).length}**\n• Expiring ≤7d: **${products.filter(p=>{const d=daysLeft(p.expiry_date);return d>0&&d<=7;}).length}**\n• Expired: **${products.filter(p=>daysLeft(p.expiry_date)<=0).length}**`;
    }
    return null;
  };

  const send = async msg => {
    const text = msg || input.trim();
    if (!text) return;
    setInput('');
    addMsg('user', text);
    setLoading(true);

    try {
      let reply = null;

      // 1. Try backend (Anthropic Claude)
      try {
        reply = await callBackend(text);
        console.log('[ChatBot] Backend response received');
      } catch (backendErr) {
        console.warn('[ChatBot] Backend failed:', backendErr.message);
        reply = localFallback(text) || `❌ **AI error:** ${backendErr.message}`;
      }

      addMsg('bot', reply);
    } finally {
      setLoading(false);
    }
  };

  const renderText = t => t
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  if (!open) return (
    <div onClick={() => setOpen(true)} style={{
      width: '36px', flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer',
    }}>
      <div style={{ writingMode: 'vertical-rl', fontSize: '10px', color: 'var(--muted)',
        letterSpacing: '1px', userSelect: 'none', transform: 'rotate(180deg)' }}>
        ▶ AI
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%',
      flexShrink: 0, width: `${width}px`, userSelect: dragging ? 'none' : 'auto' }}>

      {/* Drag handle */}
      <div onMouseDown={onMouseDown} style={{
        width: '5px', cursor: 'col-resize', flexShrink: 0,
        background: dragging ? 'var(--accent)' : 'var(--border)',
        transition: 'background .2s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'var(--border)'; }}
      />

      {/* Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1,
        background: 'var(--surface)', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '500' }}>Inventra AI</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Claude AI · drag edge to resize</div>
          </div>
          {docName && (
            <div style={{ fontSize: '9px', color: 'var(--accent)', background: 'rgba(79,142,247,.1)',
              padding: '2px 6px', borderRadius: '8px', maxWidth: '60px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
              📄 {docName}
            </div>
          )}
          <div onClick={() => setOpen(false)}
            style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '13px',
              padding: '2px 4px', borderRadius: '4px', flexShrink: 0,
              lineHeight: 1, border: '1px solid var(--border)' }}
            title="Collapse">⇥</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px',
          display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              maxWidth: '95%', padding: '7px 10px', fontSize: '11px', lineHeight: '1.55',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--card)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'bot' ? '1px solid var(--border)' : 'none',
              borderRadius: m.role === 'user' ? '10px 3px 10px 10px' : '3px 10px 10px 10px',
            }} dangerouslySetInnerHTML={{ __html: renderText(m.text) }} />
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: '3px 10px 10px 10px', padding: '7px 10px' }}>
              <div className="dot-anim"><span /><span /><span /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick chips */}
        <div style={{ padding: '6px 10px', borderTop: '1px solid var(--border)',
          display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {QUICK.map(q => (
            <div key={q} onClick={() => q === 'Upload doc' ? setShowUpload(s => !s) : send(q)}
              style={{ padding: '3px 8px', borderRadius: '12px', background: 'var(--card)',
                border: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)',
                cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--muted)'; }}>
              {q}
            </div>
          ))}
        </div>

        {/* Document upload */}
        {showUpload && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '10px',
                textAlign: 'center', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Click to upload CSV / JSON</div>
              <input ref={fileRef} type="file" accept=".csv,.txt,.json" onChange={handleDoc} style={{ display: 'none' }} />
            </div>
            {docName && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: '6px', padding: '5px 8px', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: '6px', fontSize: '10px' }}>
                <span>📄 {docName}</span>
                <span style={{ color: 'var(--danger)', cursor: 'pointer' }}
                  onClick={() => { setDocContent(null); setDocName(null); }}>✕</span>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder='Ask anything...'
            style={{ flex: 1, padding: '6px 10px', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)',
              fontFamily: 'var(--font)', fontSize: '11px', outline: 'none',
              resize: 'none', maxHeight: '60px', lineHeight: '1.4', width: 'auto' }}
            rows={1}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{ padding: '6px 10px', background: 'var(--accent)', border: 'none',
              borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '11px',
              opacity: loading || !input.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}