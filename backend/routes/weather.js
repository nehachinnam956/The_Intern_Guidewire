const router = require('express').Router();
const { checkWeatherAtStore, checkAllTriggers } = require('../services/weatherService');

// Check live weather + triggers for a store
router.get('/check/:store_id', async (req, res) => {
  try {
    const store = await req.db.query(`SELECT * FROM dark_stores WHERE id=$1`, [req.params.store_id]);
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });

    const s = store.rows[0];
    const result = await checkAllTriggers(s);

    // Log to DB
    if (result.weather) {
      await req.db.query(
        `INSERT INTO trigger_events (store_id, trigger_type, api_source, raw_value, threshold_value, threshold_breached, data)
         VALUES ($1,'weather','OpenWeatherMap',$2,13.3,$3,$4)`,
        [s.id, result.weather.rain_1h_mm, result.weather.flood_trigger, JSON.stringify(result.weather)]
      );
    }

    res.json({
      store: { id: s.id, name: s.name, city: s.city, lat: s.lat, lng: s.lng },
      weather: result.weather,
      aqi: result.aqi,
      active_triggers: result.active_triggers,
      checked_at: new Date()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Weather check failed', detail: err.message });
  }
});

// Get trigger history for a store
router.get('/history/:store_id', async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT * FROM trigger_events WHERE store_id=$1 ORDER BY checked_at DESC LIMIT 20`,
      [req.params.store_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
