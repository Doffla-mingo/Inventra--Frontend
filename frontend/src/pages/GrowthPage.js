import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import ChatBot from '../components/ChatBot';

const COLORS = ['#4f8ef7','#22c55e','#f59e0b','#ef4444','#7c5cfc','#06b6d4'];

export default function GrowthPage() {
  const [history, setHistory]   = useState([]);
  const [summary, setSummary]   = useState(null);
  const [products, setProducts] = useState([]);
  const [range, setRange]       = useState(30);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [activeChart, setActiveChart] = useState(null); // zoomed chart
  const toast = useToast();

  useEffect(() => { load(); }, [range]);

  const load = async () => {
    setLoading(true);
    try {
      const [h, s, p] = await Promise.all([
        api.get(`/growth/history?days=${range}`),
        api.get('/growth/summary').catch(() => ({ data: null })),
        api.get('/products'),
      ]);
      setHistory(h.data || []);
      setSummary(s.data);
      setProducts(p.data || []);
    } catch { toast.error('Failed to load growth data'); }
    finally { setLoading(false); }
  };

  const saveSnapshot = async () => {
    setSaving(true);
    try {
      await api.post('/growth/snapshot');
      toast.success('Snapshot saved!');
      load();
    } catch { toast.error('Snapshot failed'); }
    finally { setSaving(false); }
  };

  const pctColor = v => v > 0 ? 'var(--success)' : v < 0 ? 'var(--danger)' : 'var(--muted)';
  const pctLabel = v => v > 0 ? `▲ ${v}%` : v < 0 ? `▼ ${Math.abs(v)}%` : '—';
  const fmt = v => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // ── Interactive Line Chart ─────────────────────────────────────────────────
  const LineChart = ({ data, valueKey, color, label, prefix = '', suffix = '', zoomable = true }) => {
    const [tooltip, setTooltip] = useState(null);
    const [hoverIdx, setHoverIdx] = useState(null);
    const svgRef = useRef(null);

    if (!data || data.length < 2) return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          <div style={{ marginBottom: '6px', fontWeight: '500' }}>{label}</div>
          <div style={{ fontSize: '11px' }}>Take more snapshots to see trends</div>
        </div>
      </div>
    );

    const vals  = data.map(d => Number(d[valueKey] || 0));
    const min   = Math.min(...vals);
    const max   = Math.max(...vals);
    const rng   = max - min || 1;
    const W = 400, H = 100, PAD = 12;

    const points = vals.map((v, i) => ({
      x: PAD + (i / (vals.length - 1)) * (W - PAD * 2),
      y: PAD + (1 - (v - min) / rng) * (H - PAD * 2),
      v, d: data[i],
    }));

    const pathD = points.map((p, i) => i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`).join(' ');
    const areaD = `${pathD} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;
    const last = vals[vals.length - 1];
    const first = vals[0];
    const change = first > 0 ? Math.round((last - first) / first * 100) : 0;

    const handleMouseMove = useCallback((e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * W;
      let closest = 0, minDist = Infinity;
      points.forEach((p, i) => {
        const dist = Math.abs(p.x - mx);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setHoverIdx(closest);
      setTooltip({ idx: closest, x: points[closest].x, y: points[closest].y, v: points[closest].v, d: points[closest].d });
    }, [points]);

    return (
      <div className="card" style={{ padding: '14px 16px', cursor: zoomable ? 'pointer' : 'default', position: 'relative' }}
        onClick={() => zoomable && setActiveChart({ data, valueKey, color, label, prefix, suffix })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: '600' }}>{prefix}{fmt(last)}{suffix}</div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: pctColor(change) }}>{pctLabel(change)}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{data.length} pts</div>
            {zoomable && <div style={{ fontSize: '9px', color: 'var(--accent)', background: 'rgba(79,142,247,.1)', padding: '1px 6px', borderRadius: '8px' }}>click to zoom</div>}
          </div>
        </div>

        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => { setHoverIdx(null); setTooltip(null); }}>
          <defs>
            <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line key={t} x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
          ))}
          {/* Y axis labels */}
          {[0, 0.5, 1].map(t => {
            const val = max - t * rng;
            return <text key={t} x={PAD - 2} y={PAD + t * (H - PAD * 2) + 3} textAnchor="end"
              fontSize="7" fill="var(--muted)">{prefix}{fmt(val)}{suffix}</text>;
          })}
          <path d={areaD} fill={`url(#grad-${valueKey})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* Hover line */}
          {hoverIdx !== null && (
            <line x1={points[hoverIdx].x} x2={points[hoverIdx].x} y1={PAD} y2={H - PAD}
              stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
          )}
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === hoverIdx ? 5 : 2.5}
              fill={color} opacity={i === hoverIdx ? 1 : 0.4}
              style={{ transition: 'r 0.1s' }} />
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', top: '50px',
            left: `${Math.min(85, (tooltip.x / W) * 100)}%`,
            transform: 'translateX(-50%)',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '6px 10px', fontSize: '11px',
            boxShadow: '0 4px 12px rgba(0,0,0,.15)', pointerEvents: 'none', zIndex: 10,
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: '600', color }}>{prefix}{fmt(tooltip.v)}{suffix}</div>
            <div style={{ color: 'var(--muted)', fontSize: '10px' }}>{tooltip.d?.snapshot_date}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
          <span>{data[0]?.snapshot_date}</span>
          <span>{data[data.length - 1]?.snapshot_date}</span>
        </div>
      </div>
    );
  };

  // ── Interactive Bar Chart ──────────────────────────────────────────────────
  const BarChart = ({ data, valueKey, color, label }) => {
    const [hoverIdx, setHoverIdx] = useState(null);
    if (!data || data.length < 2) return null;
    const vals = data.map(d => Number(d[valueKey] || 0));
    const max  = Math.max(...vals, 1);
    const W = 400, H = 90;
    const bw = (W / vals.length) - 2;

    return (
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</div>
          {hoverIdx !== null && (
            <div style={{ fontSize: '11px', fontWeight: '600', color }}>
              {vals[hoverIdx]} · {data[hoverIdx]?.snapshot_date}
            </div>
          )}
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ cursor: 'crosshair' }}
          onMouseLeave={() => setHoverIdx(null)}>
          {vals.map((v, i) => {
            const x   = i * (W / vals.length) + 1;
            const h   = Math.max(2, (v / max) * (H - 14));
            const isH = i === hoverIdx;
            return (
              <g key={i} onMouseEnter={() => setHoverIdx(i)}>
                <rect x={x} y={H - h - 12} width={bw} height={h} rx="3"
                  fill={color} opacity={isH ? 1 : 0.5}
                  style={{ transition: 'opacity 0.15s' }} />
                {isH && (
                  <text x={x + bw / 2} y={H - h - 15} textAnchor="middle"
                    fontSize="9" fill={color} fontWeight="600">{v}</text>
                )}
              </g>
            );
          })}
          {/* X axis date labels for first and last */}
          <text x={0} y={H} fontSize="8" fill="var(--muted)">{data[0]?.snapshot_date}</text>
          <text x={W} y={H} fontSize="8" fill="var(--muted)" textAnchor="end">{data[data.length - 1]?.snapshot_date}</text>
        </svg>
      </div>
    );
  };

  // ── Category Donut Chart ───────────────────────────────────────────────────
  const DonutChart = ({ products }) => {
    const [hovered, setHovered] = useState(null);
    if (!products.length) return null;
    const cats = {};
    products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const total = products.length;
    const R = 60, cx = 80, cy = 75;
    let startAngle = -Math.PI / 2;
    const slices = entries.map(([cat, count], i) => {
      const angle = (count / total) * Math.PI * 2;
      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      startAngle += angle;
      const x2 = cx + R * Math.cos(startAngle);
      const y2 = cy + R * Math.sin(startAngle);
      const large = angle > Math.PI ? 1 : 0;
      return { cat, count, color: COLORS[i % COLORS.length], x1, y1, x2, y2, large, angle };
    });

    return (
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '10px' }}>Category Breakdown</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <svg width="160" height="150" style={{ flexShrink: 0 }}>
            {slices.map((s, i) => (
              <path key={i}
                d={`M${cx},${cy} L${s.x1},${s.y1} A${R},${R} 0 ${s.large},1 ${s.x2},${s.y2} Z`}
                fill={s.color}
                opacity={hovered === null || hovered === s.cat ? 1 : 0.3}
                stroke="var(--bg)" strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseEnter={() => setHovered(s.cat)}
                onMouseLeave={() => setHovered(null)}
                transform={hovered === s.cat ? `translate(${Math.cos(s.angle / 2 + (-Math.PI / 2 + slices.slice(0, i).reduce((a, x) => a + x.angle, 0))) * 4}, ${Math.sin(s.angle / 2 + (-Math.PI / 2 + slices.slice(0, i).reduce((a, x) => a + x.angle, 0))) * 4})` : ''}
              />
            ))}
            <circle cx={cx} cy={cy} r={R * 0.55} fill="var(--card)" />
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--text)">{hovered ? slices.find(s => s.cat === hovered)?.count : total}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="var(--muted)">{hovered || 'total'}</text>
          </svg>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {slices.map(s => (
              <div key={s.cat} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', opacity: hovered === null || hovered === s.cat ? 1 : 0.4, transition: 'opacity 0.2s' }}
                onMouseEnter={() => setHovered(s.cat)} onMouseLeave={() => setHovered(null)}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                <div style={{ fontSize: '11px', flex: 1 }}>{s.cat}</div>
                <div style={{ fontSize: '11px', fontWeight: '600' }}>{s.count}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', minWidth: '28px', textAlign: 'right' }}>{Math.round(s.count / total * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Zoom Modal ─────────────────────────────────────────────────────────────
  const ZoomModal = ({ chart, onClose }) => {
    if (!chart) return null;
    const { data, valueKey, color, label, prefix = '', suffix = '' } = chart;
    const [tooltip, setTooltip] = useState(null);
    const [hoverIdx, setHoverIdx] = useState(null);
    const svgRef = useRef(null);

    const vals   = data.map(d => Number(d[valueKey] || 0));
    const min    = Math.min(...vals);
    const max    = Math.max(...vals);
    const rng    = max - min || 1;
    const W = 700, H = 200, PAD = 30;

    const points = vals.map((v, i) => ({
      x: PAD + (i / (vals.length - 1)) * (W - PAD * 2),
      y: PAD + (1 - (v - min) / rng) * (H - PAD * 2),
      v, d: data[i],
    }));

    const pathD = points.map((p, i) => i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`).join(' ');
    const areaD = `${pathD} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;

    const handleMouseMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * W;
      let closest = 0, minDist = Infinity;
      points.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < minDist) { minDist = d; closest = i; } });
      setHoverIdx(closest);
      setTooltip({ idx: closest, ...points[closest] });
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', width: '780px', maxWidth: '95vw' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '600' }}>{label}</div>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px' }}>✕ Close</button>
          </div>
          <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove} onMouseLeave={() => { setHoverIdx(null); setTooltip(null); }}>
            <defs>
              <linearGradient id="grad-zoom" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <g key={t}>
                <line x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)}
                  stroke="var(--border)" strokeWidth="0.8" />
                <text x={PAD - 4} y={PAD + t * (H - PAD * 2) + 4} textAnchor="end"
                  fontSize="9" fill="var(--muted)">{prefix}{fmt(max - t * rng)}{suffix}</text>
              </g>
            ))}
            {/* X labels for every data point if small, else every nth */}
            {points.filter((_, i) => data.length <= 10 || i % Math.ceil(data.length / 10) === 0).map((p, i) => (
              <text key={i} x={p.x} y={H + 12} textAnchor="middle" fontSize="8" fill="var(--muted)">{p.d?.snapshot_date?.slice(5)}</text>
            ))}
            <path d={areaD} fill="url(#grad-zoom)" />
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
            {hoverIdx !== null && (
              <line x1={points[hoverIdx].x} x2={points[hoverIdx].x} y1={PAD} y2={H - PAD}
                stroke={color} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7" />
            )}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={i === hoverIdx ? 6 : 3}
                fill={color} opacity={i === hoverIdx ? 1 : 0.5} style={{ transition: 'r 0.1s' }} />
            ))}
          </svg>
          {tooltip && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--muted)' }}>{tooltip.d?.snapshot_date}</span>
              <span style={{ fontWeight: '600', color }}>{prefix}{fmt(tooltip.v)}{suffix}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const g = summary?.growth;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '500' }}>Store Growth Analytics</h2>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>{history.length} snapshots · hover charts for details · click to zoom</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setRange(d)} className="btn btn-ghost"
                  style={{ padding: '5px 12px', fontSize: '11px', background: range === d ? 'var(--card)' : 'transparent', color: range === d ? 'var(--text)' : 'var(--muted)', border: `1px solid ${range === d ? 'var(--border)' : 'transparent'}` }}>
                  {d}d
                </button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ fontSize: '11px', padding: '7px 16px' }} onClick={saveSnapshot} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : '📸 Save Snapshot'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : history.length < 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📸</div>
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No growth data yet</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
                Take a snapshot each day to track growth. Charts become interactive once you have 2+ snapshots.
              </div>
              <button className="btn btn-primary" onClick={saveSnapshot} disabled={saving} style={{ fontSize: '13px', padding: '10px 24px' }}>
                {saving ? <><span className="spinner" /> Saving...</> : '📸 Take First Snapshot'}
              </button>
            </div>
            {products.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                {[
                  { label: "Today's products", value: products.length, color: 'var(--accent)' },
                  { label: "Today's units", value: products.reduce((a, p) => a + p.quantity, 0), color: 'var(--text)' },
                  { label: "Today's value", value: `₹${products.reduce((a, p) => a + (p.quantity * p.price), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--success)' },
                ].map(s => (<div key={s.label} className="card" style={{ padding: '14px 16px' }}><div className="section-title" style={{ marginBottom: '6px' }}>{s.label}</div><div style={{ fontSize: '20px', fontWeight: '600', color: s.color }}>{s.value}</div></div>))}
              </div>
            )}
          </div>
        ) : (
          <>
            {g && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '18px' }}>
                {[
                  { label: 'Products (7d)',   value: g.products_vs_week,  base: summary?.latest?.total_products },
                  { label: 'Value (7d)',      value: g.value_vs_week,     base: `₹${fmt(summary?.latest?.total_value)}` },
                  { label: 'Health (7d)',     value: g.health_vs_week,    base: `${summary?.latest?.health_score}%` },
                  { label: 'Products (30d)', value: g.products_vs_month, base: summary?.latest?.total_products },
                  { label: 'Value (30d)',    value: g.value_vs_month,    base: `₹${fmt(summary?.latest?.total_value)}` },
                ].map(k => (
                  <div key={k.label} className="card" style={{ padding: '12px 14px' }}>
                    <div className="section-title" style={{ marginBottom: '4px' }}>{k.label}</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{k.base}</div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: pctColor(k.value), marginTop: '2px' }}>{pctLabel(k.value)} vs prev</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <LineChart data={history} valueKey="total_products" color="#4f8ef7" label="Total products" />
              <LineChart data={history} valueKey="total_value"    color="#22c55e" label="Inventory value" prefix="₹" />
              <LineChart data={history} valueKey="health_score"   color="#7c5cfc" label="Store health score" suffix="%" />
              <LineChart data={history} valueKey="total_units"    color="#f59e0b" label="Total units in stock" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <BarChart data={history} valueKey="expired_count"      color="#ef4444" label="Expired products per snapshot" />
              <BarChart data={history} valueKey="new_products_added" color="#4f8ef7" label="New products added per snapshot" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <DonutChart products={products} />
              <div className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '10px' }}>Value by category</div>
                {Object.entries(
                  products.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + p.quantity * p.price; return acc; }, {})
                ).sort((a, b) => b[1] - a[1]).map(([cat, val], i) => {
                  const maxVal = Math.max(...Object.values(products.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + p.quantity * p.price; return acc; }, {})));
                  return (
                    <div key={cat} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: '500' }}>{cat}</span>
                        <span style={{ color: 'var(--muted)' }}>₹{fmt(val)}</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px' }}>
                        <div style={{ height: '100%', width: `${(val / maxVal) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: '3px', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Snapshot history</div>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{history.length} snapshots</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr>
                    <th>Date</th><th>Products</th><th>Units</th><th>Value (₹)</th>
                    <th>Expired</th><th>Low Stock</th><th>Health</th><th>New Added</th>
                  </tr></thead>
                  <tbody>
                    {[...history].reverse().map((row, i) => {
                      const prev = [...history].reverse()[i + 1];
                      const vd = prev ? row.total_value - prev.total_value : 0;
                      return (
                        <tr key={row.id}>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{row.snapshot_date}</td>
                          <td style={{ fontWeight: '500' }}>{row.total_products}</td>
                          <td>{row.total_units}</td>
                          <td style={{ color: vd > 0 ? 'var(--success)' : vd < 0 ? 'var(--danger)' : 'var(--text)' }}>
                            ₹{fmt(row.total_value)}{vd !== 0 ? ` (${vd > 0 ? '+' : ''}₹${fmt(vd)})` : ''}
                          </td>
                          <td style={{ color: row.expired_count > 0 ? 'var(--danger)' : 'var(--success)' }}>{row.expired_count}</td>
                          <td style={{ color: row.low_stock_count > 3 ? 'var(--warn)' : 'var(--text)' }}>{row.low_stock_count}</td>
                          <td><span style={{ color: row.health_score >= 80 ? 'var(--success)' : row.health_score >= 60 ? 'var(--warn)' : 'var(--danger)', fontWeight: '500' }}>{row.health_score}%</span></td>
                          <td style={{ color: 'var(--accent)' }}>+{row.new_products_added || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {activeChart && <ZoomModal chart={activeChart} onClose={() => setActiveChart(null)} />}
      <ChatBot products={products} />
    </div>
  );
}