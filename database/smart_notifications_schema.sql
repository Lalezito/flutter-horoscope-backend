/**
 * ========================================================
 * SMART NOTIFICATION SYSTEM - DATABASE SCHEMA
 * ========================================================
 *
 * Complete database schema for AI-powered notification system
 *
 * Tables:
 * 1. smart_notifications - Sent notifications log
 * 2. scheduled_notifications - Future notifications queue
 * 3. user_notification_preferences - User settings
 * 4. notification_analytics - Performance tracking
 * 5. notification_ab_tests - A/B testing framework
 * 6. notification_templates - Reusable templates
 * 7. user_activity_logs - Behavior tracking
 * 8. notification_campaigns - Bulk campaigns
 *
 * Created: 2025-01-23
 * ========================================================
 */

-- ========================================================
-- 1. SMART NOTIFICATIONS (Sent History)
-- ========================================================
CREATE TABLE IF NOT EXISTS smart_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,

  -- Delivery tracking
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  fcm_message_id VARCHAR(255),
  variant_id VARCHAR(100),

  -- Engagement tracking
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  dismissed_at TIMESTAMP,

  -- Performance metrics
  time_to_open_seconds INTEGER,
  action_taken VARCHAR(100),

  -- Context
  optimal_send_time TIMESTAMP,
  actual_send_time TIMESTAMP,
  send_time_confidence INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for smart_notifications
CREATE INDEX IF NOT EXISTS idx_smart_notif_user_id ON smart_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_notif_type ON smart_notifications(type);
CREATE INDEX IF NOT EXISTS idx_smart_notif_sent_at ON smart_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_notif_opened ON smart_notifications(opened_at) WHERE opened_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smart_notif_variant ON smart_notifications(variant_id) WHERE variant_id IS NOT NULL;

-- ========================================================
-- 2. SCHEDULED NOTIFICATIONS (Future Queue)
-- ========================================================
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  optimal_time_confidence INTEGER,
  variant_id VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, cancelled, failed
  sent_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for scheduled_notifications
CREATE INDEX IF NOT EXISTS idx_sched_notif_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_notif_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_sched_notif_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sched_notif_pending ON scheduled_notifications(scheduled_for, status) WHERE status = 'pending';

-- ========================================================
-- 3. USER NOTIFICATION PREFERENCES
-- ========================================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,

  -- Global settings
  enabled BOOLEAN DEFAULT true,
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  language VARCHAR(10) DEFAULT 'en',

  -- Frequency management
  max_per_day INTEGER DEFAULT 3,
  min_hours_between INTEGER DEFAULT 4,

  -- Quiet hours
  quiet_hours_start INTEGER DEFAULT 23, -- 11 PM
  quiet_hours_end INTEGER DEFAULT 7,    -- 7 AM
  custom_quiet_hours JSONB, -- { start: 22, end: 8 }

  -- Notification type preferences
  disabled_types TEXT[], -- Array of disabled notification types

  -- Type-specific settings
  daily_horoscope_enabled BOOLEAN DEFAULT true,
  daily_horoscope_time TIME DEFAULT '08:00:00',

  streak_protection_enabled BOOLEAN DEFAULT true,
  streak_protection_time TIME DEFAULT '21:00:00',

  prediction_alerts_enabled BOOLEAN DEFAULT true,
  compatibility_updates_enabled BOOLEAN DEFAULT true,
  moon_phase_enabled BOOLEAN DEFAULT true,
  re_engagement_enabled BOOLEAN DEFAULT true,
  premium_offers_enabled BOOLEAN DEFAULT true,

  -- Smart features
  ai_personalization_enabled BOOLEAN DEFAULT true,
  optimal_timing_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notif_pref_user_id ON user_notification_preferences(user_id);

-- ========================================================
-- 4. NOTIFICATION ANALYTICS (Performance Tracking)
-- ========================================================
CREATE TABLE IF NOT EXISTS notification_analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_id BIGINT, -- Reference to smart_notifications
  notification_type VARCHAR(100) NOT NULL,

  -- Event tracking
  event VARCHAR(50) NOT NULL, -- sent, delivered, opened, clicked, dismissed

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Device info
  device_type VARCHAR(50),
  app_version VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for notification_analytics
CREATE INDEX IF NOT EXISTS idx_notif_analytics_user ON notification_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_analytics_type ON notification_analytics(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_analytics_event ON notification_analytics(event);
CREATE INDEX IF NOT EXISTS idx_notif_analytics_created ON notification_analytics(created_at DESC);

-- ========================================================
-- 5. NOTIFICATION A/B TESTS
-- ========================================================
CREATE TABLE IF NOT EXISTS notification_ab_tests (
  id BIGSERIAL PRIMARY KEY,
  notification_type VARCHAR(100) NOT NULL,
  test_name VARCHAR(255) NOT NULL,

  -- Test configuration
  status VARCHAR(50) DEFAULT 'active', -- active, paused, completed
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,

  -- Variants
  variants JSONB NOT NULL, -- Array of variant configurations

  -- Traffic allocation
  traffic_allocation JSONB DEFAULT '{"control": 50, "variant_a": 50}'::jsonb,

  -- Results
  results JSONB DEFAULT '{}'::jsonb,
  winner_variant VARCHAR(100),

  -- Metadata
  hypothesis TEXT,
  success_metric VARCHAR(100) DEFAULT 'open_rate',
  min_sample_size INTEGER DEFAULT 100,
  significance_level DECIMAL(3,2) DEFAULT 0.05,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for A/B tests
CREATE INDEX IF NOT EXISTS idx_ab_test_type ON notification_ab_tests(notification_type);
CREATE INDEX IF NOT EXISTS idx_ab_test_status ON notification_ab_tests(status);

-- ========================================================
-- 6. NOTIFICATION TEMPLATES
-- ========================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id BIGSERIAL PRIMARY KEY,
  notification_type VARCHAR(100) NOT NULL,
  variant_name VARCHAR(100) NOT NULL,
  language VARCHAR(10) DEFAULT 'en',

  -- Template content
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  -- Variables
  required_variables TEXT[], -- Array of required variable names

  -- Metadata
  emoji VARCHAR(10),
  category VARCHAR(100),

  -- Performance
  usage_count INTEGER DEFAULT 0,
  avg_open_rate DECIMAL(5,2),

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_notif_template_type ON notification_templates(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_template_lang ON notification_templates(language);
CREATE INDEX IF NOT EXISTS idx_notif_template_active ON notification_templates(is_active) WHERE is_active = true;

-- ========================================================
-- 7. USER ACTIVITY LOGS (Behavior Tracking)
-- ========================================================
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type VARCHAR(100) NOT NULL, -- app_open, feature_use, check_in, etc.

  -- Activity details
  screen_name VARCHAR(100),
  action_name VARCHAR(100),

  -- Context
  session_id VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Device info
  device_type VARCHAR(50),
  app_version VARCHAR(50),
  platform VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_recent ON user_activity_logs(user_id, created_at DESC);

-- Partitioning by month (optional for large datasets)
-- CREATE TABLE user_activity_logs_2025_01 PARTITION OF user_activity_logs
-- FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ========================================================
-- 8. NOTIFICATION CAMPAIGNS
-- ========================================================
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id BIGSERIAL PRIMARY KEY,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(100) NOT NULL, -- re_engagement, promotion, announcement

  -- Target audience
  target_criteria JSONB NOT NULL, -- Filtering criteria
  estimated_reach INTEGER,

  -- Notification details
  notification_type VARCHAR(100) NOT NULL,
  notification_template_id BIGINT REFERENCES notification_templates(id),

  -- Scheduling
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  send_strategy VARCHAR(50) DEFAULT 'optimal_time', -- immediate, optimal_time, scheduled

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, completed, cancelled

  -- Results
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,

  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaign_status ON notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_type ON notification_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaign_scheduled ON notification_campaigns(scheduled_start) WHERE status = 'scheduled';

-- ========================================================
-- VIEWS FOR ANALYTICS
-- ========================================================

-- Notification performance summary
CREATE OR REPLACE VIEW notification_performance_summary AS
SELECT
  type,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
  ROUND(
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as open_rate,
  ROUND(
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as click_rate,
  ROUND(AVG(time_to_open_seconds), 0) as avg_time_to_open_seconds
FROM smart_notifications
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY total_sent DESC;

-- User engagement scores
CREATE OR REPLACE VIEW user_engagement_scores AS
SELECT
  user_id,
  COUNT(DISTINCT DATE(created_at)) as active_days_30d,
  COUNT(*) as total_notifications_30d,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
  ROUND(
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as personal_open_rate
FROM smart_notifications
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY user_id;

-- ========================================================
-- FUNCTIONS
-- ========================================================

-- Function to update notification engagement
CREATE OR REPLACE FUNCTION update_notification_engagement(
  p_notification_id BIGINT,
  p_event_type VARCHAR,
  p_timestamp TIMESTAMP DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
  IF p_event_type = 'delivered' THEN
    UPDATE smart_notifications SET delivered_at = p_timestamp WHERE id = p_notification_id;
  ELSIF p_event_type = 'opened' THEN
    UPDATE smart_notifications
    SET
      opened_at = p_timestamp,
      time_to_open_seconds = EXTRACT(EPOCH FROM (p_timestamp - sent_at))::INTEGER
    WHERE id = p_notification_id;
  ELSIF p_event_type = 'clicked' THEN
    UPDATE smart_notifications SET clicked_at = p_timestamp WHERE id = p_notification_id;
  ELSIF p_event_type = 'dismissed' THEN
    UPDATE smart_notifications SET dismissed_at = p_timestamp WHERE id = p_notification_id;
  END IF;

  UPDATE smart_notifications SET updated_at = NOW() WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get optimal send time for user
CREATE OR REPLACE FUNCTION get_user_optimal_hours(p_user_id UUID)
RETURNS INTEGER[] AS $$
DECLARE
  optimal_hours INTEGER[];
BEGIN
  SELECT ARRAY_AGG(hour ORDER BY activity_count DESC)
  INTO optimal_hours
  FROM (
    SELECT
      EXTRACT(hour FROM created_at)::INTEGER as hour,
      COUNT(*) as activity_count
    FROM user_activity_logs
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(hour FROM created_at)
    ORDER BY activity_count DESC
    LIMIT 5
  ) subq;

  RETURN COALESCE(optimal_hours, ARRAY[9, 12, 18]);
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- TRIGGERS
-- ========================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_smart_notif_timestamp
  BEFORE UPDATE ON smart_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sched_notif_timestamp
  BEFORE UPDATE ON scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_pref_timestamp
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================================
-- INITIAL DATA
-- ========================================================

-- Insert default templates
INSERT INTO notification_templates (notification_type, variant_name, language, title_template, body_template, required_variables, emoji) VALUES
('daily_horoscope', 'default', 'en', 'Your {sign} Energy Today', '{name}, cosmic opportunities await you today!', ARRAY['sign', 'name'], '🌟'),
('streak_protection', 'default', 'en', 'Don''t Break Your Streak!', '{name}, your {streakDays}-day streak is at risk!', ARRAY['name', 'streakDays'], '🔥'),
('perfect_timing', 'default', 'en', 'Perfect Cosmic Window', '{name}, your energy peaks in 2 hours!', ARRAY['name'], '⚡'),
('daily_horoscope', 'default', 'es', 'Tu Energía {sign} Hoy', '{name}, ¡oportunidades cósmicas te esperan!', ARRAY['sign', 'name'], '🌟'),
('streak_protection', 'default', 'es', '¡No Rompas Tu Racha!', '{name}, ¡tu racha de {streakDays} días está en riesgo!', ARRAY['name', 'streakDays'], '🔥')
ON CONFLICT DO NOTHING;

-- ========================================================
-- MAINTENANCE QUERIES
-- ========================================================

-- Clean up old analytics data (run monthly)
-- DELETE FROM notification_analytics WHERE created_at < NOW() - INTERVAL '90 days';

-- Clean up old activity logs (run monthly)
-- DELETE FROM user_activity_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- ========================================================
-- PERFORMANCE MONITORING
-- ========================================================

-- Query to find slow notifications
-- SELECT type, AVG(time_to_open_seconds) as avg_time, COUNT(*)
-- FROM smart_notifications
-- WHERE opened_at IS NOT NULL
-- GROUP BY type
-- ORDER BY avg_time DESC;

-- Query to find best performing notifications
-- SELECT type, variant_id, COUNT(*) as sent,
--   ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as open_rate
-- FROM smart_notifications
-- WHERE sent_at > NOW() - INTERVAL '7 days'
-- GROUP BY type, variant_id
-- HAVING COUNT(*) > 50
-- ORDER BY open_rate DESC;

COMMENT ON TABLE smart_notifications IS 'Sent notification history with engagement tracking';
COMMENT ON TABLE scheduled_notifications IS 'Queue for future notifications with optimal timing';
COMMENT ON TABLE user_notification_preferences IS 'User-specific notification settings and preferences';
COMMENT ON TABLE notification_analytics IS 'Detailed event tracking for notification performance analysis';
COMMENT ON TABLE notification_ab_tests IS 'A/B testing framework for notification optimization';
COMMENT ON TABLE notification_templates IS 'Reusable notification templates with performance metrics';
COMMENT ON TABLE user_activity_logs IS 'User behavior tracking for intelligent notification timing';
COMMENT ON TABLE notification_campaigns IS 'Bulk notification campaigns with targeting and results';
