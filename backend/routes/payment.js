const router = require('express').Router();
const { authMiddleware } = require('./auth');

// ── CREATE ORDER ──────────────────────────────────────────
router.post('/create-order', authMiddleware, async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount required' });
  }

  // Demo mode — no real Razorpay key
  if (!process.env.RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID === 'your_razorpay_key_id') {
    return res.json({
      demo: true,
      order_id: `demo_order_${Date.now()}`,
      amount: amount * 100,
      currency: 'INR',
      key: 'demo_key',
      message: 'Demo mode: Payment simulated successfully',
    });
  }

  // Real Razorpay
  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `ds_${Date.now()}`,
      notes: { rider_id: req.rider_id },
    });

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay error:', err.message);
    res.status(500).json({ error: 'Payment order failed', detail: err.message });
  }
});

// ── VERIFY PAYMENT ────────────────────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Demo mode
  if (!process.env.RAZORPAY_KEY_SECRET ||
      process.env.RAZORPAY_KEY_SECRET === 'your_razorpay_key_secret') {
    return res.json({
      success: true,
      demo: true,
      payment_id: razorpay_payment_id || `demo_pay_${Date.now()}`,
    });
  }

  // Real verification
  try {
    const crypto = require('crypto');
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    res.json({ success: true, payment_id: razorpay_payment_id });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed', detail: err.message });
  }
});

module.exports = router;
