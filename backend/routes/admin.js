const router = require('express').Router();

// Admin summary stats
router.get('/stats', async (req, res) => {
  try {
    const [riders, policies, claims, payout] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM riders`),
      req.db.query(`SELECT COUNT(*) as total, status FROM policies GROUP BY status`),
      req.db.query(`SELECT COUNT(*) as total, status FROM claims GROUP BY status`),
      req.db.query(`SELECT COALESCE(SUM(payout_amount),0) as total FROM claims WHERE status='approved'`)
    ]);

    res.json({
      total_riders: parseInt(riders.rows[0].total),
      policies: policies.rows,
      claims: claims.rows,
      total_payout: parseFloat(payout.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats failed', detail: err.message });
  }
});

// Store-wise loss ratios
router.get('/loss-ratios', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT ds.name, ds.city, ds.risk_label,
        COUNT(DISTINCT p.rider_id) as riders,
        COALESCE(SUM(p.weekly_premium),0) as total_premium,
        COALESCE(SUM(c.payout_amount),0) as total_payout,
        COUNT(c.id) as claim_count,
        CASE WHEN SUM(p.weekly_premium) > 0
          THEN ROUND((SUM(c.payout_amount)/SUM(p.weekly_premium))*100,1)
          ELSE 0 END as loss_ratio_pct
      FROM dark_stores ds
      LEFT JOIN policies p ON p.store_id = ds.id
      LEFT JOIN claims c ON c.store_id = ds.id AND c.status='approved'
      GROUP BY ds.id, ds.name, ds.city, ds.risk_label
      ORDER BY loss_ratio_pct DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Loss ratio query failed', detail: err.message });
  }
});

// Fraud queue - claims needing manual review
router.get('/fraud-queue', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT c.*, r.name as rider_name, r.phone, r.partner_id, ds.name as store_name
      FROM claims c
      JOIN riders r ON r.id = c.rider_id
      JOIN dark_stores ds ON ds.id = c.store_id
      WHERE c.status='manual_review' OR (c.gss_score < 70 AND c.status='processing')
      ORDER BY c.created_at DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Fraud queue failed', detail: err.message });
  }
});

// Approve/reject claim manually
router.patch('/claim/:id', async (req, res) => {
  const { status, rejection_reason } = req.body;
  try {
    await req.db.query(
      `UPDATE claims SET status=$1, rejection_reason=$2, resolved_at=NOW() WHERE id=$3`,
      [status, rejection_reason || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Weekly disruption forecast (based on recent trigger events)
router.get('/forecast', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT ds.name, ds.city, ds.risk_label,
        COUNT(te.id) FILTER (WHERE te.threshold_breached=true) as breach_count,
        MAX(te.checked_at) as last_checked
      FROM dark_stores ds
      LEFT JOIN trigger_events te ON te.store_id = ds.id AND te.checked_at > NOW() - INTERVAL '7 days'
      GROUP BY ds.id, ds.name, ds.city, ds.risk_label
      ORDER BY breach_count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Forecast failed', detail: err.message });
  }
});

module.exports = router;
