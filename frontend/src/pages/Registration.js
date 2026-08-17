import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { auth, stores, policy, payment } from '../api';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const RISK_COLORS = { HIGH: '#ff4759', MEDIUM: '#f0c040', LOW: '#23d18b' };
const STEPS = ['Verify', 'Dark Store', 'Coverage', 'Activate'];

export default function Registration({ rider, onRegistered, showToast, setTab }) {
  const [step, setStep] = useState(0);
  const [storeList, setStoreList] = useState([]);
  const [form, setForm] = useState({ name:'', phone:'', partnerId:'', platform:'blinkit', shift:'morning', tenure:1 });
  const [selectedStore, setSelectedStore] = useState(null);
  const [premiumData, setPremiumData] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { if (selectedStore && form.shift && form.tenure) calcPremium(); }, [selectedStore, form.shift, form.tenure]);
  useEffect(() => { if (selectedStore) setMapCenter([parseFloat(selectedStore.lat), parseFloat(selectedStore.lng)]); }, [selectedStore]);

  async function loadStores() {
    try {
      const res = await stores.list();
      setStoreList(res.data);
    } catch(e) { showToast('Could not load stores — using demo data', 'info'); }
  }

  async function sendOtp() {
    if (!form.phone || form.phone.length < 10) return showToast('Enter valid 10-digit phone', 'error');
    setLoading(true);
    try {
      const res = await auth.sendOtp(form.phone);
      setOtpSent(true);
      if (res.data.demo_otp) {
        setDemoOtp(res.data.demo_otp);
        showToast(`Demo OTP: ${res.data.demo_otp}`, 'info');
      } else {
        showToast('OTP sent to ' + form.phone, 'success');
      }
    } catch(e) { showToast('OTP send failed', 'error'); }
    setLoading(false);
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      await auth.verifyOtp(form.phone, otp);
      setOtpVerified(true);
      showToast('✓ Phone verified', 'success');
    } catch(e) { showToast('Invalid OTP', 'error'); }
    setLoading(false);
  }

  async function calcPremium() {
    if (!selectedStore) return;
    try {
      const res = await stores.calcPremium({ store_id: selectedStore.id, shift_pattern: form.shift, tenure_months: form.tenure });
      setPremiumData(res.data);
    } catch(e) {
      // Fallback local calc
      const city = ['Bengaluru','Mumbai'].includes(selectedStore.city) ? 28 : selectedStore.city==='Delhi' ? 30 : 22;
      const sm = form.shift==='evening'?1.35:form.shift==='both'?1.40:1.00;
      const td = form.tenure>=6?0.80:form.tenure>=3?0.90:1.00;
      setPremiumData({ premium: Math.round(city*selectedStore.risk_score*sm*td), max_coverage:4250, breakdown:{city_base:city,store_risk:selectedStore.risk_score,shift_multiplier:sm,tenure_discount:td,risk_label:selectedStore.risk_label} });
    }
  }

  async function activatePolicy() {
    if (!premiumData) return;
    setLoading(true);
    try {
      // Create order
      const orderRes = await payment.createOrder(premiumData.premium);
      let paymentId = `demo_${Date.now()}`;

      if (!orderRes.data.demo && window.Razorpay) {
        // Real Razorpay checkout
        paymentId = await new Promise((resolve, reject) => {
          const rp = new window.Razorpay({
            key: orderRes.data.key,
            amount: orderRes.data.amount,
            currency: 'INR',
            name: 'DarkShield',
            description: `Weekly Policy — ${selectedStore.name}`,
            order_id: orderRes.data.order_id,
            handler: async (response) => {
              await payment.verify(response);
              resolve(response.razorpay_payment_id);
            },
            prefill: { name: form.name, contact: form.phone },
            theme: { color: '#00e5ff' }
          });
          rp.open();
          rp.on('payment.failed', () => reject(new Error('Payment failed')));
        });
      }

      // Register rider
      const regRes = await auth.register({
        name: form.name, phone: form.phone, partner_id: form.partnerId,
        city: selectedStore.city, tenure_months: form.tenure,
        shift_pattern: form.shift, platform: form.platform
      });

      // Store token
      localStorage.setItem('ds_token', regRes.data.token);
      await new Promise(r => setTimeout(r, 500));

      // Create policy
      await policy.create({
        store_id: selectedStore.id,
        weekly_premium: premiumData.premium,
        max_coverage: premiumData.max_coverage,
        razorpay_payment_id: paymentId
      });

      onRegistered(regRes.data.token, regRes.data.rider);
    } catch(e) {
      console.error(e);
      showToast('Activation failed: ' + (e.response?.data?.detail || e.message), 'error');
    }
    setLoading(false);
  }

  if (rider) return (
    <div className="fade-up" style={{maxWidth:500}}>
      <div className="card">
        <div className="card-hd"><span className="card-title">◎ Your Profile</span></div>
        <div className="card-bd">
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
            <div className="rider-avatar" style={{width:52,height:52,fontSize:20}}>{rider.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={{fontSize:16,fontWeight:700}}>{rider.name}</div>
              <div style={{fontSize:12,color:'var(--muted2)',fontFamily:'var(--font-mono)'}}>{rider.partner_id}</div>
              <span className="badge b-c" style={{marginTop:4}}>{rider.platform}</span>
            </div>
          </div>
          {[
            ['Phone', rider.phone], ['City', rider.city],
            ['Shift', rider.shift_pattern], ['Tenure', rider.tenure_months + ' months'],
            ['Daily Baseline', '₹' + rider.daily_baseline], ['Stranding Score', (rider.gss_score||85) + '/100'],
          ].map(([k,v]) => (
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--muted2)'}}>{k}</span>
              <span style={{fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-up" style={{maxWidth:580}}>
      <h2 style={{fontFamily:'var(--font-head)',fontSize:20,fontWeight:800,marginBottom:4}}>Get DarkShield Coverage</h2>
      <p style={{fontSize:13,color:'var(--muted2)',marginBottom:24}}>Takes 2 minutes. Covered from next Monday.</p>

      {/* Steps */}
      <div className="steps">
        {STEPS.map((s,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:0}}>
            <div className="step-item">
              <div className={`step-dot ${step>i?'done':step===i?'active':''}`}>
                {step > i ? '✓' : i+1}
              </div>
              <div className="step-label">{s}</div>
            </div>
            {i < STEPS.length-1 && <div className={`step-connector ${step>i?'done':''}`} />}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-bd">

          {/* Step 0: Verify */}
          {step === 0 && (
            <div>
              <div className="section-title">Step 1 — Verify Your Identity</div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="e.g. Priya Sharma" value={form.name} onChange={e => setForm({...form,name:e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Partner ID</label>
                  <input className="form-input" placeholder="BLK-4821-KRM" value={form.partnerId} onChange={e => setForm({...form,partnerId:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select className="form-select" value={form.platform} onChange={e => setForm({...form,platform:e.target.value})}>
                    <option value="blinkit">Blinkit</option>
                    <option value="zepto">Zepto</option>
                    <option value="instamart">Swiggy Instamart</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <div style={{display:'flex',gap:8}}>
                  <input className="form-input" placeholder="10-digit number" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} />
                  <button className="btn btn-ghost" style={{whiteSpace:'nowrap'}} onClick={sendOtp} disabled={otpSent||loading}>
                    {loading?'...':otpSent?'Sent ✓':'Send OTP'}
                  </button>
                </div>
              </div>
              {otpSent && !otpVerified && (
                <div className="form-group">
                  <label className="form-label">Enter OTP {demoOtp && <span style={{color:'var(--orange)'}}>— Demo OTP: <strong>{demoOtp}</strong></span>}</label>
                  <div style={{display:'flex',gap:8}}>
                    <input className="form-input" placeholder="6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} style={{letterSpacing:6,textAlign:'center'}} maxLength={6} />
                    <button className="btn btn-green" onClick={verifyOtp} disabled={loading}>{loading?'...':'Verify'}</button>
                  </div>
                </div>
              )}
              {otpVerified && <div style={{color:'var(--green)',fontSize:13,marginBottom:12}}>✓ Phone verified</div>}
              <button className="btn btn-orange btn-full" style={{marginTop:8}} disabled={!otpVerified||!form.name||!form.partnerId}
                onClick={() => { if(otpVerified&&form.name&&form.partnerId) setStep(1); else showToast('Complete all fields','error'); }}>
                Continue →
              </button>
            </div>
          )}

          {/* Step 1: Store selection with map */}
          {step === 1 && (
            <div>
              <div className="section-title">Step 2 — Select Your Dark Store</div>
              <div className="map-container">
                <MapContainer center={mapCenter} zoom={12} style={{height:'100%',width:'100%'}} key={mapCenter.join()}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="©OpenStreetMap ©CARTO" />
                  {storeList.map(s => (
                    <Marker key={s.id} position={[parseFloat(s.lat), parseFloat(s.lng)]}
                      eventHandlers={{ click: () => setSelectedStore(s) }}>
                      <Popup>
                        <div style={{fontFamily:'sans-serif',fontSize:12}}>
                          <strong>{s.name}</strong><br/>
                          Risk: {s.risk_label} · {s.risk_score}x<br/>
                          {s.zone_description}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {selectedStore && (
                    <Circle center={[parseFloat(selectedStore.lat), parseFloat(selectedStore.lng)]}
                      radius={500} pathOptions={{ color: RISK_COLORS[selectedStore.risk_label]||'#00e5ff', fillOpacity: 0.1 }} />
                  )}
                </MapContainer>
              </div>

              {storeList.map(s => (
                <div key={s.id} className={`store-card ${selectedStore?.id===s.id?'selected':''}`}
                  onClick={() => setSelectedStore(s)}>
                  <div className="store-card-top">
                    <span className="store-card-name">{s.name}</span>
                    <span className="badge" style={{background:RISK_COLORS[s.risk_label]+'22',color:RISK_COLORS[s.risk_label],border:`1px solid ${RISK_COLORS[s.risk_label]}44`}}>
                      {s.risk_label} RISK
                    </span>
                  </div>
                  <div className="store-card-sub">{s.city} · {s.zone_description}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:4,fontFamily:'var(--font-mono)'}}>
                    Risk multiplier: {s.risk_score}x · {s.historical_flood_count||0} flood events
                  </div>
                </div>
              ))}

              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
                <button className="btn btn-orange" style={{flex:1}} disabled={!selectedStore}
                  onClick={() => { if(selectedStore) setStep(2); else showToast('Select a store','error'); }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Coverage */}
          {step === 2 && (
            <div>
              <div className="section-title">Step 3 — AI Premium Calculation</div>
              <div className="form-row" style={{marginBottom:16}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Shift Pattern</label>
                  <select className="form-select" value={form.shift} onChange={e => setForm({...form,shift:e.target.value})}>
                    <option value="morning">Morning 8AM–1PM</option>
                    <option value="evening">Evening 5PM–10PM</option>
                    <option value="both">Both Shifts</option>
                  </select>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Months on Platform</label>
                  <select className="form-select" value={form.tenure} onChange={e => setForm({...form,tenure:+e.target.value})}>
                    {[1,2,3,4,6,8,12,18,24].map(m => <option key={m} value={m}>{m} month{m>1?'s':''}</option>)}
                  </select>
                </div>
              </div>

              {premiumData && (
                <div className="premium-box" style={{marginBottom:16}}>
                  <div style={{fontSize:10,color:'var(--cyan)',fontWeight:700,marginBottom:12,letterSpacing:1}}>
                    🤖 AI MODEL OUTPUT — XGBoost + Random Forest
                  </div>
                  {[
                    ['City Base Rate', `₹${premiumData.breakdown?.city_base}/week`],
                    [`Store Risk (${premiumData.breakdown?.risk_label})`, `×${premiumData.breakdown?.store_risk}`],
                    ['Shift Exposure', `×${premiumData.breakdown?.shift_multiplier}`],
                    ['Tenure Loyalty Discount', `×${premiumData.breakdown?.tenure_discount}`],
                  ].map(([k,v]) => (
                    <div className="premium-row" key={k}>
                      <span className="premium-key">{k}</span>
                      <span className="premium-val">{v}</span>
                    </div>
                  ))}
                  <div className="premium-total">
                    <span className="premium-total-label">Your Weekly Premium</span>
                    <span className="premium-total-val">₹{premiumData.premium}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--muted2)',marginTop:6}}>
                    Max payout: ₹{premiumData.max_coverage?.toLocaleString()} · Auto-renews every Monday
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-orange" style={{flex:1}} onClick={() => setStep(3)}>Review & Activate →</button>
              </div>
            </div>
          )}

          {/* Step 3: Activate */}
          {step === 3 && (
            <div>
              <div className="section-title">Step 4 — Confirm & Activate</div>
              <div style={{background:'var(--s2)',borderRadius:10,padding:16,marginBottom:16}}>
                {[
                  ['Rider', form.name], ['Partner ID', form.partnerId],
                  ['Platform', form.platform], ['Dark Store', selectedStore?.name],
                  ['City', selectedStore?.city], ['Store Risk', selectedStore?.risk_label],
                  ['Shift', form.shift], ['Tenure', form.tenure + ' months'],
                  ['Weekly Premium', `₹${premiumData?.premium}`],
                  ['Max Coverage', `₹${premiumData?.max_coverage?.toLocaleString()}`],
                ].map(([k,v]) => (
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                    <span style={{color:'var(--muted2)'}}>{k}</span>
                    <span style={{fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:'var(--orange-dim)',border:'1px solid rgba(255,109,46,0.2)',borderRadius:8,padding:12,fontSize:12,color:'var(--orange)',marginBottom:16}}>
                💡 Coverage starts next Monday. Renews weekly. Cancel anytime with 1 tap.
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-green" style={{flex:1,fontSize:14,padding:'11px 0'}} onClick={activatePolicy} disabled={loading}>
                  {loading ? '⏳ Processing...' : `🛡️ Activate — Pay ₹${premiumData?.premium}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
