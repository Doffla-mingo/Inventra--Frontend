import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import ChatBot from '../components/ChatBot';

const TREND_COLOR = { rising: 'var(--success)', stable: 'var(--accent)', declining: 'var(--danger)' };
const TREND_ICON  = { rising: '↑', stable: '→', declining: '↓' };
const SEV_COLOR   = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--accent)' };
const URG_COLOR   = { immediate: 'var(--danger)', 'this week': 'var(--warn)', 'this month': 'var(--accent)' };
const CONF_COLOR  = { high: 'var(--success)', medium: 'var(--warn)', low: 'var(--muted)' };

export default function ForecastPage() {
  const [forecast, setForecast]     = useState(null);
  const [season, setSeason]         = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [fetching, setFetching]     = useState(true);
  const [products, setProducts]     = useState([]);
  const [activeTab, setActiveTab]   = useState('overview');
  const toast = useToast();

  useEffect(() => { loadLatest(); loadProducts(); }, []);

  const loadProducts = async () => {
    try { const r = await api.get('/products'); setProducts(r.data || []); } catch {}
  };

  const loadLatest = async () => {
    setFetching(true);
    try {
      const r = await api.get('/forecast/latest');
      if (r.data.forecast) {
        setForecast(r.data.forecast);
        setGeneratedAt(r.data.generated_at);
        if (r.data.season) setSeason(r.data.season);
      }
    } catch {}
    finally { setFetching(false); }
  };

  const generate = async () => {
    setLoading(true);
    toast.info('Generating AI forecast... this takes 10-20 seconds');
    try {
      const r = await api.post('/forecast/generate');
      setForecast(r.data.forecast);
      setGeneratedAt(r.data.generated_at);
      setSeason(r.data.season);
      toast.success('Forecast generated!');
      setActiveTab('overview');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Forecast failed');
    } finally { setLoading(false); }
  };

  const fmt = v => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const Badge = ({ text, color, bg }) => (
    <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
      color: color || 'var(--text)', background: bg || 'rgba(79,142,247,.1)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
      {text}
    </span>
  );

  const Tab = ({ id, label, count }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: '6px 14px', borderRadius: '7px', border: '1px solid',
      borderColor: activeTab === id ? 'var(--border)' : 'transparent',
      background: activeTab === id ? 'var(--card)' : 'transparent',
      color: activeTab === id ? 'var(--text)' : 'var(--muted)',
      fontFamily: 'var(--font)', fontSize: '12px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '5px',
    }}>
      {label}
      {count != null && <span style={{ fontSize: '10px', background: 'var(--accent)', color: '#fff',
        borderRadius: '10px', padding: '0 5px', minWidth: '16px', textAlign: 'center' }}>{count}</span>}
    </button>
  );

  const f = forecast;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '500' }}>AI Demand Forecast</h2>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
              {season && <>Season: <strong style={{ color: 'var(--text)' }}>{season.season}</strong> · Upcoming: {season.upcoming?.slice(0, 4).join(', ')}</>}
              {generatedAt && <> · Last generated: <strong style={{ color: 'var(--text)' }}>{generatedAt}</strong></>}
            </div>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading}
            style={{ fontSize: '12px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            {loading ? <><span className="spinner" /> Generating forecast...</> : '🔮 Generate AI Forecast'}
          </button>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : !f ? (
          /* Empty state */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1/-1', padding: '40px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔮</div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No forecast yet</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '480px', margin: '0 auto 20px', lineHeight: '1.7' }}>
                Click <strong>Generate AI Forecast</strong> to get demand predictions, best-seller suggestions,
                festival opportunity alerts, and restock recommendations — all powered by AI using your
                inventory data + global retail trends.
              </div>
              <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ fontSize: '13px', padding: '10px 28px' }}>
                {loading ? <><span className="spinner" /> Generating...</> : '🔮 Generate My First Forecast'}
              </button>
            </div>
            {/* What you'll get cards */}
            {[
              { icon: '📈', title: 'Demand Forecasting', desc: 'Rising/declining trends per category based on season & history' },
              { icon: '🎉', title: 'Festival Opportunities', desc: 'Which products to stock up for Diwali, Holi, Christmas etc.' },
              { icon: '🌍', title: 'Global Trends', desc: 'Health trends, FMCG shifts, sustainability impact on your store' },
              { icon: '⚠️', title: 'Risk Alerts', desc: 'Overstock, understock, expiry & seasonal risk detection' },
              { icon: '💡', title: 'Best Sellers', desc: 'AI picks top products likely to sell well this season' },
              { icon: '💰', title: 'Price Recommendations', desc: 'Dynamic pricing suggestions based on demand signals' },
            ].map(c => (
              <div key={c.title} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{c.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>{c.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>{c.desc}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <Tab id="overview"   label="Overview" />
              <Tab id="bestsellers" label="Best Sellers" count={f.best_sellers_forecast?.length} />
              <Tab id="demand"     label="Demand Forecast" count={f.demand_forecast?.length} />
              <Tab id="festivals"  label="Festivals" count={f.festival_opportunities?.length} />
              <Tab id="restock"    label="Restock Alerts" count={f.restock_alerts?.length} />
              <Tab id="risks"      label="Risks" count={f.risk_alerts?.length} />
              <Tab id="global"     label="Global Trends" count={f.global_trends?.length} />
              <Tab id="pricing"    label="Pricing" count={f.price_recommendations?.length} />
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Summary card */}
                <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '8px' }}>AI Summary</div>
                  <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text)' }}>{f.summary}</div>
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>{f.season_insight}</div>
                </div>

                {/* 30-day revenue forecast */}
                {f['30_day_value_forecast'] && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                    {[
                      { label: 'Expected Revenue (30d)', value: `₹${fmt(f['30_day_value_forecast'].expected_revenue)}`, color: 'var(--success)' },
                      { label: 'Expected Units Sold',    value: fmt(f['30_day_value_forecast'].expected_units_sold),   color: 'var(--accent)' },
                      { label: 'Forecast Confidence',    value: f['30_day_value_forecast'].confidence?.toUpperCase(), color: CONF_COLOR[f['30_day_value_forecast'].confidence] || 'var(--muted)' },
                    ].map(s => (
                      <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>{s.label}</div>
                        <div style={{ fontSize: '22px', fontWeight: '600', color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick grid: top best sellers + top risk */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="card">
                    <div className="section-title">🏆 Top Best Sellers This Season</div>
                    {f.best_sellers_forecast?.slice(0, 5).map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--accent)', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '500' }}>{p.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{p.season_relevance}</div>
                        </div>
                        <Badge text={p.expected_demand} color={p.expected_demand === 'high' ? 'var(--success)' : 'var(--accent)'} bg={p.expected_demand === 'high' ? 'rgba(34,197,94,.1)' : 'rgba(79,142,247,.1)'} />
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="section-title">🎉 Upcoming Festival Opportunities</div>
                    {f.festival_opportunities?.slice(0, 4).map((fo, i) => (
                      <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: '8px', marginBottom: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600' }}>{fo.festival}</div>
                          <Badge text={fo.expected_demand_spike} color="var(--success)" bg="rgba(34,197,94,.1)" />
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{fo.action}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Demand trend bars */}
                <div className="card">
                  <div className="section-title">📊 Category Demand Trends (Next 30 Days)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
                    {f.demand_forecast?.map((d, i) => (
                      <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: '8px', border: `1px solid ${TREND_COLOR[d.trend]}30` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600' }}>{d.category}</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: TREND_COLOR[d.trend] }}>
                            {TREND_ICON[d.trend]} {d.recommended_stock_change}
                          </div>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>{d.trend_reason}</div>
                        <div style={{ fontSize: '10px', color: TREND_COLOR[d.trend] }}>{d.seasonal_factor}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── BEST SELLERS ── */}
            {activeTab === 'bestsellers' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                {f.best_sellers_forecast?.map((p, i) => (
                  <div key={i} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${p.expected_demand === 'high' ? 'var(--success)' : 'var(--accent)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{p.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{p.category}</div>
                      </div>
                      <Badge text={p.expected_demand + ' demand'} color={p.expected_demand === 'high' ? 'var(--success)' : 'var(--accent)'} bg={p.expected_demand === 'high' ? 'rgba(34,197,94,.1)' : 'rgba(79,142,247,.1)'} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', lineHeight: '1.5' }}>{p.reason}</div>
                    <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '8px' }}>🌸 {p.season_relevance}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '11px', background: 'var(--bg)', padding: '3px 10px', borderRadius: '6px', fontWeight: '600' }}>
                        Suggested qty: <span style={{ color: 'var(--accent)' }}>{p.recommended_quantity}</span>
                      </div>
                      <Badge text={p.action} color="var(--text)" bg="var(--bg)" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── DEMAND FORECAST ── */}
            {activeTab === 'demand' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {f.demand_forecast?.map((d, i) => (
                  <div key={i} className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${TREND_COLOR[d.trend]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: TREND_COLOR[d.trend], flexShrink: 0 }}>
                        {TREND_ICON[d.trend]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>{d.category}</div>
                          <Badge text={d.trend} color={TREND_COLOR[d.trend]} bg={`${TREND_COLOR[d.trend]}15`} />
                          <Badge text={`confidence: ${d.confidence}`} color={CONF_COLOR[d.confidence]} bg={`${CONF_COLOR[d.confidence]}15`} />
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{d.trend_reason}</div>
                        <div style={{ fontSize: '11px', color: 'var(--accent)' }}>🌸 {d.seasonal_factor}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: TREND_COLOR[d.trend] }}>{d.recommended_stock_change}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>stock change</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── FESTIVALS ── */}
            {activeTab === 'festivals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {f.festival_opportunities?.map((fo, i) => (
                  <div key={i} className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>🎉 {fo.festival}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{fo.date_range}</div>
                      </div>
                      <Badge text={`${fo.expected_demand_spike} demand spike`} color="var(--success)" bg="rgba(34,197,94,.1)" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Products to stock</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {fo.products_to_stock?.map(p => <span key={p} style={{ fontSize: '10px', background: 'rgba(34,197,94,.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(34,197,94,.2)' }}>{p}</span>)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Categories to boost</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {fo.categories_to_boost?.map(c => <span key={c} style={{ fontSize: '10px', background: 'rgba(79,142,247,.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(79,142,247,.2)' }}>{c}</span>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', background: 'var(--bg)', padding: '8px 12px', borderRadius: '7px', color: 'var(--text)' }}>
                      💡 <strong>Action:</strong> {fo.action}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── RESTOCK ALERTS ── */}
            {activeTab === 'restock' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {f.restock_alerts?.map((r, i) => (
                  <div key={i} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${URG_COLOR[r.urgency] || 'var(--accent)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{r.name}</div>
                      <Badge text={r.urgency} color={URG_COLOR[r.urgency]} bg={`${URG_COLOR[r.urgency]}15`} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>{r.reason}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--danger)' }}>{r.current_qty}</div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)' }}>CURRENT</div>
                      </div>
                      <div style={{ fontSize: '18px', color: 'var(--muted)' }}>→</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success)' }}>{r.recommended_qty}</div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)' }}>RECOMMENDED</div>
                      </div>
                      <div style={{ flex: 1, height: '6px', background: 'var(--bg)', borderRadius: '3px', marginLeft: '8px' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (r.current_qty / (r.recommended_qty || 1)) * 100)}%`, background: r.current_qty < r.recommended_qty * 0.3 ? 'var(--danger)' : 'var(--warn)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── RISKS ── */}
            {activeTab === 'risks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {f.risk_alerts?.map((r, i) => (
                  <div key={i} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${SEV_COLOR[r.severity]}` }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: `${SEV_COLOR[r.severity]}15`, color: SEV_COLOR[r.severity], textTransform: 'uppercase', flexShrink: 0 }}>{r.severity}</div>
                      <div style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: 'var(--bg)', color: 'var(--muted)', textTransform: 'uppercase', flexShrink: 0 }}>{r.type}</div>
                      <div style={{ fontSize: '12px', fontWeight: '500', paddingTop: '4px' }}>{r.description}</div>
                    </div>
                    {r.affected_products?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {r.affected_products.map(p => <span key={p} style={{ fontSize: '10px', background: 'var(--bg)', padding: '2px 8px', borderRadius: '10px', color: 'var(--muted)' }}>{p}</span>)}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', background: 'var(--bg)', padding: '7px 10px', borderRadius: '6px' }}>
                      💡 {r.action}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── GLOBAL TRENDS ── */}
            {activeTab === 'global' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {f.global_trends?.map((t, i) => (
                  <div key={i} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>🌍 {t.trend}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', lineHeight: '1.5' }}>{t.impact_on_store}</div>
                    {t.products_affected?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {t.products_affected.map(p => <span key={p} style={{ fontSize: '10px', background: 'rgba(79,142,247,.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px' }}>{p}</span>)}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', background: 'var(--bg)', padding: '7px 10px', borderRadius: '6px' }}>
                      💡 {t.action}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PRICING ── */}
            {activeTab === 'pricing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {f.price_recommendations?.map((p, i) => {
                  const diff = p.recommended_price - p.current_price;
                  const pct  = p.current_price > 0 ? Math.round((diff / p.current_price) * 100) : 0;
                  return (
                    <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '3px' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.reason}</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '70px' }}>
                        <div style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>₹{p.current_price}</div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)' }}>current</div>
                      </div>
                      <div style={{ fontSize: '20px', color: 'var(--muted)' }}>→</div>
                      <div style={{ textAlign: 'center', minWidth: '70px' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: diff > 0 ? 'var(--success)' : 'var(--danger)' }}>₹{p.recommended_price}</div>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: diff > 0 ? 'var(--success)' : 'var(--danger)' }}>{diff > 0 ? '+' : ''}{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <ChatBot products={products} />
    </div>
  );
}