-- =========================================
-- REVENUE OPTIMIZATION ENGINE TABLES
-- =========================================
-- Supports dynamic pricing, churn prediction,
-- LTV optimization, and pricing experiments
-- =========================================
-- FIXED: 2025-12-04 - Corrected PostgreSQL index syntax

-- Table: users (extended with revenue optimization fields)
-- Add columns to existing users table if they don't exist
DO $$
BEGIN
  -- Add country field if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'country'
  ) THEN
    ALTER TABLE users ADD COLUMN country VARCHAR(2);
  END IF;

  -- Add last_active field if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_active'
  ) THEN
    ALTER TABLE users ADD COLUMN last_active TIMESTAMP DEFAULT NOW();
  END IF;

  -- Add subscription_tier field if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
  END IF;

  -- Add birth_date field if not exists (for birthday offers)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE users ADD COLUMN birth_date DATE;
  END IF;

  -- Add name field if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(100);
  END IF;
END $$;

-- Table: user_analytics (session and engagement tracking)
CREATE TABLE IF NOT EXISTS user_analytics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  session_duration INTEGER, -- in seconds
  feature_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: feature_usage (track specific feature usage)
CREATE TABLE IF NOT EXISTS feature_usage (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: subscriptions (track all subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL, -- cosmic, universe
  amount_paid DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, cancelled, expired
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: user_events (track user behavior events)
CREATE TABLE IF NOT EXISTS user_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- paywall_hit, feature_used, etc.
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: checkout_sessions (track checkout attempts)
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, abandoned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: offers_sent (track all offers sent to users)
CREATE TABLE IF NOT EXISTS offers_sent (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  offer_type VARCHAR(50) NOT NULL, -- first_time_offer, churn_prevention, etc.
  discount INTEGER, -- percentage
  tier VARCHAR(20),
  message TEXT,
  expires_at TIMESTAMP,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: support_tickets (track support interactions)
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: payment_attempts (track payment successes and failures)
CREATE TABLE IF NOT EXISTS payment_attempts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- success, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: churn_interventions (track churn prevention actions)
CREATE TABLE IF NOT EXISTS churn_interventions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  intervention_type VARCHAR(50) NOT NULL, -- aggressive_discount, gentle_reengagement, monitor
  churn_probability DECIMAL(5, 2),
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: ltv_strategies (track LTV optimization strategies)
CREATE TABLE IF NOT EXISTS ltv_strategies (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  strategy_type VARCHAR(50) NOT NULL, -- upgrade_push, retention_focus, etc.
  actions JSONB,
  expected_increase DECIMAL(10, 2),
  actual_increase DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: pricing_experiments (A/B testing for pricing)
CREATE TABLE IF NOT EXISTS pricing_experiments (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(20) NOT NULL,
  price_points JSONB NOT NULL, -- array of price points to test
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
  winner_price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: experiment_assignments (user assignments to price variants)
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  experiment_id INTEGER REFERENCES pricing_experiments(id),
  price_point DECIMAL(10, 2) NOT NULL,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: notifications_sent (track push notifications)
CREATE TABLE IF NOT EXISTS notifications_sent (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  deep_link VARCHAR(500),
  priority VARCHAR(20) DEFAULT 'normal',
  opened BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: support_alerts (alerts for support team)
CREATE TABLE IF NOT EXISTS support_alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- high_churn_risk, payment_failure, etc.
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: revenue_metrics (daily aggregated metrics)
CREATE TABLE IF NOT EXISTS revenue_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0,
  premium_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  new_conversions INTEGER DEFAULT 0,
  churned_users INTEGER DEFAULT 0,
  daily_revenue DECIMAL(10, 2) DEFAULT 0,
  avg_revenue_per_user DECIMAL(10, 2) DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  churn_rate DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================
-- CREATE ALL INDEXES (PostgreSQL syntax)
-- =========================================

-- user_analytics indexes
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_created_at ON user_analytics(created_at);

-- feature_usage indexes
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at ON feature_usage(created_at);

-- subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);

-- user_events indexes
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at);

-- checkout_sessions indexes
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);

-- offers_sent indexes
CREATE INDEX IF NOT EXISTS idx_offers_sent_user_id ON offers_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_sent_type ON offers_sent(offer_type);

-- support_tickets indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- payment_attempts indexes
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);

-- churn_interventions indexes
CREATE INDEX IF NOT EXISTS idx_churn_interventions_user_id ON churn_interventions(user_id);
CREATE INDEX IF NOT EXISTS idx_churn_interventions_type ON churn_interventions(intervention_type);

-- ltv_strategies indexes
CREATE INDEX IF NOT EXISTS idx_ltv_strategies_user_id ON ltv_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_ltv_strategies_type ON ltv_strategies(strategy_type);

-- pricing_experiments indexes
CREATE INDEX IF NOT EXISTS idx_pricing_experiments_tier ON pricing_experiments(tier);
CREATE INDEX IF NOT EXISTS idx_pricing_experiments_status ON pricing_experiments(status);

-- experiment_assignments indexes
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user_id ON experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);

-- notifications_sent indexes
CREATE INDEX IF NOT EXISTS idx_notifications_sent_user_id ON notifications_sent(user_id);

-- support_alerts indexes
CREATE INDEX IF NOT EXISTS idx_support_alerts_user_id ON support_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_support_alerts_type ON support_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_support_alerts_resolved ON support_alerts(resolved);

-- revenue_metrics indexes
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date ON revenue_metrics(date);

-- users table indexes
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- =========================================
-- CREATE FUNCTIONS AND TRIGGERS
-- =========================================

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkout_sessions_updated_at ON checkout_sessions;
CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Revenue Optimization tables created successfully!';
  RAISE NOTICE 'Tables: user_analytics, feature_usage, subscriptions, user_events, checkout_sessions,';
  RAISE NOTICE '        offers_sent, support_tickets, payment_attempts, churn_interventions,';
  RAISE NOTICE '        ltv_strategies, pricing_experiments, experiment_assignments,';
  RAISE NOTICE '        notifications_sent, support_alerts, revenue_metrics';
END $$;
