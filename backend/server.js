require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// ── DATABASE ──────────────────────────────────────────────
// rejectUnauthorized: false fixes Railway/Supabase SSL errors
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test DB connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Attach db pool to every request
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// ── ROUTES ────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/stores',  require('./routes/stores'));
app.use('/api/policy',  require('./routes/policy'));
app.use('/api/claims',  require('./routes/claims'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/payment', require('./routes/payment'));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// ── ERROR HANDLER ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 DarkShield backend running on port ${PORT}`);
});

module.exports = { pool };
