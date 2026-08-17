import { useState } from 'react';
import { policy as policyApi } from '../api';

function GSSRing({ score }) {
  const r = 38, cx = 46, cy = 46, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#23d18b' : score >= 40 ? '#f0c040' : '#ff4759';
  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1c2a3a" strokeWidth="7" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 46 46)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="15" fontWeight="bold" fontFamily="Syne,sans-serif">{score}</text>
    </svg>
  );
}

export default function PolicyPage({ rider, activePolicy, showToast, onPolicyUpdate, loadRiderData }) {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  async function togglePause() {
    setLoading(true);
    try {
      const res = await policyApi.togglePause();
      showToast(res.data.status === 'paused' ? '⏸ Policy paused for this week' : '▶ Policy resumed', 'info');
      await loadRiderData();
    } catch(e) { showToast('Failed', 'error'); }
    setLoading(false);
  }

  async function cancelPolicy() {
    if (!window.confirm('Cancel your DarkShield policy? You will lose coverage immediately.')) return;
    setLoading(true);
    try {
      await policyApi.cancel();
      onPolicyUpdate(null);
      showToast('Policy cancelled', 'info');
    } catch(e) { showToast('Failed', 'error'); }
    setLoading(false);
  }

  if (!rider) return (
    <div style={{textAlign:'center',padding:'60px 20px',color:'var(--muted2)'}}>
      <div style={{fontSize:40,marginBottom:16}}>◈</div>
      <p style={{fontSize:14}}>Please register to view your policy.</p>
    </div>
  );

  if (!activePolicy) return (
    <div style={{textAlign:'center',padding:'60px 20px',color:'var(--muted2)'}}>
      <div style={{fontSize:40,marginBottom:16}}>◈</div>
      <p style={{fontSize:14,marginBottom:16}}>No active policy found.</p>
      <p style={{fontSize:12}}>Go to Register to activate your coverage.</p>
    </div>
  );

  const isActive = activePolicy.status === 'active';
  const isPaused = activePolicy.status === 'paused';

  return (
    <div className="fade-up" style={{maxWidth:600}}>

      {/* Status card */}
      <div className="card" style={{marginBottom:16,borderColor:isActive?'rgba(35,209,139,0.3)':isPaused?'rgba(240,192,64,0.3)':'var(--border)'}}>
        <div className="card-bd">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Policy Status</div>
              <div style={{fontFamily:'var(--font-head)',fontSize:22,fontWeight:800,color:isActive?'var(--green)':isPaused?'var(--yellow)':'var(--red)'}}>
                {isActive ? '✅ Active & Protected' : isPaused ? '⏸ Paused' : '❌ Cancelled'}
              </div>
              <div style={{fontSize:12,color:'var(--muted2)',marginTop:4}}>
                DarkShield Income Protection · Weekly · {activePolicy.store_name}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <GSSRing score={rider.gss_score || 85} />
              <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1}}>Stranding Score</div>
            </div>
          </div>

          <div style={{display:'flex',gap:8}}>
            <button className={`btn ${isPaused?'btn-green':'btn-ghost'} btn-sm`} onClick={togglePause} disabled={loading}>
              {loading ? '...' : isPaused ? '▶ Resume Coverage' : '⏸ Pause This Week'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={cancelPolicy} disabled={loading}>
              Cancel Policy
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview','triggers','exclusions'].map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[
            {label:'Weekly Premium', val:`₹${activePolicy.weekly_premium}`, color:'var(--orange)'},
            {label:'Max Payout', val:`₹${parseFloat(activePolicy.max_coverage).toLocaleString()}`, color:'var(--green)'},
            {label:'Store', val:activePolicy.store_name?.split(' ')[0], color:'var(--cyan)'},
            {label:'Store Risk', val:activePolicy.risk_label, color:activePolicy.risk_label==='HIGH'?'var(--red)':activePolicy.risk_label==='LOW'?'var(--green)':'var(--yellow)'},
            {label:'Shift', val:rider.shift_pattern, color:'var(--text)'},
            {label:'Next Renewal', val:activePolicy.next_renewal||'Monday', color:'var(--muted2)'},
          ].map((s,i) => (
            <div key={i} style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:700,color:s.color,fontFamily:'var(--font-head)',textTransform:'capitalize'}}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'triggers' && (
        <div>
          {[
            {icon:'🌊',name:'Flash Flood / Heavy Rain',src:'IMD + OpenWeather',threshold:'>40mm/90min',payout:'50–100%',color:'#3b82f6'},
            {icon:'🔥',name:'Extreme Heat Advisory',src:'IMD Heat + Platform API',threshold:'Temp >45°C',payout:'75%',color:'#ef4444'},
            {icon:'🚧',name:'Zone Curfew / Strike',src:'News API + Google Traffic',threshold:'Access blocked >60min',payout:'60–100%',color:'#f59e0b'},
            {icon:'😷',name:'Severe Air Pollution',src:'CPCB AQI API',threshold:'AQI >400 for 2hrs',payout:'50%',color:'#8b5cf6'},
            {icon:'🏪',name:'Dark Store Forced Closure',src:'Platform Operations API',threshold:'Platform shuts store',payout:'100%',color:'#10b981'},
          ].map((t,i) => (
            <div key={i} className="card" style={{marginBottom:10,borderLeft:`3px solid ${t.color}`}}>
              <div className="card-bd" style={{padding:'14px 16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div style={{fontSize:15,fontWeight:700}}>{t.icon} {t.name}</div>
                  <span className="badge b-g" style={{fontSize:10}}>Payout: {t.payout}</span>
                </div>
                <div style={{fontSize:11,color:'var(--muted2)'}}>Source: {t.src}</div>
                <div style={{fontSize:11,color:'var(--muted2)'}}>Threshold: {t.threshold}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 6px var(--green)'}} />
                  <span style={{fontSize:10,color:'var(--green)'}}>Monitoring 24/7</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'exclusions' && (
        <div className="card" style={{border:'1px solid rgba(255,71,89,0.2)'}}>
          <div className="card-hd" style={{borderColor:'rgba(255,71,89,0.15)'}}>
            <span className="card-title" style={{color:'var(--red)'}}>⚠️ What's NOT Covered</span>
          </div>
          <div className="card-bd" style={{padding:0}}>
            {['Vehicle breakdown or mechanical failure','Claims filed outside shift hours (±30 min grace)','Platform account suspension or violations','Disruptions lasting less than 30 minutes','GPS spoofing (Genuine Stranding Score <40)','Pre-existing health or accident conditions','Force majeure events exceeding 72 hours'].map((e,i,arr) => (
              <div key={i} style={{display:'flex',gap:12,padding:'12px 18px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none',fontSize:13,color:'var(--muted2)'}}>
                <span style={{color:'var(--red)',fontWeight:700}}>✕</span>{e}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
