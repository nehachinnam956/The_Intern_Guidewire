import { useState, useRef, useEffect } from 'react';
import { weather as weatherApi } from '../api';

const TRIGGERS = [
  { id:'flood',  icon:'🌊', name:'Flash Flood / Heavy Rain',    desc:'Rainfall >40mm/90min at store GPS',     api:'IMD API + OpenWeatherMap', payout:'50–100%', color:'#3b82f6' },
  { id:'heat',   icon:'🔥', name:'Extreme Heat Advisory',       desc:'Temperature >45°C + platform suspends', api:'IMD Heat Alert + Platform API', payout:'75%', color:'#ef4444' },
  { id:'curfew', icon:'🚧', name:'Zone Curfew / Strike',        desc:'Road access blocked >60 minutes',       api:'News API + Google Traffic', payout:'60–100%', color:'#f59e0b' },
  { id:'aqi',    icon:'😷', name:'Severe Air Pollution',        desc:'AQI >400 sustained 2+ hours',           api:'CPCB AQI API', payout:'50%', color:'#8b5cf6' },
  { id:'closure',icon:'🏪', name:'Dark Store Forced Closure',   desc:'Platform shuts store for safety/ops',   api:'Platform Operations API', payout:'100%', color:'#10b981' },
];

const PIPELINE_STEPS = ['Detected','Validating','GSS Check','Calculating','UPI Sent'];
const EXCLUSIONS = [
  'Vehicle breakdown or mechanical failure',
  'Claims outside registered shift hours (±30 min grace)',
  'Platform account suspension or policy violations',
  'Disruptions lasting less than 30 continuous minutes',
  'GPS spoofing detected (GSS Score < 40)',
  'Pre-existing health conditions or personal accidents',
  'Force majeure events exceeding 72 hours',
];

export default function ClaimsPage({ rider, activePolicy, claimHistory, showToast, onClaimFiled }) {
  const [activeTab, setActiveTab] = useState('file');
  const [firing, setFiring] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const [payoutDone, setPayoutDone] = useState(null);
  const [liveWeather, setLiveWeather] = useState(null);
  const logRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (activePolicy?.store_id) fetchLiveWeather();
  }, [activePolicy]);

  async function fetchLiveWeather() {
    try {
      const res = await weatherApi.check(activePolicy.store_id);
      setLiveWeather(res.data);
    } catch(e) {}
  }

  async function fileClaim(trigger) {
    if (!rider || !activePolicy) return showToast('Register and activate a policy first', 'error');
    if (activePolicy.status === 'paused') return showToast('Policy is paused — resume to file claims', 'error');

    setCurrentTrigger(trigger);
    setFiring(true);
    setLogs([]);
    setPipelineStep(0);
    setPayoutDone(null);

    const token = localStorage.getItem('ds_token');

    try {
      const response = await fetch(`${API_BASE}/claims/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trigger_type: trigger.id, store_id: activePolicy.store_id, simulate: true }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.msg) {
              setLogs(prev => [...prev, data]);
              setPipelineStep(data.step || 0);
            }
            if (data.done) {
              setPayoutDone({ amount: data.payout, txId: data.tx_id, claim: data.claim });
              if (data.claim) onClaimFiled(data.claim);
              showToast(`💸 ₹${data.payout} sent to your UPI!`, 'success');
            }
          } catch(e) {}
        }
      }
    } catch(e) {
      // Fallback: simulate locally if backend not connected
      simulateLocally(trigger);
    }
  }

  function simulateLocally(trigger) {
    const mockLogs = [
      { step:1, msg:`[TRIGGER] ${trigger.name} detected at ${activePolicy?.store_name || 'store'}` },
      { step:2, msg:`[${trigger.api.split('+')[0].trim()}] ✓ Threshold breach confirmed at store coordinates` },
      { step:3, msg:`[CROSS-VALIDATOR] ${trigger.api.includes('+')?trigger.api.split('+')[1].trim():'Secondary API'} ✓ confirmed` },
      { step:4, msg:`[FRAUD-ENGINE] GSS Score: ${rider?.gss_score||85}/100 → AUTO-APPROVED ✓` },
      { step:5, msg:`[PAYOUT] ₹850 × 0.80 × (3/5hr) = ₹408` },
      { step:6, msg:`[UPI-GATEWAY] ✓ ₹408 sent — Transaction ID: DS${Date.now().toString().slice(-8)}` },
      { step:7, msg:`[SMS] DarkShield: ₹408 paid for 3hrs lost to ${trigger.id} at ${activePolicy?.store_name}` },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < mockLogs.length) {
        setLogs(prev => [...prev, mockLogs[i]]);
        setPipelineStep(mockLogs[i].step);
        i++;
      } else {
        clearInterval(interval);
        const txId = `DS${Date.now().toString().slice(-8)}`;
        const claim = { id: Date.now(), trigger_type: trigger.id, payout_amount:408, status:'approved', created_at: new Date().toISOString(), store_name: activePolicy?.store_name };
        setPayoutDone({ amount: 408, txId, claim });
        onClaimFiled(claim);
        showToast('💸 ₹408 sent to your UPI in 2.8 minutes!', 'success');
      }
    }, 850);
  }

  const logClass = (msg) => {
    if (msg.includes('✓') || msg.includes('APPROVED') || msg.includes('sent')) return 'log-s';
    if (msg.includes('Checking') || msg.includes('Fetching') || msg.includes('Running')) return 'log-i';
    if (msg.includes('WARN') || msg.includes('review')) return 'log-w';
    return 'log-m';
  };

  return (
    <div className="fade-up">
      <div className="tabs">
        {['file','history','exclusions'].map(t => (
          <button key={t} className={`tab-btn ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>
            {t==='file'?'⚡ File Claim':t==='history'?'📋 History':'⚠️ Exclusions'}
          </button>
        ))}
      </div>

      {/* FILE CLAIM */}
      {activeTab === 'file' && (
        <div>
          {!rider ? (
            <div style={{textAlign:'center',padding:'40px 20px',color:'var(--muted2)'}}>
              <div style={{fontSize:32,marginBottom:12}}>◉</div>
              <p>Register and activate a policy to file claims.</p>
            </div>
          ) : (
            <>
              {/* Live weather alert */}
              {liveWeather?.active_triggers?.length > 0 && (
                <div style={{background:'rgba(255,71,89,0.08)',border:'1px solid rgba(255,71,89,0.3)',borderRadius:10,padding:14,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--red)',marginBottom:4}}>⚡ Live Disruption Detected at Your Store</div>
                    <div style={{fontSize:11,color:'var(--muted2)'}}>{liveWeather.active_triggers.map(t=>t.label).join(', ')}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => fileClaim(TRIGGERS.find(t=>t.id===liveWeather.active_triggers[0].type)||TRIGGERS[0])}>
                    Auto-Claim Now
                  </button>
                </div>
              )}

              <div className="section-title">Select Disruption Type</div>
              <div className="trigger-grid">
                {TRIGGERS.map(t => (
                  <button key={t.id} className={`trigger-card ${currentTrigger?.id===t.id&&firing?'active-trigger':''}`}
                    onClick={() => !firing && fileClaim(t)} disabled={firing}
                    style={{borderColor: currentTrigger?.id===t.id&&firing ? t.color : undefined}}>
                    <span className="trigger-icon">{t.icon}</span>
                    <div className="trigger-name">{t.name}</div>
                    <div className="trigger-desc">{t.desc}</div>
                    <div className="trigger-api">{t.api}</div>
                    <span className="badge b-g" style={{fontSize:10}}>Payout: {t.payout}</span>
                  </button>
                ))}
              </div>

              {/* Live pipeline */}
              {firing && currentTrigger && (
                <div className="pipeline">
                  <div style={{fontSize:13,fontWeight:700,color:'var(--cyan)',marginBottom:14}}>
                    ⚡ ZERO-TOUCH CLAIM PIPELINE — {currentTrigger.name}
                  </div>

                  <div className="pipeline-steps">
                    {PIPELINE_STEPS.map((s,i) => (
                      <div className="pipeline-step" key={i}>
                        <div className={`pipeline-bar ${pipelineStep>i+1?'done':pipelineStep===i+1?'running':''}`}/>
                        <div className="pipeline-step-label">{s}</div>
                      </div>
                    ))}
                  </div>

                  <div className="log-box" ref={logRef}>
                    {logs.length === 0 && <span style={{color:'var(--muted)'}}>Initialising pipeline...</span>}
                    {logs.map((l,i) => (
                      <div key={i} className={`log-line ${logClass(l.msg)}`}>
                        <span style={{color:'var(--muted)',marginRight:8}}>{new Date().toLocaleTimeString()}</span>
                        {l.msg}
                      </div>
                    ))}
                  </div>

                  {payoutDone && (
                    <div className="payout-banner">
                      <div className="payout-banner-left">
                        <div className="payout-banner-title">✓ CLAIM APPROVED & PAID</div>
                        <div className="payout-banner-sub">Zero-touch · {payoutDone.txId} · No forms required</div>
                      </div>
                      <div className="payout-amount">₹{payoutDone.amount}</div>
                    </div>
                  )}

                  {payoutDone && (
                    <button className="btn btn-ghost btn-sm" style={{marginTop:12}} onClick={() => { setFiring(false); setCurrentTrigger(null); setLogs([]); setPayoutDone(null); }}>
                      File Another Claim
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* HISTORY */}
      {activeTab === 'history' && (
        <div>
          {claimHistory.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'var(--muted2)',fontSize:13}}>
              No claims yet. Claims are auto-filed when disruptions are detected.
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Trigger</th><th>Store</th><th>Amount</th><th>Status</th><th>GSS</th><th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimHistory.map(c => (
                      <tr key={c.id}>
                        <td style={{textTransform:'capitalize'}}>{TRIGGERS.find(t=>t.id===c.trigger_type)?.icon} {c.trigger_type}</td>
                        <td style={{color:'var(--muted2)'}}>{c.store_name}</td>
                        <td style={{color:'var(--green)',fontWeight:700}}>₹{c.payout_amount}</td>
                        <td><span className={`badge ${c.status==='approved'?'b-g':c.status==='rejected'?'b-r':'b-y'}`}>{c.status}</span></td>
                        <td style={{fontFamily:'var(--font-mono)'}}>{c.gss_score||85}</td>
                        <td style={{color:'var(--muted2)'}}>{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXCLUSIONS */}
      {activeTab === 'exclusions' && (
        <div style={{maxWidth:520}}>
          <div className="card">
            <div className="card-hd"><span className="card-title">⚠️ Coverage Exclusions</span></div>
            <div className="card-bd" style={{padding:0}}>
              {EXCLUSIONS.map((e,i) => (
                <div key={i} style={{display:'flex',gap:12,padding:'12px 18px',borderBottom:i<EXCLUSIONS.length-1?'1px solid var(--border)':'none',fontSize:13,alignItems:'flex-start'}}>
                  <span style={{color:'var(--red)',fontWeight:700,flexShrink:0,marginTop:1}}>✕</span>
                  <span style={{color:'var(--muted2)'}}>{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{marginTop:14,background:'var(--cyan-dim)',border:'1px solid var(--cyan-glow)',borderRadius:10,padding:14,fontSize:12,color:'var(--cyan)'}}>
            💡 Every denied claim receives a human-readable explanation. Honest riders can appeal within 48 hours.
          </div>
        </div>
      )}
    </div>
  );
}
