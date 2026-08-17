-- DarkShield Database Schema
-- Run this on your Railway PostgreSQL instance

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Riders table
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  partner_id VARCHAR(50) UNIQUE NOT NULL,
  platform VARCHAR(20) DEFAULT 'blinkit', -- blinkit | zepto | instamart
  city VARCHAR(50),
  daily_baseline NUMERIC(8,2) DEFAULT 850,
  tenure_months INTEGER DEFAULT 1,
  shift_pattern VARCHAR(20) DEFAULT 'morning', -- morning | evening | both
  gss_score INTEGER DEFAULT 85, -- Genuine Stranding Score
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dark stores table
CREATE TABLE IF NOT EXISTS dark_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  city VARCHAR(50) NOT NULL,
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  risk_score NUMERIC(3,2) DEFAULT 1.0, -- 0.7 to 1.8
  risk_label VARCHAR(10) DEFAULT 'MEDIUM',
  zone_description TEXT,
  elevation_m INTEGER,
  near_water_body BOOLEAN DEFAULT false,
  historical_flood_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID REFERENCES riders(id) ON DELETE CASCADE,
  store_id UUID REFERENCES dark_stores(id),
  status VARCHAR(20) DEFAULT 'active', -- active | paused | cancelled
  weekly_premium NUMERIC(8,2) NOT NULL,
  max_coverage NUMERIC(10,2) NOT NULL,
  start_date DATE DEFAULT CURRENT_DATE,
  next_renewal DATE,
  razorpay_payment_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims table
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID REFERENCES policies(id),
  rider_id UUID REFERENCES riders(id),
  store_id UUID REFERENCES dark_stores(id),
  trigger_type VARCHAR(30) NOT NULL, -- flood | heat | curfew | aqi | closure
  trigger_data JSONB, -- raw API response data
  gss_score INTEGER,
  status VARCHAR(20) DEFAULT 'processing', -- processing | approved | rejected | manual_review
  hours_affected NUMERIC(4,2),
  severity_pct NUMERIC(5,2),
  payout_amount NUMERIC(8,2),
  upi_transaction_id VARCHAR(100),
  razorpay_payout_id VARCHAR(100),
  rejection_reason TEXT,
  auto_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Trigger events log (all external API checks)
CREATE TABLE IF NOT EXISTS trigger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES dark_stores(id),
  trigger_type VARCHAR(30),
  api_source VARCHAR(50),
  raw_value NUMERIC(10,4),
  threshold_value NUMERIC(10,4),
  threshold_breached BOOLEAN DEFAULT false,
  data JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP table (for phone verification)
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(15) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed dark stores
INSERT INTO dark_stores (name, city, lat, lng, risk_score, risk_label, zone_description, elevation_m, near_water_body, historical_flood_count) VALUES
('Koramangala Dark Store', 'Bengaluru', 12.935200, 77.624500, 1.70, 'HIGH', 'Flood-prone low-lying area near storm drain', 893, true, 8),
('Andheri West Store', 'Mumbai', 19.113600, 72.869700, 1.20, 'MEDIUM', 'Coastal humidity zone, moderate risk', 11, false, 3),
('Banjara Hills Store', 'Hyderabad', 17.415600, 78.434700, 0.90, 'LOW', 'Elevated residential zone, historically safe', 542, false, 0),
('Connaught Place Store', 'Delhi', 28.631500, 77.216700, 1.40, 'HIGH', 'Heat-vulnerable central zone, AQI concerns', 216, false, 1),
('Kothrud Store', 'Pune', 18.507400, 73.807700, 0.75, 'LOW', 'Elevated safe residential area', 567, false, 0),
('Whitefield Store', 'Bengaluru', 12.969800, 77.750000, 1.10, 'MEDIUM', 'IT corridor, occasional waterlogging', 899, false, 2),
('Powai Store', 'Mumbai', 19.118400, 72.905900, 1.50, 'HIGH', 'Near Powai lake, flood risk zone', 34, true, 6)
ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_claims_rider ON claims(rider_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_policies_rider ON policies(rider_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_store ON trigger_events(store_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_checked ON trigger_events(checked_at);
