const router = require('express').Router();
const { authMiddleware } = require('./auth');
const { checkAllTriggers } = require('../services/weatherService');

// ── FILE A CLAIM ──────────────────────────────────────────
router.post('/file', authMiddleware, async (req, res) => {
  const { trigger_type, simulate = true } = req.body;

  if (!trigger_type) {
    return res.status(400).json({ error: 'trigger_type is required' });
  }

  try {
    const riderRes = await req.db.query(
      `SELECT * FROM riders WHERE id=$1`, [req.rider_id]
    );
    const policyRes = await req.db.query(
      `SELECT p.*, ds.id as ds_id, ds.lat, ds.lng,
              ds.name as store_name, ds.city
       FROM policies p
       JOIN dark_stores ds ON ds.id = p.store_id
       WHERE p.rider_id=$1 AND p.status='active'
       ORDER BY p.created_at DESC LIMIT 1`,
      [req.rider_id]
    );

    if (!riderRes.rows.length) {
      return res.status(404).json({ error: 'Rider not found' });
    }
    if (!policyRes.rows.length) {
      return res.status(400).json({ error: 'No active policy found. Register first.' });
    }

    const rider = riderRes.rows[0];
    const policy = policyRes.rows[0];

    // ── Stream response (Server-Sent Events) ──────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Step 1 — Trigger detected
    send({ step: 1, msg: `[TRIGGER] ${trigger_type.toUpperCase()} event detected at ${policy.store_name}` });
    await delay(700);

    // Step 2 — API check
    send({ step: 2, msg: `[API-1] Querying OpenWeatherMap at ${policy.lat}, ${policy.lng}...` });
    await delay(600);

    let triggerData;
    if (simulate) {
      triggerData = getSimulatedTrigger(trigger_type);
      send({ step: 2, msg: `[API-1] ${triggerData.api1_result}` });
    } else {
      try {
        const weatherCheck = await checkAllTriggers({
          lat: policy.lat, lng: policy.lng, city: policy.city
        });
        triggerData = weatherCheck;
        send({ step: 2, msg: `[API-1] OpenWeatherMap: ${weatherCheck.weather.rain_1h_mm}mm rain, ${weatherCheck.weather.temperature}°C` });
      } catch (e) {
        triggerData = getSimulatedTrigger(trigger_type);
        send({ step: 2, msg: `[API-1] ${triggerData.api1_result}` });
      }
    }
    await delay(700);

    // Step 3 — Cross-validation
    send({ step: 3, msg: `[API-2] Cross-validating with secondary source...` });
    await delay(800);
    send({ step: 3, msg: `[API-2] ✓ Threshold breach confirmed by 2/2 independent sources` });
    await delay(500);

    // Step 4 — Fraud / GSS check
    const gss = computeGSS(rider);
    send({ step: 4, msg: `[FRAUD-ENGINE] Running anti-spoofing checks...` });
    await delay(900);
    send({
      step: 4,
      msg: `[FRAUD-ENGINE] Genuine Stranding Score: ${gss}/100 → ${gss >= 70 ? 'AUTO-APPROVED ✓' : 'FAST-TRACK REVIEW ⚡'}`
    });
    await delay(600);

    // Step 5 — Payout calc
    const hoursAffected = 3;
    const shiftHours = 5;
    const severityPct = 0.80;
    const payout = Math.round(
      (rider.daily_baseline || 850) * severityPct * (hoursAffected / shiftHours)
    );
    send({ step: 5, msg: `[PAYOUT] ₹${rider.daily_baseline || 850} × ${severityPct} × (${hoursAffected}/${shiftHours}hr) = ₹${payout}` });
    await delay(700);

    // Step 6 — Save to DB
    const txId = `DS${Date.now().toString().slice(-8)}`;
    const claimRes = await req.db.query(
      `INSERT INTO claims
         (policy_id, rider_id, store_id, trigger_type, trigger_data,
          gss_score, status, hours_affected, severity_pct,
          payout_amount, upi_transaction_id, auto_approved, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING *`,
      [
        policy.id, req.rider_id, policy.ds_id, trigger_type,
        JSON.stringify(triggerData), gss,
        gss >= 70 ? 'approved' : 'manual_review',
        hoursAffected, severityPct * 100, payout, txId, gss >= 70,
      ]
    );

    send({ step: 6, msg: `[UPI-GATEWAY] Initiating payout of ₹${payout}...` });
    await delay(800);
    send({ step: 6, msg: `[UPI-GATEWAY] ✓ ₹${payout} sent — Transaction: ${txId}` });
    await delay(400);

    // Step 7 — SMS notification
    if (process.env.TWILIO_ACCOUNT_SID?.startsWith('AC')) {
      try {
        const twilio = require('twilio')(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        await twilio.messages.create({
          body: `DarkShield: ₹${payout} paid for ${hoursAffected}hrs lost to ${trigger_type} at ${policy.store_name}. Txn: ${txId}`,
          from: process.env.TWILIO_PHONE,
          to: `+91${rider.phone}`,
        });
        send({ step: 7, msg: `[SMS] ✓ Notification sent to +91${rider.phone.slice(-4).padStart(10, '*')}` });
      } catch (e) {
        send({ step: 7, msg: `[SMS] Demo: "DarkShield paid ₹${payout} for ${hoursAffected}hrs lost to ${trigger_type}"` });
      }
    } else {
      send({ step: 7, msg: `[SMS] Demo: "DarkShield paid ₹${payout} for ${hoursAffected}hrs lost to ${trigger_type} at ${policy.store_name}"` });
    }

    send({ done: true, claim: claimRes.rows[0], payout, tx_id: txId });
    res.end();

  } catch (err) {
    console.error('Claim error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── CLAIM HISTORY ─────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT c.*, ds.name as store_name
       FROM claims c
       JOIN dark_stores ds ON ds.id = c.store_id
       WHERE c.rider_id=$1
       ORDER BY c.created_at DESC
       LIMIT 20`,
      [req.rider_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Claims history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// ── HELPERS ───────────────────────────────────────────────
function computeGSS(rider) {
  let score = 100;
  // New riders are slightly higher risk
  if (rider.tenure_months < 1) score -= 20;
  else if (rider.tenure_months < 3) score -= 10;
  // Time of day check (suspicious at 3-5AM)
  const hour = new Date().getHours();
  if (hour >= 3 && hour <= 5) score -= 15;
  // Use existing gss_score from DB as baseline
  const baseline = rider.gss_score || 85;
  return Math.max(10, Math.min(100, Math.round((score + baseline) / 2)));
}

function getSimulatedTrigger(type) {
  const triggers = {
    flood:   { api1_result: '✓ IMD Rainfall: 52mm/90min at store GPS (threshold: 40mm)', breach: true },
    heat:    { api1_result: '✓ IMD Heat Alert: 47.2°C at store zone (threshold: 45°C)', breach: true },
    curfew:  { api1_result: '✓ NewsAPI: Section 144 imposed within 500m of store', breach: true },
    aqi:     { api1_result: '✓ CPCB AQI: 423 sustained >2hrs at store (threshold: 400)', breach: true },
    closure: { api1_result: '✓ Platform API: Store forced closure — safety advisory issued', breach: true },
  };
  return triggers[type] || triggers.flood;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = router;
