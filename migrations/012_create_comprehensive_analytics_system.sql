-- ================================================================================
-- COMPREHENSIVE BUSINESS INTELLIGENCE & ANALYTICS SYSTEM
-- Migration: 012
-- Created: 2025-01-23
-- Purpose: Complete analytics infrastructure for revenue optimization and insights
-- ================================================================================

-- ============================================================================
-- USER ANALYTICS & BEHAVIOR TRACKING
-- ============================================================================

-- Track all user events for behavior analytics
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'app_open', 'feature_used', 'purchase', 'chat_sent', etc.
  event_category VARCHAR(50) NOT NULL, -- 'engagement', 'revenue', 'retention', 'acquisition'
  event_properties JSONB DEFAULT '{}', -- Flexible event data
  device_info JSONB, -- device type, OS, app version
  location_data JSONB, -- country, city, timezone
  session_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  indexed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_events_type ON analytics_events(event_type);
CREATE INDEX idx_events_category ON analytics_events(event_category);
CREATE INDEX idx_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_events_session ON analytics_events(session_id);
CREATE INDEX idx_events_properties ON analytics_events USING GIN(event_properties);

-- ============================================================================
-- REVENUE & SUBSCRIPTION ANALYTICS
-- ============================================================================

-- Track subscription lifecycle
CREATE TABLE IF NOT EXISTS subscription_analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50) NOT NULL, -- 'cosmic', 'stellar'
  subscription_status VARCHAR(50) NOT NULL, -- 'active', 'expired', 'cancelled', 'trial'
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  renewal_date TIMESTAMP,
  price_paid DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  is_trial BOOLEAN DEFAULT FALSE,
  trial_end_date TIMESTAMP,
  cancellation_date TIMESTAMP,
  cancellation_reason TEXT,
  refund_amount DECIMAL(10, 2),
  refund_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  promo_code VARCHAR(50),
  discount_applied DECIMAL(10, 2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscription_user ON subscription_analytics(user_id);
CREATE INDEX idx_subscription_tier ON subscription_analytics(subscription_tier);
CREATE INDEX idx_subscription_status ON subscription_analytics(subscription_status);
CREATE INDEX idx_subscription_dates ON subscription_analytics(start_date, end_date);
CREATE INDEX idx_subscription_renewal ON subscription_analytics(renewal_date) WHERE renewal_date IS NOT NULL;

-- Revenue metrics snapshot (updated daily)
CREATE TABLE IF NOT EXISTS revenue_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  mrr DECIMAL(12, 2) DEFAULT 0, -- Monthly Recurring Revenue
  arr DECIMAL(12, 2) DEFAULT 0, -- Annual Recurring Revenue
  daily_revenue DECIMAL(10, 2) DEFAULT 0,
  new_subscriptions INTEGER DEFAULT 0,
  cancelled_subscriptions INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  trial_subscriptions INTEGER DEFAULT 0,
  cosmic_tier_count INTEGER DEFAULT 0,
  stellar_tier_count INTEGER DEFAULT 0,
  cosmic_tier_revenue DECIMAL(10, 2) DEFAULT 0,
  stellar_tier_revenue DECIMAL(10, 2) DEFAULT 0,
  average_revenue_per_user DECIMAL(10, 2) DEFAULT 0,
  churn_rate DECIMAL(5, 2) DEFAULT 0,
  growth_rate DECIMAL(5, 2) DEFAULT 0,
  refunds_amount DECIMAL(10, 2) DEFAULT 0,
  refunds_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_date)
);

CREATE INDEX idx_revenue_metrics_date ON revenue_metrics(metric_date DESC);

-- ============================================================================
-- USER COHORT ANALYSIS
-- ============================================================================

-- Track user cohorts for retention analysis
CREATE TABLE IF NOT EXISTS user_cohorts (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  cohort_date DATE NOT NULL, -- User signup date (cohort identifier)
  signup_source VARCHAR(100), -- 'organic', 'paid_ad', 'referral', etc.
  signup_country VARCHAR(3),
  signup_language VARCHAR(5),
  initial_device VARCHAR(50),
  zodiac_sign VARCHAR(20),
  age_group VARCHAR(20), -- '18-25', '26-35', etc.
  first_premium_date DATE,
  first_premium_tier VARCHAR(50),
  days_to_premium INTEGER,
  total_sessions INTEGER DEFAULT 0,
  total_events INTEGER DEFAULT 0,
  lifetime_value DECIMAL(10, 2) DEFAULT 0,
  is_churned BOOLEAN DEFAULT FALSE,
  churn_date DATE,
  last_active_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cohorts_user ON user_cohorts(user_id);
CREATE INDEX idx_cohorts_date ON user_cohorts(cohort_date);
CREATE INDEX idx_cohorts_source ON user_cohorts(signup_source);
CREATE INDEX idx_cohorts_country ON user_cohorts(signup_country);
CREATE INDEX idx_cohorts_sign ON user_cohorts(zodiac_sign);
CREATE INDEX idx_cohorts_churned ON user_cohorts(is_churned, churn_date);

-- Cohort retention metrics (calculated periodically)
CREATE TABLE IF NOT EXISTS cohort_retention_metrics (
  id SERIAL PRIMARY KEY,
  cohort_date DATE NOT NULL,
  period_number INTEGER NOT NULL, -- 0 = day 0, 1 = day 1, 7 = week 1, 30 = month 1, etc.
  period_type VARCHAR(20) NOT NULL, -- 'day', 'week', 'month'
  cohort_size INTEGER NOT NULL,
  retained_users INTEGER NOT NULL,
  retention_rate DECIMAL(5, 2) NOT NULL,
  revenue_generated DECIMAL(10, 2) DEFAULT 0,
  average_ltv DECIMAL(10, 2) DEFAULT 0,
  premium_conversion_rate DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cohort_date, period_number, period_type)
);

CREATE INDEX idx_retention_cohort ON cohort_retention_metrics(cohort_date);
CREATE INDEX idx_retention_period ON cohort_retention_metrics(period_number, period_type);

-- ============================================================================
-- FEATURE USAGE ANALYTICS
-- ============================================================================

-- Track feature usage and engagement
CREATE TABLE IF NOT EXISTS feature_usage_analytics (
  id BIGSERIAL PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL, -- 'daily_horoscope', 'compatibility', 'cosmic_coach', etc.
  feature_category VARCHAR(50) NOT NULL, -- 'core', 'premium', 'social'
  usage_date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  premium_users INTEGER DEFAULT 0,
  free_users INTEGER DEFAULT 0,
  total_usages INTEGER DEFAULT 0,
  average_usage_per_user DECIMAL(10, 2) DEFAULT 0,
  engagement_time_seconds BIGINT DEFAULT 0,
  conversion_events INTEGER DEFAULT 0, -- How many premium conversions attributed
  revenue_attributed DECIMAL(10, 2) DEFAULT 0,
  satisfaction_score DECIMAL(3, 2), -- 0-5 rating
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feature_name, usage_date)
);

CREATE INDEX idx_feature_usage_name ON feature_usage_analytics(feature_name);
CREATE INDEX idx_feature_usage_date ON feature_usage_analytics(usage_date DESC);
CREATE INDEX idx_feature_usage_category ON feature_usage_analytics(feature_category);

-- ============================================================================
-- A/B TESTING FRAMEWORK
-- ============================================================================

-- A/B test experiments
CREATE TABLE IF NOT EXISTS ab_test_experiments (
  id SERIAL PRIMARY KEY,
  experiment_name VARCHAR(100) NOT NULL UNIQUE,
  experiment_description TEXT,
  experiment_type VARCHAR(50) NOT NULL, -- 'paywall', 'pricing', 'feature', 'ui', etc.
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'cancelled'
  control_variant VARCHAR(50) DEFAULT 'control',
  test_variants JSONB NOT NULL, -- Array of variant names
  allocation_method VARCHAR(50) DEFAULT 'random', -- 'random', 'user_id_hash', 'country'
  target_metric VARCHAR(100) NOT NULL, -- 'conversion_rate', 'revenue_per_user', etc.
  success_criteria JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- A/B test assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id BIGSERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES ab_test_experiments(id),
  user_id VARCHAR(255) NOT NULL,
  variant VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(experiment_id, user_id)
);

CREATE INDEX idx_ab_assignments_experiment ON ab_test_assignments(experiment_id);
CREATE INDEX idx_ab_assignments_user ON ab_test_assignments(user_id);
CREATE INDEX idx_ab_assignments_variant ON ab_test_assignments(experiment_id, variant);

-- A/B test results
CREATE TABLE IF NOT EXISTS ab_test_results (
  id BIGSERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES ab_test_experiments(id),
  variant VARCHAR(50) NOT NULL,
  result_date DATE NOT NULL,
  users_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  revenue_per_user DECIMAL(10, 2) DEFAULT 0,
  engagement_score DECIMAL(10, 2) DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(experiment_id, variant, result_date)
);

CREATE INDEX idx_ab_results_experiment ON ab_test_results(experiment_id);
CREATE INDEX idx_ab_results_variant ON ab_test_results(experiment_id, variant);
CREATE INDEX idx_ab_results_date ON ab_test_results(result_date DESC);

-- ============================================================================
-- INSIGHTS & ALERTS
-- ============================================================================

-- Automated insights generated by the system
CREATE TABLE IF NOT EXISTS analytics_insights (
  id SERIAL PRIMARY KEY,
  insight_type VARCHAR(50) NOT NULL, -- 'opportunity', 'warning', 'trend', 'anomaly'
  category VARCHAR(50) NOT NULL, -- 'revenue', 'retention', 'engagement', 'conversion'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  expected_impact VARCHAR(100), -- "+$2,340/month", "+15% retention", etc.
  effort_level VARCHAR(20), -- 'low', 'medium', 'high'
  metrics JSONB,
  is_actionable BOOLEAN DEFAULT TRUE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_insights_type ON analytics_insights(insight_type);
CREATE INDEX idx_insights_category ON analytics_insights(category);
CREATE INDEX idx_insights_severity ON analytics_insights(severity);
CREATE INDEX idx_insights_created ON analytics_insights(created_at DESC);
CREATE INDEX idx_insights_actionable ON analytics_insights(is_actionable) WHERE is_actionable = TRUE;

-- Automated alerts for anomalies
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL, -- 'churn_spike', 'revenue_drop', 'error_rate', etc.
  severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  current_value DECIMAL(15, 2),
  expected_value DECIMAL(15, 2),
  threshold_value DECIMAL(15, 2),
  affected_users INTEGER,
  revenue_at_risk DECIMAL(10, 2),
  notification_sent BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_type ON analytics_alerts(alert_type);
CREATE INDEX idx_alerts_severity ON analytics_alerts(severity);
CREATE INDEX idx_alerts_created ON analytics_alerts(created_at DESC);
CREATE INDEX idx_alerts_unresolved ON analytics_alerts(resolved) WHERE resolved = FALSE;

-- ============================================================================
-- PREDICTIVE ANALYTICS
-- ============================================================================

-- Revenue predictions
CREATE TABLE IF NOT EXISTS revenue_predictions (
  id SERIAL PRIMARY KEY,
  prediction_date DATE NOT NULL,
  prediction_type VARCHAR(50) NOT NULL, -- 'conservative', 'realistic', 'optimistic'
  horizon VARCHAR(20) NOT NULL, -- '1_month', '3_months', '6_months', '1_year'
  predicted_mrr DECIMAL(12, 2),
  predicted_arr DECIMAL(12, 2),
  predicted_users INTEGER,
  predicted_conversions INTEGER,
  confidence_level DECIMAL(5, 2), -- 0-100%
  assumptions JSONB,
  factors JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(prediction_date, prediction_type, horizon)
);

CREATE INDEX idx_predictions_date ON revenue_predictions(prediction_date DESC);
CREATE INDEX idx_predictions_type ON revenue_predictions(prediction_type);

-- User churn predictions
CREATE TABLE IF NOT EXISTS churn_predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  prediction_date DATE NOT NULL,
  churn_probability DECIMAL(5, 2) NOT NULL, -- 0-100%
  risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  churn_drivers JSONB, -- Factors contributing to churn risk
  recommended_actions JSONB, -- Retention tactics
  revenue_at_risk DECIMAL(10, 2),
  last_activity_date TIMESTAMP,
  engagement_score DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, prediction_date)
);

CREATE INDEX idx_churn_user ON churn_predictions(user_id);
CREATE INDEX idx_churn_risk ON churn_predictions(risk_level, churn_probability DESC);
CREATE INDEX idx_churn_date ON churn_predictions(prediction_date DESC);

-- ============================================================================
-- GEOGRAPHIC & DEMOGRAPHIC ANALYTICS
-- ============================================================================

-- Geographic performance metrics
CREATE TABLE IF NOT EXISTS geographic_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  country_code VARCHAR(3) NOT NULL,
  region VARCHAR(100),
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  premium_users INTEGER DEFAULT 0,
  new_signups INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  average_ltv DECIMAL(10, 2) DEFAULT 0,
  churn_rate DECIMAL(5, 2) DEFAULT 0,
  top_features JSONB,
  language_distribution JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_date, country_code)
);

CREATE INDEX idx_geo_date ON geographic_metrics(metric_date DESC);
CREATE INDEX idx_geo_country ON geographic_metrics(country_code);
CREATE INDEX idx_geo_revenue ON geographic_metrics(revenue DESC);

-- ============================================================================
-- DASHBOARD CACHE TABLES
-- ============================================================================

-- Cache real-time dashboard metrics (refreshed every 5 minutes)
CREATE TABLE IF NOT EXISTS dashboard_realtime_cache (
  id SERIAL PRIMARY KEY,
  metric_key VARCHAR(100) NOT NULL UNIQUE,
  metric_value JSONB NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_dashboard_cache_key ON dashboard_realtime_cache(metric_key);
CREATE INDEX idx_dashboard_cache_expires ON dashboard_realtime_cache(expires_at);

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE analytics_events IS 'Track all user events for comprehensive behavior analytics';
COMMENT ON TABLE subscription_analytics IS 'Complete subscription lifecycle tracking for revenue analysis';
COMMENT ON TABLE revenue_metrics IS 'Daily snapshot of revenue metrics (MRR, ARR, churn, etc.)';
COMMENT ON TABLE user_cohorts IS 'User cohort definitions for retention and LTV analysis';
COMMENT ON TABLE cohort_retention_metrics IS 'Calculated retention rates by cohort and time period';
COMMENT ON TABLE feature_usage_analytics IS 'Track feature engagement and revenue attribution';
COMMENT ON TABLE ab_test_experiments IS 'A/B test experiment definitions and configuration';
COMMENT ON TABLE ab_test_assignments IS 'User assignments to A/B test variants';
COMMENT ON TABLE ab_test_results IS 'A/B test results and performance metrics';
COMMENT ON TABLE analytics_insights IS 'Automated insights and recommendations';
COMMENT ON TABLE analytics_alerts IS 'System alerts for anomalies and critical events';
COMMENT ON TABLE revenue_predictions IS 'Revenue forecasting and predictions';
COMMENT ON TABLE churn_predictions IS 'User churn risk predictions and retention recommendations';
COMMENT ON TABLE geographic_metrics IS 'Geographic performance and user distribution metrics';
COMMENT ON TABLE dashboard_realtime_cache IS 'Cached real-time metrics for dashboard performance';

-- ============================================================================
-- INITIAL DATA & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_subscription_analytics_updated_at
  BEFORE UPDATE ON subscription_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_cohorts_updated_at
  BEFORE UPDATE ON user_cohorts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_test_experiments_updated_at
  BEFORE UPDATE ON ab_test_experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
