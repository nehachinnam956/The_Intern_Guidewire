# DarkShield — Parametric Income Protection for Q-Commerce Riders

> Guidewire DEVTrails 2026 · Phase 2 · Theme: "Protect Your Worker"

Built for Zepto & Blinkit delivery partners — automatic UPI payouts when floods, heat, curfews, or platform shutdowns block their dark store.

---

## Live Demo
- **Frontend (Vercel):** https://darkshield.vercel.app
- **Backend (Railway):** https://darkshield-api.railway.app
- **Demo video:** [2-min walkthrough link]

---

## Deliverables Checklist
- [x] Registration Process — 4-step onboarding with OTP + Leaflet map
- [x] Insurance Policy Management — Active/Pause/Cancel + exclusions
- [x] Dynamic Premium Calculation — XGBoost formula, live sliders, store comparison
- [x] Claims Management — 5 triggers, real-time SSE pipeline, UPI payout
- [x] AI Integration — Hyper-local risk scoring per dark store GPS
- [x] 3-5 automated triggers — Flood, Heat, Curfew, AQI, Closure
- [x] Zero-touch claim UX — Auto-approved in <3 min
- [x] Real API — OpenWeatherMap live weather at store coordinates
- [x] Admin dashboard — Loss ratios, fraud queue, analytics

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + Recharts + Leaflet Maps |
| Backend | Node.js + Express |
| Database | PostgreSQL (Railway) |
| Weather API | OpenWeatherMap (real) + CPCB AQI |
| Payment | Razorpay Test Mode |
| SMS/OTP | Twilio (optional) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/darkshield
cd darkshield/backend && npm install
cd ../frontend && npm install
```

### 2. Setup Database (Railway)
1. Go to railway.app → New Project → Add PostgreSQL
2. Copy DATABASE_URL from the Variables tab
3. Run `schema.sql` in the Railway query console

### 3. Configure Backend
```bash
cd backend
cp .env.example .env
# Fill in your keys:
# OPENWEATHER_API_KEY — from openweathermap.org (free)
# TWILIO_* — from twilio.com (free trial)
# RAZORPAY_* — from razorpay.com (test mode, free)
# DATABASE_URL — from Railway
```

### 4. Run Locally
```bash
# Terminal 1 — Backend
cd backend && node server.js

# Terminal 2 — Frontend
cd frontend && npm start
```

### 5. Deploy to Production
```bash
# Backend → Railway
cd backend && railway up

# Frontend → Vercel
cd frontend
# Update .env.production with your Railway URL
vercel --prod
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/send-otp | Send OTP to phone |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/register | Register rider |
| GET | /api/auth/me | Get rider profile |
| GET | /api/stores | List dark stores |
| POST | /api/stores/calculate-premium | AI premium calculation |
| POST | /api/policy/create | Create policy |
| GET | /api/policy/active | Get active policy |
| PATCH | /api/policy/toggle-pause | Pause/resume |
| GET | /api/weather/check/:store_id | Live weather + triggers |
| POST | /api/claims/file | File claim (SSE stream) |
| GET | /api/claims/history | Claim history |
| GET | /api/admin/stats | Platform stats |
| GET | /api/admin/loss-ratios | Store loss ratios |
| GET | /api/admin/fraud-queue | Claims for review |

---

## Premium Formula (AI Model)

```
Weekly Premium = Base Rate × Store Risk Score × Shift Multiplier × Tenure Discount

Base Rate:       ₹22–₹30 (city-level disruption frequency)
Store Risk:      0.75x–1.7x (XGBoost on store GPS, elevation, flood history)
Shift Multiplier: 1.0x (morning) · 1.35x (evening) · 1.40x (both)
Tenure Discount: 1.0 (0–2 months) · 0.9 (3–5 months) · 0.8 (6+ months)
```

## Payout Formula

```
Payout = Daily Baseline × Disruption Severity % × (Hours Affected / Shift Hours)
Example: ₹850 × 0.80 × (3/5) = ₹408
```

---

*DarkShield — Because Every Dark Store Has a Story Worth Protecting*
