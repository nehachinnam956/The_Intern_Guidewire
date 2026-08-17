const router = require('express').Router();

// ── GET ALL STORES ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT * FROM dark_stores ORDER BY city, name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Stores error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// ── CALCULATE PREMIUM ─────────────────────────────────────
// IMPORTANT: Must be before /:id to avoid Express matching
// "calculate-premium" as an id parameter
router.post('/calculate-premium', async (req, res) => {
  const { store_id, shift_pattern, tenure_months } = req.body;

  if (!store_id) {
    return res.status(400).json({ error: 'store_id is required' });
  }

  try {
    const store = await req.db.query(
      `SELECT * FROM dark_stores WHERE id=$1`, [store_id]
    );
    if (!store.rows.length) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const s = store.rows[0];
    const cityBase = ['Bengaluru', 'Mumbai'].includes(s.city) ? 28
      : s.city === 'Delhi' ? 30 : 22;
    const shiftMult = shift_pattern === 'evening' ? 1.35
      : shift_pattern === 'both' ? 1.40 : 1.00;
    const tenureDisc = tenure_months >= 6 ? 0.80
      : tenure_months >= 3 ? 0.90 : 1.00;
    const premium = Math.round(cityBase * s.risk_score * shiftMult * tenureDisc);
    const maxCoverage = 850 * 5; // 5 days income

    // Feature weights (ML-ready architecture)
    const confidence = Math.round(
      (s.risk_score / 2.0) * 40 +
      (shift_pattern === 'evening' ? 1 : 0) * 20 +
      (shift_pattern === 'both' ? 1 : 0) * 10 +
      (1 - Math.min(tenure_months / 24, 1)) * 20 +
      (s.historical_flood_count / 10) * 10
    );

    res.json({
      premium,
      max_coverage: maxCoverage,
      model: {
        type: 'weighted_feature_scoring',
        confidence_score: Math.min(confidence, 100),
        feature_weights: {
          store_risk: '40%',
          shift_pattern: '30%',
          tenure: '20%',
          historical_claims: '10%',
        },
        ml_ready: true,
      },
      breakdown: {
        city_base: cityBase,
        store_risk: s.risk_score,
        risk_label: s.risk_label,
        shift_multiplier: shiftMult,
        tenure_discount: tenureDisc,
        formula: `₹${cityBase} × ${s.risk_score} × ${shiftMult} × ${tenureDisc} = ₹${premium}`,
      },
    });
  } catch (err) {
    console.error('Premium calc error:', err.message);
    res.status(500).json({ error: 'Premium calculation failed', detail: err.message });
  }
});

// ── GET SINGLE STORE ──────────────────────────────────────
// Must be after /calculate-premium
router.get('/:id', async (req, res) => {
  try {
    const store = await req.db.query(
      `SELECT * FROM dark_stores WHERE id=$1`, [req.params.id]
    );
    if (!store.rows.length) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const events = await req.db.query(
      `SELECT * FROM trigger_events
       WHERE store_id=$1 AND threshold_breached=true
       ORDER BY checked_at DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ ...store.rows[0], recent_events: events.rows });
  } catch (err) {
    console.error('Store fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

module.exports = router;
