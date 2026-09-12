import React, { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/Toast';
import ChatBot from '../components/ChatBot';

export default function InventoryPage() {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('');
  const [importing, setImporting] = useState(false);
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [groupBy, setGroupBy]     = useState('none'); // none | shelf | category
  const fileRef = React.useRef(null);
  const toast = useToast();

  useEffect(() => { load(); }, [search, filter]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filter) params.status = filter;
      const r = await productsAPI.list(params);
      setProducts(r.data);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await productsAPI.delete(p.id);
      toast.success(`${p.name} deleted`);
      load();
    } catch { toast.error('Delete failed'); }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditForm({
      name: p.name, category: p.category,
      quantity: p.quantity, expiry_date: p.expiry_date?.slice(0, 10) || '',
      price: p.price, supplier: p.supplier || '', shelf: p.shelf || '',
    });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await productsAPI.update(editId, {
        ...editForm,
        quantity: parseInt(editForm.quantity) || 0,
        price: parseFloat(editForm.price) || 0,
      });
      toast.success('Updated!');
      setEditId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const importCSV = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true);
    try {
      const r = await productsAPI.importCSV(file);
      toast.success(`Imported: ${r.data.inserted} added, ${r.data.updated} updated`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally { setImporting(false); e.target.value = ''; }
  };

  const daysLeft = d => Math.ceil((new Date(d) - new Date()) / 86400000);

  const getStatus = p => {
    const d = daysLeft(p.expiry_date);
    if (d <= 0)          return { label: 'Expired',   cls: 'badge-danger' };
    if (d <= 5)          return { label: `${d}d left`, cls: 'badge-danger' };
    if (d <= 14)         return { label: `${d}d left`, cls: 'badge-warn' };
    if (p.quantity <= 5) return { label: 'Low Stock',  cls: 'badge-warn' };
    return { label: 'OK', cls: 'badge-ok' };
  };

  // Group products by shelf or category
  const grouped = () => {
    if (groupBy === 'none') return { 'All Products': products };
    const key = groupBy === 'shelf' ? 'shelf' : 'category';
    const g = {};
    products.forEach(p => {
      const k = p[key] || (groupBy === 'shelf' ? 'No Shelf' : 'Uncategorized');
      if (!g[k]) g[k] = [];
      g[k].push(p);
    });
    return Object.fromEntries(Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])));
  };

  const CATEGORIES = ['Beverages','Dairy','Bakery','Snacks','Frozen','Produce','Medicines','Personal Care','Household','Other'];
  const ef = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }));

  const inputStyle = { padding: '3px 6px', fontSize: '11px', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--text)', fontFamily: 'var(--font)', width: '100%' };

  const renderRow = (p) => {
    const s = getStatus(p);
    const d = daysLeft(p.expiry_date);
    const barColor = d <= 0 ? 'var(--danger)' : d <= 7 ? 'var(--danger)' : d <= 30 ? 'var(--warn)' : 'var(--success)';
    const barW = Math.max(0, Math.min(100, d / 180 * 100));
    const isEditing = editId === p.id;

    return (
      <tr key={p.id} style={{ background: isEditing ? 'rgba(79,142,247,.04)' : '' }}>
        <td>
          {isEditing
            ? <input value={editForm.name} onChange={ef('name')} style={inputStyle} />
            : <><strong style={{ fontWeight: '500' }}>{p.name}</strong>
                {p.supplier && <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{p.supplier}</div>}
              </>
          }
        </td>
        <td><code style={{ fontFamily: 'var(--mono)', fontSize: '10px', background: 'var(--bg)', padding: '2px 5px', borderRadius: '4px' }}>{p.qr_code}</code></td>
        <td>
          {isEditing
            ? <select value={editForm.category} onChange={ef('category')} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            : <span className="badge badge-info">{p.category}</span>
          }
        </td>
        <td style={{ fontWeight: '500', color: p.quantity <= 5 ? 'var(--danger)' : p.quantity <= 10 ? 'var(--warn)' : '' }}>
          {isEditing
            ? <input type="number" value={editForm.quantity} onChange={ef('quantity')} style={{ ...inputStyle, width: '60px' }} min="0" />
            : p.quantity
          }
        </td>
        <td>
          {isEditing
            ? <input type="date" value={editForm.expiry_date} onChange={ef('expiry_date')} style={inputStyle} />
            : <><div style={{ fontSize: '11px' }}>{p.expiry_date?.slice(0, 10)}</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${barW}%`, background: barColor }} /></div>
              </>
          }
        </td>
        <td>
          {isEditing
            ? <input type="number" value={editForm.price} onChange={ef('price')} style={{ ...inputStyle, width: '70px' }} step="0.01" />
            : `₹${p.price}`
          }
        </td>
        {/* ── Shelf column ── */}
        <td>
          {isEditing
            ? <input value={editForm.shelf} onChange={ef('shelf')} style={inputStyle} placeholder="e.g. A-3" />
            : p.shelf
              ? <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', background: 'rgba(79,142,247,.12)', color: 'var(--accent)', padding: '2px 7px', borderRadius: '5px', fontWeight: '600' }}>{p.shelf}</span>
              : <span style={{ fontSize: '10px', color: 'var(--muted)' }}>—</span>
          }
        </td>
        <td>{isEditing ? null : <span className={`badge ${s.cls}`}>{s.label}</span>}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-primary" style={{ padding: '3px 9px', fontSize: '10px' }} onClick={saveEdit} disabled={saving}>
                {saving ? '...' : '✓ Save'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: '10px' }} onClick={() => setEditId(null)}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: '10px' }} onClick={() => startEdit(p)}>Edit</button>
              <button className="btn btn-danger" style={{ padding: '4px 9px', fontSize: '10px' }} onClick={() => deleteProduct(p)}>Del</button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const groups = grouped();

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '500' }}>Inventory <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '400' }}>({products.length} products)</span></h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ width: '130px', padding: '7px 10px', fontSize: '12px' }}>
              <option value="none">No grouping</option>
              <option value="shelf">Group by shelf</option>
              <option value="category">Group by category</option>
            </select>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: '140px', padding: '7px 10px', fontSize: '12px' }}>
              <option value="">All products</option>
              <option value="low">Low stock</option>
              <option value="expiring">Expiring soon</option>
              <option value="expired">Expired</option>
            </select>
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '200px', padding: '7px 12px', fontSize: '12px' }} />
            <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '7px 12px' }}
              onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <><span className="spinner" /> Importing...</> : '↑ Import CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Shelf summary strip */}
        {products.some(p => p.shelf) && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {Object.entries(products.reduce((acc, p) => { if (p.shelf) { acc[p.shelf] = (acc[p.shelf] || 0) + 1; } return acc; }, {}))
              .sort((a, b) => a[0].localeCompare(b[0])).map(([shelf, count]) => (
                <div key={shelf} style={{ padding: '4px 10px', background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.2)', borderRadius: '20px', fontSize: '11px', cursor: 'pointer' }}
                  onClick={() => setSearch(shelf)}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: '600', color: 'var(--accent)' }}>{shelf}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: '5px' }}>{count} items</span>
                </div>
              ))}
            {search && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setSearch('')}>✕ Clear</button>}
          </div>
        )}

        {/* Table(s) */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Scan a barcode to add your first product</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupName, groupProducts]) => (
            <div key={groupName} className="card" style={{ overflow: 'auto', marginBottom: '16px' }}>
              {groupBy !== 'none' && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>
                    {groupBy === 'shelf' ? '🗄️' : '📦'} {groupName}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{groupProducts.length} items</span>
                </div>
              )}
              <table>
                <thead><tr>
                  <th>Product</th><th>QR Code</th><th>Category</th>
                  <th>Qty</th><th>Expiry</th><th>Price</th>
                  <th>Shelf</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>{groupProducts.map(renderRow)}</tbody>
              </table>
            </div>
          ))
        )}

        {/* CSV hint */}
        <div style={{ marginTop: '4px', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>CSV Import Format:</strong> qr_code, name, category, quantity, expiry_date (YYYY-MM-DD), price, supplier, shelf
        </div>
      </div>

      <ChatBot products={products} />
    </div>
  );
}