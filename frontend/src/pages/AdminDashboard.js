import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { admin as adminApi } from '../api';

const MOCK_STATS = {
  total_riders: 247,
  policies: [{status:'active',total:'198'},{status:'paused',total:'31'},{status:'cancelled',total:'18'}],
  claims: [{status:'approved',total:'89'},{status:'manual_review',total:'7'},{status:'rejected',total:'5'}],
  total_payout: 48620,
};
const MOCK_LOSS = [
  {name:'Koramangala',city:'Bengaluru',risk_label:'HIGH',riders:28,total_premium:2940,total_payout:3120,claim_count:12,loss_ratio_pct:106.1},
  {name:'Andheri West',city:'Mumbai',risk_label:'MEDIUM',riders:41,total_premium:5330,total_payout:4200,claim_count:8,loss_ratio_pct:78.8},
  {name:'Banjara Hills',city:'Hyderabad',risk_label:'LOW',riders:19,total_premium:1710,total_payout:820,claim_count:3,loss_ratio_pct:48.0},
  {name:'Connaught Place',city:'Delhi',risk_label:'HIGH',riders:35,total_premium:5250,total_payout:4900,claim_count:14,loss_ratio_pct:93.3},
  {name:'Kothrud',city:'Pune',risk_label:'LOW',riders:22,total_premium:1540,total_payout:420,claim_count:2,loss_ratio_pct:27.3},
];
const MOCK_FRAUD = [
  {id:'1',rider_name:'Rajesh K.',partner_id:'BLK-2918-ANH',store_name:'Andheri West',trigger_type:'flood',gss_score:52,payout_amount:340,status:'manual_review',created_at:new Date(Date.now()-3600000).toISOString()},
  {id:'2',rider_name:'Sunita M.',partner_id:'ZPT-4421-KRM',store_name:'Koramangala',trigger_type:'curfew',gss_score:38,payout_amount:510,status:'manual_review',created_at:new Date(Date.now()-7200000).toISOString()},
];
const COLORS = { HIGH:'#ff4759', MEDIUM:'#f0c040', LOW:'#23d18b' };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [lossRatios, setLossRatios] = useState([]);
  const [fraudQueue, setFraudQueue] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [s,l,f] = await Promise.allSettled([adminApi.stats(), adminApi.lossRatios(), adminApi.fraudQueue()]);
      setStats(s.status==='fulfilled' ? s.value.data : MOCK_STATS);
      setLossRatios(l.status==='fulfilled' && l.value.data.length ? l.value.data : MOCK_LOSS);
      setFraudQueue(f.status==='fulfilled' ? f.value.data : MOCK_FRAUD);
    } catch(e) {
      setStats(MOCK_STATS); setLossRatios(MOCK_LOSS); setFraudQueue(MOCK_FRAUD);
    }
    setLoading(false);
  }

  async function reviewClaim(id, action) {
    try {
      await adminApi.updateClaim(id, { status: action });
      setFraudQueue(prev => prev.filter(c => c.id !== id));
    } catch(e) {
      setFraudQueue(prev => prev.filter(c => c.id !== id));
    }
  }

  const totalActive = stats?.policies?.find(p=>p.status==='active')?.total || 0;
  const totalApproved = stats?.claims?.find(c=>c.status==='approved')?.total || 0;
  const totalReview = stats?.claims?.find(c=>c.status==='manual_review')?.total || 0;

  const pieData = [
    {name:'Active', value:+totalActive, color:'var(--green)'},
    {name:'Paused', value:+(stats?.policies?.find(p=>p.status==='paused')?.total||0), color:'var(--yellow)'},
    {name:'Cancelled', value:+(stats?.policies?.find(p=>p.status==='cancelled')?.total||0), color:'var(--red)'},
  ];

  return (
    <div className="fade-up">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontFamily:'var(--font-head)',fontSize:20,fontWeight:800,marginBottom:4}}>Admin Dashboard</h2>
          <p style={{fontSize:12,color:'var(--muted2)'}}>Insurer view · Loss ratios · Fraud queue · Platform analytics</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>{loading?'Loading...':'↻ Refresh'}</button>
      </div>

      {/* Top stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {label:'Total Riders',val:stats?.total_riders||0,color:'var(--cyan)',icon:'◎'},
          {label:'Active Policies',val:totalActive,color:'var(--green)',icon:'◈'},
          {label:'Total Paid Out',val:`₹${((stats?.total_payout||0)/1000).toFixed(1)}K`,color:'var(--orange)',icon:'◉'},
          {label:'Review Queue',val:totalReview,color:+totalReview>5?'var(--red)':'var(--yellow)',icon:'▣'},
        ].map((s,i) => (
          <div className="stat" key={i}>
            <div className="stat-bar" style={{background:s.color}}/>
            <div className="stat-label">{s.icon} {s.label}</div>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {['overview','loss-ratios','fraud-queue'].map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t==='overview'?'Overview':t==='loss-ratios'?'Loss Ratios':'Fraud Queue'}
            {t==='fraud-queue' && fraudQueue.length>0 && <span className="nav-badge nb-o" style={{marginLeft:6}}>{fraudQueue.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="two-col" style={{gap:16}}>
          <div className="card">
            <div className="card-hd"><span className="card-title">Policy Status Distribution</span></div>
            <div className="card-bd" style={{display:'flex',justifyContent:'center'}}>
              <PieChart width={240} height={180}>
                <Pie data={pieData} cx={120} cy={80} outerRadius={70} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false} style={{fontSize:10}}>
                  {pieData.map((d,i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#0d1117',border:'1px solid #243347',borderRadius:8,fontSize:11}} />
              </PieChart>
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><span className="card-title">Claims by Status</span></div>
            <div className="card-bd">
              {stats?.claims?.map((c,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,textTransform:'capitalize',color:'var(--muted2)'}}>{c.status}</span>
                  <span style={{fontFamily:'var(--font-head)',fontSize:18,fontWeight:700,color:c.status==='approved'?'var(--green)':c.status==='rejected'?'var(--red)':'var(--yellow)'}}>{c.total}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0'}}>
                <span style={{fontSize:13,color:'var(--muted2)'}}>Total Paid Out</span>
                <span style={{fontFamily:'var(--font-head)',fontSize:18,fontWeight:700,color:'var(--orange)'}}>₹{(stats?.total_payout||0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{gridColumn:'1/-1'}}>
            <div className="card-hd"><span className="card-title">Store-wise Premium Collection vs Payouts</span></div>
            <div className="card-bd">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lossRatios} margin={{top:4,right:4,left:0,bottom:0}}>
                  <XAxis dataKey="name" tick={{fill:'#6a8aaa',fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#6a8aaa',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v}`} />
                  <Tooltip contentStyle={{background:'#0d1117',border:'1px solid #243347',borderRadius:8,fontSize:12}} />
                  <Bar dataKey="total_premium" name="Premium Collected" fill="#00e5ff" radius={[3,3,0,0]} opacity={0.7} />
                  <Bar dataKey="total_payout" name="Total Payouts" fill="#ff6d2e" radius={[3,3,0,0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'loss-ratios' && (
        <div className="card">
          <div className="card-hd"><span className="card-title">Store-wise Loss Ratios</span><span className="badge b-c" style={{fontSize:9}}>Payout ÷ Premium</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Store</th><th>City</th><th>Risk</th><th>Riders</th><th>Premium</th><th>Payouts</th><th>Claims</th><th>Loss Ratio</th></tr></thead>
              <tbody>
                {lossRatios.map((r,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{r.name}</td>
                    <td style={{color:'var(--muted2)'}}>{r.city}</td>
                    <td><span className="badge" style={{background:COLORS[r.risk_label]+'22',color:COLORS[r.risk_label],border:`1px solid ${COLORS[r.risk_label]}44`,fontSize:9}}>{r.risk_label}</span></td>
                    <td style={{color:'var(--muted2)'}}>{r.riders}</td>
                    <td>₹{(+r.total_premium).toLocaleString()}</td>
                    <td style={{color:'var(--orange)'}}>₹{(+r.total_payout).toLocaleString()}</td>
                    <td style={{color:'var(--muted2)'}}>{r.claim_count}</td>
                    <td>
                      <span style={{fontWeight:700,color:r.loss_ratio_pct>100?'var(--red)':r.loss_ratio_pct>75?'var(--yellow)':'var(--green)'}}>
                        {r.loss_ratio_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:'12px 18px',fontSize:11,color:'var(--muted2)',borderTop:'1px solid var(--border)'}}>
            ⚠ Loss ratio &gt;100% = store is unprofitable at current premium. Trigger premium re-scoring.
          </div>
        </div>
      )}

      {tab === 'fraud-queue' && (
        <div>
          {fraudQueue.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'var(--green)',fontSize:13}}>
              ✓ No claims pending manual review
            </div>
          ) : (
            fraudQueue.map((c,i) => (
              <div className="card" key={c.id} style={{marginBottom:12,borderLeft:'3px solid var(--yellow)'}}>
                <div className="card-bd">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{c.rider_name} <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted2)'}}>{c.partner_id}</span></div>
                      <div style={{fontSize:12,color:'var(--muted2)'}}>{c.store_name} · {c.trigger_type} · {new Date(c.created_at).toLocaleTimeString()}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:18,fontWeight:700,color:'var(--yellow)'}}>₹{c.payout_amount}</div>
                      <div style={{fontSize:11,color:'var(--muted2)'}}>Claimed amount</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <div style={{background:'var(--s2)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                      <span style={{color:'var(--muted2)'}}>GSS Score: </span>
                      <span style={{fontWeight:700,color:c.gss_score>=70?'var(--green)':c.gss_score>=40?'var(--yellow)':'var(--red)'}}>{c.gss_score}/100</span>
                    </div>
                    <span className="badge b-y">Fast-Track Review</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-green btn-sm" onClick={() => reviewClaim(c.id, 'approved')}>✓ Approve Claim</button>
                    <button className="btn btn-danger btn-sm" onClick={() => reviewClaim(c.id, 'rejected')}>✕ Reject</button>
                    <button className="btn btn-ghost btn-sm">Request Verification</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
