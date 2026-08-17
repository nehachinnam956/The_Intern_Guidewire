import { weather } from '../api';
import { useState, useEffect } from 'react';

const TRIGGER_ICONS = { flood:'🌊', heat:'🔥', curfew:'🚧', aqi:'😷', closure:'🏪' };

export default function Dashboard({ rider, activePolicy, claimHistory, setTab, showToast }) {
  const [liveWeather, setLiveWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    if (activePolicy?.store_id) fetchWeather(activePolicy.store_id);
  }, [activePolicy]);

  async function fetchWeather(storeId) {
    setWeatherLoading(true);
    try {
      const res = await weather.check(storeId);
      setLiveWeather(res.data);
    } catch(e) { /* silent */ }
    finally { setWeatherLoading(false); }
  }

  const totalPaid = claimHistory.filter(c => c.status === 'approved').reduce((a,c) => a + parseFloat(c.payout_amount||0), 0);

  if (!rider) return (
    <div className="fade-up">
      <div style={{marginBottom:32}}>
        <h1 style={{fontFamily:'var(--font-head)',fontSize:28,fontWeight:800,marginBottom:8}}>
          Income protection for <span style={{color:'var(--cyan)'}}>every dark store rider.</span>
        </h1>
        <p style={{color:'var(--muted2)',fontSize:14,maxWidth:500,lineHeight:1.7}}>
          DarkShield pays you automatically when floods, heat, curfews or platform shutdowns block your dark store.
          No forms. No waiting. UPI in under 3 minutes.
        </p>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[
          {label:'Avg payout time',val:'2.8 min',sub:'From trigger to UPI',color:'var(--cyan)'},
          {label:'Riders covered',val:'50,000+',sub:'Across 5 cities',color:'var(--green)'},
          {label:'Claims paid',val:'₹48L+',sub:'This month',color:'var(--orange)'},
        ].map((s,i) => (
          <div className="stat" key={i}>
            <div className="stat-bar" style={{background:s.color}}/>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginTop:8}}>
        <div className="card-hd"><span className="card-title">How DarkShield Works</span></div>
        <div className="card-bd">
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
            {[
              {step:'01',title:'Register',desc:'Link your Zepto/Blinkit ID and pick your dark store',icon:'◎'},
              {step:'02',title:'Pay Weekly',desc:'₹11–₹71/week based on your store\'s AI risk score',icon:'◆'},
              {step:'03',title:'Auto-Detected',desc:'5 live feeds monitor your store 24/7 for disruptions',icon:'◉'},
              {step:'04',title:'UPI in 3 min',desc:'Approved automatically. No forms. No calls.',icon:'⚡'},
            ].map((s,i) => (
              <div key={i} style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',marginBottom:8}}>{s.step}</div>
                <div style={{fontSize:24,marginBottom:8,color:'var(--cyan)'}}>{s.icon}</div>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{s.title}</div>
                <div style={{fontSize:11,color:'var(--muted2)',lineHeight:1.5}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{marginTop:20,display:'flex',gap:10}}>
        <button className="btn btn-orange" style={{padding:'11px 28px'}} onClick={() => setTab('register')}>
          Register Now →
        </button>
        <button className="btn btn-ghost" onClick={() => setTab('premium')}>
          Calculate My Premium
        </button>
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      <div style={{marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2 style={{fontFamily:'var(--font-head)',fontSize:20,fontWeight:800}}>
            Good {getGreeting()}, {rider.name?.split(' ')[0]} 👋
          </h2>
          <p style={{fontSize:12,color:'var(--muted2)',marginTop:3}}>
            {activePolicy ? `Policy active · Renews ${activePolicy.next_renewal || 'Monday'}` : 'No active policy'}
          </p>
        </div>
        {activePolicy && (
          <button className="btn btn-ghost btn-sm" onClick={() => activePolicy.store_id && fetchWeather(activePolicy.store_id)}>
            {weatherLoading ? '...' : '↻ Refresh Weather'}
          </button>
        )}
      </div>

      <div className="stat-grid">
        {[
          {label:'Weekly Premium',val:`₹${activePolicy?.weekly_premium || 0}`,sub:'Next: '+( activePolicy?.next_renewal||'—'),color:'var(--orange)'},
          {label:'Max Coverage',val:`₹${(activePolicy?.max_coverage||0).toLocaleString()}`,sub:'Income protected',color:'var(--green)'},
          {label:'Store Risk',val:activePolicy?.risk_label||'—',sub:activePolicy?.store_name||'No store',color:activePolicy?.risk_label==='HIGH'?'var(--red)':activePolicy?.risk_label==='LOW'?'var(--green)':'var(--yellow)'},
          {label:'Total Paid Out',val:`₹${Math.round(totalPaid)}`,sub:`${claimHistory.length} claims`,color:'var(--cyan)'},
        ].map((s,i) => (
          <div className="stat" key={i}>
            <div className="stat-bar" style={{background:s.color}}/>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{gap:16}}>
        {/* Live weather */}
        <div className="card">
          <div className="card-hd">
            <span className="card-title">🌡️ Live Conditions at Your Store</span>
            {liveWeather && <span className="badge b-c" style={{fontSize:9}}>{liveWeather.weather?.source?.includes('Demo')?'DEMO':'LIVE'}</span>}
          </div>
          <div className="card-bd">
            {!liveWeather && !weatherLoading && <p style={{fontSize:12,color:'var(--muted2)'}}>No store selected</p>}
            {weatherLoading && <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--muted2)',fontSize:12}}><div className="loader" style={{width:16,height:16,borderWidth:2}}/> Fetching live data...</div>}
            {liveWeather && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  {[
                    {label:'Temperature',val:`${liveWeather.weather?.temperature?.toFixed(1)||'—'}°C`,alert:liveWeather.weather?.heat_trigger},
                    {label:'Rainfall (1hr)',val:`${liveWeather.weather?.rain_1h_mm?.toFixed(1)||0}mm`,alert:liveWeather.weather?.flood_trigger},
                    {label:'Humidity',val:`${liveWeather.weather?.humidity||'—'}%`,alert:false},
                    {label:'AQI',val:liveWeather.aqi?.aqi||'—',alert:liveWeather.aqi?.aqi_trigger},
                  ].map((w,i) => (
                    <div key={i} style={{background:'var(--s2)',borderRadius:8,padding:'10px 12px',border:`1px solid ${w.alert?'var(--red)':'var(--border)'}`}}>
                      <div style={{fontSize:10,color:'var(--muted)',marginBottom:4}}>{w.label}</div>
                      <div style={{fontSize:18,fontWeight:700,color:w.alert?'var(--red)':'var(--text)'}}>{w.val}</div>
                      {w.alert && <div style={{fontSize:9,color:'var(--red)',marginTop:2}}>⚠ ALERT</div>}
                    </div>
                  ))}
                </div>
                {liveWeather.active_triggers?.length > 0 ? (
                  <div style={{background:'var(--red-dim)',border:'1px solid rgba(255,71,89,0.3)',borderRadius:8,padding:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--red)',marginBottom:6}}>⚡ Active Triggers Detected!</div>
                    {liveWeather.active_triggers.map((t,i) => (
                      <div key={i} style={{fontSize:11,color:'var(--muted2)',marginBottom:3}}>• {t.label}</div>
                    ))}
                    <button className="btn btn-danger btn-sm btn-full" style={{marginTop:10}} onClick={() => setTab('claims')}>
                      File Claim Now
                    </button>
                  </div>
                ) : (
                  <div style={{background:'var(--green-dim)',border:'1px solid rgba(35,209,139,0.2)',borderRadius:8,padding:10,fontSize:12,color:'var(--green)'}}>
                    ✓ All clear — no active disruptions at your store
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Recent claims */}
        <div className="card">
          <div className="card-hd">
            <span className="card-title">📋 Recent Claims</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setTab('claims')}>View All</button>
          </div>
          <div className="card-bd" style={{padding:0}}>
            {claimHistory.length === 0 ? (
              <div style={{padding:'32px 18px',textAlign:'center',color:'var(--muted2)',fontSize:12}}>
                No claims yet. Triggers auto-file when disruptions hit your store.
              </div>
            ) : (
              claimHistory.slice(0,5).map((c,i) => (
                <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:i<4?'1px solid var(--border)':'none'}}>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <span style={{fontSize:18}}>{TRIGGER_ICONS[c.trigger_type]||'⚡'}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{c.trigger_type} Event</div>
                      <div style={{fontSize:10,color:'var(--muted2)'}}>{new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--green)'}}>₹{c.payout_amount}</div>
                    <span className={`badge ${c.status==='approved'?'b-g':c.status==='rejected'?'b-r':'b-y'}`} style={{fontSize:9}}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
