const router = require('express').Router();
const jwt = require('jsonwebtoken');

// In-memory OTP store (fine for demo/hackathon)
const otpStore = {};

// ── SEND OTP ──────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Enter valid 10-digit phone number' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { code, expires: Date.now() + 10 * 60 * 1000 };
  console.log(`📱 OTP for ${phone}: ${code}`);

  // Try Twilio if configured
  if (process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
      process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_sid') {
    try {
      const twilio = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      await twilio.messages.create({
        body: `Your DarkShield OTP is: ${code}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE,
        to: `+91${phone}`,
      });
      return res.json({ success: true, message: 'OTP sent via SMS' });
    } catch (e) {
      console.log('Twilio failed, falling back to demo:', e.message);
    }
  }

  // Demo mode — return OTP in response
  return res.json({ success: true, demo_otp: code, message: 'Demo mode — OTP shown above' });
});

// ── VERIFY OTP ────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  const stored = otpStore[phone];

  if (!stored) {
    return res.status(400).json({ error: 'No OTP found. Click Send OTP first.' });
  }
  if (Date.now() > stored.expires) {
    delete otpStore[phone];
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }
  if (stored.code !== String(code)) {
    return res.status(400).json({ error: 'Wrong OTP. Check the orange box.' });
  }

  delete otpStore[phone];
  return res.json({ success: true, verified: true });
});

// ── REGISTER ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, phone, partner_id, city, tenure_months, shift_pattern, platform } = req.body;

  if (!name || !phone || !partner_id) {
    return res.status(400).json({ error: 'name, phone, and partner_id are required' });
  }

  try {
    // Check if rider already exists
    const existing = await req.db.query(
      `SELECT * FROM riders WHERE phone=$1 OR partner_id=$2`,
      [phone, partner_id]
    );

    if (existing.rows.length) {
      const rider = existing.rows[0];
      const token = jwt.sign(
        { rider_id: rider.id },
        process.env.JWT_SECRET || 'darkshield_secret_2026',
        { expiresIn: '30d' }
      );
      return res.json({ success: true, token, rider, existing: true });
    }

    // Create new rider
    const result = await req.db.query(
      `INSERT INTO riders (name, phone, partner_id, city, tenure_months, shift_pattern, platform, daily_baseline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        name, phone, partner_id,
        city || 'Bengaluru',
        tenure_months || 1,
        shift_pattern || 'morning',
        platform || 'blinkit',
        850,
      ]
    );

    const rider = result.rows[0];
    const token = jwt.sign(
      { rider_id: rider.id },
      process.env.JWT_SECRET || 'darkshield_secret_2026',
      { expiresIn: '30d' }
    );

    return res.json({ success: true, token, rider });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// ── GET PROFILE ───────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT r.*,
              p.id as policy_id, p.status as policy_status,
              p.weekly_premium, p.max_coverage,
              ds.name as store_name, ds.risk_score,
              ds.risk_label, ds.city as store_city
       FROM riders r
       LEFT JOIN policies p ON p.rider_id = r.id AND p.status != 'cancelled'
       LEFT JOIN dark_stores ds ON ds.id = p.store_id
       WHERE r.id = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [req.rider_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Rider not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── AUTH MIDDLEWARE ───────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'darkshield_secret_2026');
    req.rider_id = decoded.rider_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
