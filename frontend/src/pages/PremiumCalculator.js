import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { stores as storesApi } from '../api';

// Fallback stores matching real DB ids
const DEMO_STORES = [
  { id:'DS001', name:'Koramangala Dark Store', city:'Bengaluru', risk_score:1.70, risk_label:'HIGH', zone_description:'Flood-prone low-lying area', historical_flood_count:8 },
  { id:'DS002', name:'Andheri West Store', city:'Mumbai', risk_score:1.20, risk_label:'MEDIUM', zone_description:'Coastal humidity zone', historical_flood_count:3 },
  { id:'DS003', name:'Banjara Hills Store', city:'Hyderabad', risk_score:0.90, risk_label:'LOW', zone_description:'Elevated safe zone', historical_flood_count:0 },
  { id:'DS004', name:'Connaught Place Store', city:'Delhi', risk_score:1.40, risk_label:'HIGH', zone_description:'Heat-vulnerable central zone', historical_flood_count:1 },
  { id:'DS005', name:'Kothrud Store', city:'Pune', risk_score:0.75, risk_label:'LOW', zone_description:'Historically safe residential', historical_flood_count:0 },
];

function calcLocal(store, shift, tenure) {
  const base = ['Bengaluru','Mumbai'].includes(store.city) ? 28 : store.city === 'Delhi' ? 30 : 22;
  const sm = shift === 'evening' ? 1.35 : shift === 'both' ? 1.40 : 1.00;
  const td = tenure >= 6 ? 0.80 : tenure >= 3 ? 0.90 : 1.00;
  return { premium: Math.round(base * store.risk_score * sm * td), base, sm, td };
}

export default function PremiumCalculator({ rider }) {
  const [storeList, setStoreList] = useState(DEMO_STORES);
  const [selectedStore, setSelectedStore] = useState(DEMO_STORES[0]);
  const [shift, setShift] = useState('morning');
  const [tenure, setTenure] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load real stores from backend
  useEffect(() => {
    storesApi.list()
      .then(r => {
        if (r.data && r.data.length > 0) {
          setStoreList(r.data);
          setSelectedStore(r.data[0]); // ← Critical fix: update selectedStore too
        }
      })
      .catch(() => {
        // Keep demo stores as fallback
        console.log('Using demo stores');
      });
  }, []);

  // Recalculate when inputs change
  useEffect(() => {
    if (selectedStore) calculate();
  }, [selectedStore, shift, tenure]);

  async function calculate() {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await storesApi.calcPremium({
        store_id: selectedStore.id,
        shift_pattern: shift,
        tenure_months: tenure,
      });
      setResult(res.data);
    } catch (e) {
      // Fallback to local calculation
      const { premium, base, sm, td } = calcLocal(selectedStore, shift, tenure);
      setResult({
        premium,
        max_coverage: 4250,
        breakdown: {
          city_base: base,
          store_risk: selectedStore.risk_score,
          risk_label: selectedStore.risk_label,
          shift_multiplier: sm,
          tenure_discount: td,
          formula: `₹${base} × ${selectedStore.risk_score} × ${sm} × ${td} = ₹${premium}`,
        },
      });
    }
    setLoading(false);
  }

  const comparisonData = storeList.map(s => ({
    name: s.name.split(' ')[0],
    premium: calcLocal(s, shift, tenure).premium,
    risk: s.risk_label,
  }));

  const RISK_COLOR = { HIGH: '#ff4759', MEDIUM: '#f0c040', LOW: '#23d18b' };

  const profiles = [
    { label: 'Safe zone, morning, 1yr', store: storeList.find(s => s.risk_label === 'LOW') || storeList[4] || storeList[0], shift: 'morning', tenure: 12 },
    { label: 'Medium risk, evening, new', store: storeList.find(s => s.risk_label === 'MEDIUM') || storeList[1], shift: 'evening', tenure: 1 },
    { label: 'High risk, evening, new', store: storeList.find(s => s.risk_label === 'HIGH') || storeList[0], shift: 'evening', tenure: 1 },
    { label: 'High risk, both shifts, 2yr', store: storeList.find(s => s.risk_label === 'HIGH') || storeList[0], shift: 'both', tenure: 24 },
  ];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          AI Premium Engine
        </h2>
        <p style={{ fontSize: 12, color: 'var(--muted2)' }}>
          Weighted Feature Scoring · ML-ready architecture · Hyper-local dark store risk
        </p>
      </div>

      <div className="two-col" style={{ gap: 18, marginBottom: 20 }}>
        {/* Input panel */}
        <div className="card">
          <div className="card-hd"><span className="card-title">◆ Input Parameters</span></div>
          <div className="card-bd">
            <div className="form-group">
              <label className="form-label">Dark Store</label>
              <select className="form-select" value={selectedStore?.id}
                onChange={e => {
                  const s = storeList.find(s => s.id === e.target.value);
                  if (s) setSelectedStore(s);
                }}>
                {storeList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {selectedStore && (
              <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--muted2)' }}>
                📍 {selectedStore.zone_description || selectedStore.city}
                <span className="badge" style={{
                  marginLeft: 8,
                  background: (RISK_COLOR[selectedStore.risk_label] || '#888') + '22',
                  color: RISK_COLOR[selectedStore.risk_label] || '#888',
                  border: `1px solid ${(RISK_COLOR[selectedStore.risk_label] || '#888')}44`,
                  fontSize: 9,
                }}>
                  {selectedStore.risk_label} RISK · {selectedStore.risk_score}x
                </span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Shift Pattern</label>
              <select className="form-select" value={shift} onChange={e => setShift(e.target.value)}>
                <option value="morning">Morning 8AM–1PM · ×1.00</option>
                <option value="evening">Evening 5PM–10PM · ×1.35</option>
                <option value="both">Both Shifts · ×1.40</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Tenure: <strong style={{ color: 'var(--text)' }}>{tenure} month{tenure > 1 ? 's' : ''}</strong>
                {tenure >= 6 && <span style={{ color: 'var(--green)', fontSize: 11 }}> — {tenure >= 6 ? '20%' : '10%'} loyalty discount</span>}
              </label>
              <input type="range" min={1} max={24} value={tenure}
                onChange={e => setTenure(+e.target.value)}
                style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                <span>1 month</span><span>24 months</span>
              </div>
            </div>
          </div>
        </div>

        {/* Output panel */}
        <div className="card">
          <div className="card-hd">
            <span className="card-title">🤖 Model Output</span>
            <span className="badge b-c" style={{ fontSize: 9 }}>LIVE CALC</span>
          </div>
          <div className="card-bd">
            {/* Formula display */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.8 }}>
              <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{'// Weighted Feature Scoring Engine'}</div>
              <div><span style={{ color: 'var(--cyan)' }}>city_base</span> <span style={{ color: 'var(--muted2)' }}>=</span> <span style={{ color: 'var(--yellow)' }}>{result?.breakdown?.city_base}</span></div>
              <div><span style={{ color: 'var(--cyan)' }}>store_risk</span> <span style={{ color: 'var(--muted2)' }}>=</span> <span style={{ color: RISK_COLOR[result?.breakdown?.risk_label] || 'var(--text)' }}>{result?.breakdown?.store_risk}</span></div>
              <div><span style={{ color: 'var(--cyan)' }}>shift_mult</span> <span style={{ color: 'var(--muted2)' }}>=</span> <span style={{ color: 'var(--yellow)' }}>{result?.breakdown?.shift_multiplier}</span></div>
              <div><span style={{ color: 'var(--cyan)' }}>tenure_disc</span> <span style={{ color: 'var(--muted2)' }}>=</span> <span style={{ color: 'var(--green)' }}>{result?.breakdown?.tenure_discount}</span></div>
              <div style={{ marginTop: 6, color: 'var(--muted2)' }}>premium = city_base × store_risk × shift_mult × tenure_disc</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { k: 'Risk Level', v: result?.breakdown?.risk_label || '—', c: RISK_COLOR[result?.breakdown?.risk_label] },
                { k: 'Shift Exposure', v: shift === 'evening' ? 'High' : shift === 'both' ? 'Max' : 'Normal', c: 'var(--yellow)' },
                { k: 'Loyalty Discount', v: tenure >= 6 ? '20% off' : tenure >= 3 ? '10% off' : 'None', c: 'var(--green)' },
                { k: 'Model Confidence', v: result?.model?.confidence_score ? `${result.model.confidence_score}%` : '—', c: 'var(--cyan)' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px', fontSize: 11 }}>
                  <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{item.k}</div>
                  <div style={{ color: item.c || 'var(--text)', fontWeight: 700 }}>{item.v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--orange-dim)', border: '1px solid rgba(255,109,46,0.25)', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Your Weekly Premium</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 44, fontWeight: 900, color: 'var(--orange)', lineHeight: 1 }}>
                {loading ? '...' : `₹${result?.premium || 0}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 6 }}>
                Max coverage: ₹{(result?.max_coverage || 4250).toLocaleString()} · Auto-renews Monday
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart comparison */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-hd">
          <span className="card-title">Premium Comparison — All Stores ({shift} shift, {tenure}mo tenure)</span>
        </div>
        <div className="card-bd">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={comparisonData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#6a8aaa', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6a8aaa', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #243347', borderRadius: 8, fontSize: 12 }}
                formatter={v => [`₹${v}`, 'Premium']} />
              <Bar dataKey="premium" radius={[4, 4, 0, 0]}>
                {comparisonData.map((d, i) => (
                  <Cell key={i} fill={RISK_COLOR[d.risk] || 'var(--cyan)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sample profiles table */}
      <div className="card">
        <div className="card-hd"><span className="card-title">Sample Rider Profiles</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Profile</th><th>Store</th><th>Risk</th><th>Shift</th><th>Tenure</th><th>Weekly Premium</th></tr>
            </thead>
            <tbody>
              {profiles.filter(p => p.store).map((p, i) => {
                const r = calcLocal(p.store, p.shift, p.tenure);
                return (
                  <tr key={i}>
                    <td>{p.label}</td>
                    <td style={{ color: 'var(--muted2)' }}>{p.store.name.split(' ')[0]}</td>
                    <td>
                      <span className="badge" style={{
                        background: (RISK_COLOR[p.store.risk_label] || '#888') + '22',
                        color: RISK_COLOR[p.store.risk_label] || '#888',
                        border: `1px solid ${(RISK_COLOR[p.store.risk_label] || '#888')}44`,
                        fontSize: 9,
                      }}>
                        {p.store.risk_label}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--muted2)' }}>{p.shift}</td>
                    <td style={{ color: 'var(--muted2)' }}>{p.tenure}mo</td>
                    <td style={{ fontWeight: 700, color: 'var(--orange)', fontFamily: 'var(--font-head)', fontSize: 15 }}>
                      ₹{r.premium}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
