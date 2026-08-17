const router = require('express').Router();
const { authMiddleware } = require('./auth');

// ── CREATE POLICY ─────────────────────────────────────────
// No authMiddleware here — rider_id comes from JWT OR body
router.post('/create', async (req, res) => {
  const { store_id, weekly_premium, max_coverage, razorpay_payment_id } = req.body;

  // Get rider_id from JWT token
  let riderId = req.body.rider_id;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(
        authHeader.split(' ')[1],
        process.env.JWT_SECRET || 'darkshield_secret_2026'
      );
      riderId = decoded.rider_id;
    } catch (e) {
      console.log('JWT decode failed, using body rider_id');
    }
  }

  if (!riderId) {
    return res.status(400).json({ error: 'rider_id required — login or include in body' });
  }
  if (!store_id || !weekly_premium) {
    return res.status(400).json({ error: 'store_id and weekly_premium are required' });
  }

  try {
    // Cancel existing active policy
    await req.db.query(
      `UPDATE policies SET status='cancelled' WHERE rider_id=$1 AND status='active'`,
      [riderId]
    );

    const nextMonday = getNextMonday();
    const result = await req.db.query(
      `INSERT INTO policies
         (rider_id, store_id, weekly_premium, max_coverage, next_renewal, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [riderId, store_id, weekly_premium, max_coverage || 4250, nextMonday, razorpay_payment_id || null]
    );

    res.json({ success: true, policy: result.rows[0] });
  } catch (err) {
    console.error('Policy create error:', err.message);
    res.status(500).json({ error: 'Policy creation failed', detail: err.message });
  }
});

// ── GET ACTIVE POLICY ─────────────────────────────────────
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT p.*,
              ds.name as store_name, ds.risk_score, ds.risk_label,
              ds.city as store_city, ds.lat, ds.lng,
              ds.zone_description, ds.risk_score
       FROM policies p
       JOIN dark_stores ds ON ds.id = p.store_id
       WHERE p.rider_id=$1 AND p.status != 'cancelled'
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [req.rider_id]
    );

    res.json({ policy: result.rows[0] || null });
  } catch (err) {
    console.error('Policy active error:', err.message);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

// ── PAUSE / RESUME ────────────────────────────────────────
router.patch('/toggle-pause', authMiddleware, async (req, res) => {
  try {
    const policy = await req.db.query(
      `SELECT * FROM policies
       WHERE rider_id=$1 AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [req.rider_id]
    );
    if (!policy.rows.length) {
      return res.status(404).json({ error: 'No active policy found' });
    }

    const newStatus = policy.rows[0].status === 'active' ? 'paused' : 'active';
    await req.db.query(
      `UPDATE policies SET status=$1 WHERE id=$2`,
      [newStatus, policy.rows[0].id]
    );
    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Toggle failed' });
  }
});

// ── CANCEL POLICY ─────────────────────────────────────────
router.patch('/cancel', authMiddleware, async (req, res) => {
  try {
    await req.db.query(
      `UPDATE policies SET status='cancelled' WHERE rider_id=$1 AND status != 'cancelled'`,
      [req.rider_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Cancel failed' });
  }
});

function getNextMonday() {
  const d = new Date();
  const diff = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

module.exports = router;
