import { useState, useEffect } from 'react';
import { auth, policy, claims } from './api';
import Registration from './pages/Registration';
import Dashboard from './pages/Dashboard';
import PolicyPage from './pages/PolicyPage';
import PremiumCalculator from './pages/PremiumCalculator';
import ClaimsPage from './pages/ClaimsPage';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [rider, setRider] = useState(null);
  const [activePolicy, setActivePolicy] = useState(null);
  const [claimHistory, setClaimHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (token) loadRiderData();
    else setLoading(false);
  }, []);

  async function loadRiderData() {
    try {
      setLoading(true);
      const [meRes, policyRes, claimsRes] = await Promise.allSettled([
        auth.me(), policy.active(), claims.history(),
      ]);
      if (meRes.status === 'fulfilled') setRider(meRes.value.data);
      if (policyRes.status === 'fulfilled') setActivePolicy(policyRes.value.data.policy);
      if (claimsRes.status === 'fulfilled') setClaimHistory(claimsRes.value.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  function onRegistered(token, riderData) {
    localStorage.setItem('ds_token', token);
    setRider(riderData);
    setTab('dashboard');
    showToast('🎉 Welcome to DarkShield! Policy activating...', 'success');
    setTimeout(loadRiderData, 800);
  }

  function onPolicyUpdate(p) {
    setActivePolicy(p);
    loadRiderData();
  }

  function onClaimFiled(claim) {
    setClaimHistory(prev => [claim, ...prev]);
    loadRiderData();
  }

  function logout() {
    localStorage.removeItem('ds_token');
    setRider(null); setActivePolicy(null); setClaimHistory([]);
    setTab('dashboard');
    showToast('Logged out', 'info');
  }

  const navItems = [
    { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
    { id: 'register', icon: '◎', label: rider ? 'Profile' : 'Register' },
    { id: 'policy', icon: '◈', label: 'Policy' },
    { id: 'premium', icon: '◆', label: 'AI Premium' },
    { id: 'claims', icon: '◉', label: 'Claims' },
    { id: 'admin', icon: '▣', label: 'Admin' },
  ];

  const sharedProps = { rider, activePolicy, claimHistory, showToast, loadRiderData };

  return (
    <div className="shell">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">◈</span>
          <div>
            <div className="brand-name">DarkShield</div>
            <div className="brand-tagline">Protect Your Worker</div>
          </div>
        </div>

        <div className="nav-section">Navigation</div>
        {navItems.map(n => (
          <div key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
            {n.id === 'claims' && claimHistory.length > 0 &&
              <span className="nav-badge nb-g">{claimHistory.length}</span>}
            {n.id === 'register' && !rider &&
              <span className="nav-badge nb-o">NEW</span>}
          </div>
        ))}

        <div className="sidebar-footer">
          {rider ? (
            <div className="rider-card">
              <div className="rider-avatar">{(rider.name || 'R')[0].toUpperCase()}</div>
              <div className="rider-info">
                <div className="rider-name">{rider.name}</div>
                <div className="rider-id">{rider.partner_id}</div>
              </div>
              <button className="logout-btn" onClick={logout} title="Logout">⏻</button>
            </div>
          ) : (
            <div className="sidebar-cta" onClick={() => setTab('register')}>Get Protected →</div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="page-title">{navItems.find(n => n.id === tab)?.label}</div>
          <div className="topbar-right">
            {activePolicy && (
              <div className={`live-pill ${activePolicy.status === 'paused' ? 'pill-paused' : ''}`}>
                <span className="pdot" />
                {activePolicy.status === 'paused' ? 'Paused' : 'Protected'}
              </div>
            )}
            {rider && <div className="store-tag">📍 {activePolicy?.store_name || rider.city || 'No store'}</div>}
          </div>
        </header>

        <div className="content">
          {loading ? (
            <div className="loading-screen">
              <div className="loader" /><p>Loading DarkShield...</p>
            </div>
          ) : (
            <>
              {tab === 'dashboard'  && <Dashboard {...sharedProps} setTab={setTab} />}
              {tab === 'register'   && <Registration {...sharedProps} onRegistered={onRegistered} setTab={setTab} />}
              {tab === 'policy'     && <PolicyPage {...sharedProps} onPolicyUpdate={onPolicyUpdate} />}
              {tab === 'premium'    && <PremiumCalculator {...sharedProps} />}
              {tab === 'claims'     && <ClaimsPage {...sharedProps} onClaimFiled={onClaimFiled} />}
              {tab === 'admin'      && <AdminDashboard {...sharedProps} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
