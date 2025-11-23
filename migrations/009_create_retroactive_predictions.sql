-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🔮 RETROACTIVE PREDICTIONS SYSTEM ("I Told You So" Feature)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration: Create tables for retroactive prediction tracking
-- Created: 2025-01-20
-- Description: Automatically extracts predictions from AI responses,
--              tracks outcomes, and celebrates hits with users
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Main predictions tracking table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  prediction_text TEXT NOT NULL,
  predicted_for_date DATE NOT NULL,
  predicted_for_time_window VARCHAR(20), -- '10:00-12:00', 'morning', 'afternoon', etc.
  focus_area VARCHAR(50), -- 'love', 'career', 'money', 'health', 'communication'
  prediction_made_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_feedback VARCHAR(20), -- 'hit', 'miss', 'partial', 'pending'
  feedback_given_at TIMESTAMP WITH TIME ZONE,
  accuracy_score INT CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User prediction analytics table
CREATE TABLE IF NOT EXISTS user_prediction_analytics (
  user_id VARCHAR(255) PRIMARY KEY,
  total_predictions INT DEFAULT 0,
  total_hits INT DEFAULT 0,
  total_misses INT DEFAULT 0,
  total_partial INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  monthly_accuracy DECIMAL(5,2) DEFAULT 0.00,
  all_time_accuracy DECIMAL(5,2) DEFAULT 0.00,
  last_prediction_at TIMESTAMP WITH TIME ZONE,
  last_feedback_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prediction templates for pattern matching
CREATE TABLE IF NOT EXISTS prediction_templates (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_content TEXT NOT NULL,
  pattern_regex TEXT,
  confidence_multiplier DECIMAL(3,2) DEFAULT 1.00,
  specificity_level VARCHAR(20) DEFAULT 'medium',
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  usage_count INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prediction categories configuration
CREATE TABLE IF NOT EXISTS prediction_categories (
  category_name VARCHAR(50) PRIMARY KEY,
  description TEXT,
  premium_only BOOLEAN DEFAULT FALSE,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.30,
  max_daily_predictions INT DEFAULT 3,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User birth data for personalized predictions
CREATE TABLE IF NOT EXISTS user_birth_data (
  user_id VARCHAR(255) PRIMARY KEY,
  birth_date DATE NOT NULL,
  birth_time TIME,
  birth_location VARCHAR(255),
  timezone VARCHAR(50),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  birth_chart_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prediction generation log for monitoring
CREATE TABLE IF NOT EXISTS prediction_generation_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  generation_trigger VARCHAR(50), -- 'api_request', 'scheduled', 'manual'
  prediction_id UUID REFERENCES predictions(id) ON DELETE SET NULL,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR PERFORMANCE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_predictions_date
  ON predictions(predicted_for_date);

CREATE INDEX IF NOT EXISTS idx_predictions_feedback
  ON predictions(user_feedback);

-- Pending predictions (most common query)
CREATE INDEX IF NOT EXISTS idx_predictions_pending
  ON predictions(user_id, predicted_for_date, user_feedback)
  WHERE user_feedback IS NULL OR user_feedback = 'pending';

-- Yesterday's predictions for feedback requests
CREATE INDEX IF NOT EXISTS idx_predictions_yesterday
  ON predictions(user_id, predicted_for_date)
  WHERE predicted_for_date = CURRENT_DATE - INTERVAL '1 day';

-- Active predictions by focus area
CREATE INDEX IF NOT EXISTS idx_predictions_focus_area
  ON predictions(focus_area, created_at DESC);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_id
  ON user_prediction_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_accuracy
  ON user_prediction_analytics(monthly_accuracy DESC);

-- Template indexes
CREATE INDEX IF NOT EXISTS idx_templates_category
  ON prediction_templates(category, active);

CREATE INDEX IF NOT EXISTS idx_templates_success_rate
  ON prediction_templates(success_rate DESC);

-- Generation log indexes
CREATE INDEX IF NOT EXISTS idx_generation_log_user
  ON prediction_generation_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_log_success
  ON prediction_generation_log(success);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VIEWS FOR COMMON QUERIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Active predictions awaiting feedback
CREATE OR REPLACE VIEW v_pending_feedback AS
SELECT
  p.id,
  p.user_id,
  p.prediction_text,
  p.predicted_for_date,
  p.predicted_for_time_window,
  p.focus_area,
  p.prediction_made_at,
  EXTRACT(DAYS FROM NOW() - p.predicted_for_date) as days_since_prediction
FROM predictions p
WHERE p.user_feedback IS NULL
  AND p.predicted_for_date < CURRENT_DATE
ORDER BY p.predicted_for_date DESC, p.created_at DESC;

-- User accuracy leaderboard
CREATE OR REPLACE VIEW v_accuracy_leaderboard AS
SELECT
  a.user_id,
  a.total_predictions,
  a.total_hits,
  a.monthly_accuracy,
  a.current_streak,
  a.longest_streak,
  RANK() OVER (ORDER BY a.monthly_accuracy DESC, a.total_hits DESC) as rank
FROM user_prediction_analytics a
WHERE a.total_predictions >= 5
ORDER BY a.monthly_accuracy DESC
LIMIT 100;

-- Recent prediction activity
CREATE OR REPLACE VIEW v_recent_predictions AS
SELECT
  p.id,
  p.user_id,
  p.prediction_text,
  p.predicted_for_date,
  p.focus_area,
  p.user_feedback,
  p.accuracy_score,
  p.created_at
FROM predictions p
WHERE p.created_at > NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGERS AND FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at
  BEFORE UPDATE ON user_prediction_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON prediction_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_birth_data_updated_at
  BEFORE UPDATE ON user_birth_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update analytics when prediction feedback is given
CREATE OR REPLACE FUNCTION update_prediction_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_is_hit BOOLEAN;
  v_consecutive_hits INT;
BEGIN
  -- Only process when feedback is added
  IF NEW.user_feedback IS NOT NULL AND (OLD.user_feedback IS NULL OR OLD.user_feedback = 'pending') THEN

    v_is_hit := (NEW.user_feedback = 'hit');

    -- Insert or update analytics
    INSERT INTO user_prediction_analytics (
      user_id,
      total_predictions,
      total_hits,
      total_misses,
      total_partial,
      last_feedback_at
    ) VALUES (
      NEW.user_id,
      1,
      CASE WHEN v_is_hit THEN 1 ELSE 0 END,
      CASE WHEN NEW.user_feedback = 'miss' THEN 1 ELSE 0 END,
      CASE WHEN NEW.user_feedback = 'partial' THEN 1 ELSE 0 END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_predictions = user_prediction_analytics.total_predictions + 1,
      total_hits = user_prediction_analytics.total_hits + CASE WHEN v_is_hit THEN 1 ELSE 0 END,
      total_misses = user_prediction_analytics.total_misses + CASE WHEN NEW.user_feedback = 'miss' THEN 1 ELSE 0 END,
      total_partial = user_prediction_analytics.total_partial + CASE WHEN NEW.user_feedback = 'partial' THEN 1 ELSE 0 END,
      last_feedback_at = NOW();

    -- Calculate streak
    IF v_is_hit THEN
      -- Count consecutive hits
      SELECT COALESCE(COUNT(*), 0) INTO v_consecutive_hits
      FROM (
        SELECT user_feedback
        FROM predictions
        WHERE user_id = NEW.user_id
          AND user_feedback IS NOT NULL
          AND feedback_given_at <= NEW.feedback_given_at
        ORDER BY feedback_given_at DESC
        LIMIT 100
      ) recent
      WHERE user_feedback = 'hit'
        AND NOT EXISTS (
          SELECT 1 FROM predictions p2
          WHERE p2.user_id = NEW.user_id
            AND p2.user_feedback != 'hit'
            AND p2.feedback_given_at > recent.feedback_given_at
            AND p2.feedback_given_at <= NEW.feedback_given_at
        );

      UPDATE user_prediction_analytics
      SET
        current_streak = v_consecutive_hits,
        longest_streak = GREATEST(longest_streak, v_consecutive_hits)
      WHERE user_id = NEW.user_id;
    ELSE
      -- Reset streak on miss
      UPDATE user_prediction_analytics
      SET current_streak = 0
      WHERE user_id = NEW.user_id;
    END IF;

    -- Calculate accuracies
    UPDATE user_prediction_analytics a
    SET
      monthly_accuracy = (
        SELECT COALESCE(ROUND(
          100.0 * COUNT(*) FILTER (WHERE user_feedback = 'hit') /
          NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0)
        , 2), 0)
        FROM predictions
        WHERE user_id = NEW.user_id
          AND prediction_made_at > NOW() - INTERVAL '30 days'
      ),
      all_time_accuracy = (
        SELECT COALESCE(ROUND(
          100.0 * a.total_hits / NULLIF(a.total_predictions, 0)
        , 2), 0)
      )
    WHERE a.user_id = NEW.user_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_prediction_analytics
  AFTER UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_prediction_analytics();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SEED DATA
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Insert prediction categories
INSERT INTO prediction_categories (category_name, description, premium_only, confidence_threshold) VALUES
  ('love', 'Romantic and relationship predictions', FALSE, 0.30),
  ('career', 'Professional and work-related predictions', FALSE, 0.30),
  ('finance', 'Money and resource predictions', TRUE, 0.35),
  ('health', 'Wellness and vitality predictions', FALSE, 0.25),
  ('social', 'Social connections and friendships', FALSE, 0.30),
  ('travel', 'Movement and journey predictions', TRUE, 0.40),
  ('general', 'General life event predictions', FALSE, 0.20)
ON CONFLICT (category_name) DO NOTHING;

-- Insert default prediction templates
INSERT INTO prediction_templates (category, template_name, template_content, specificity_level, active) VALUES
  ('love', 'romantic_encounter', 'You will have an unexpected romantic encounter {timeframe}. Pay attention to {context}.', 'high', TRUE),
  ('love', 'relationship_deepening', 'Your relationship will deepen through meaningful communication {timeframe}.', 'medium', TRUE),
  ('career', 'professional_opportunity', 'A professional opportunity will present itself {timeframe}, particularly around {context}.', 'high', TRUE),
  ('career', 'recognition_achievement', 'You will receive recognition for your recent efforts {timeframe}.', 'medium', TRUE),
  ('finance', 'financial_opportunity', 'An unexpected financial opportunity will arise {timeframe}.', 'high', TRUE),
  ('social', 'new_connection', 'You will make a meaningful new connection {timeframe}.', 'medium', TRUE),
  ('general', 'positive_surprise', 'A pleasant surprise will come your way {timeframe}.', 'low', TRUE)
ON CONFLICT DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- HELPER FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Get user's pending predictions for yesterday
CREATE OR REPLACE FUNCTION get_yesterday_predictions(p_user_id VARCHAR(255))
RETURNS TABLE (
  id UUID,
  prediction_text TEXT,
  predicted_for_time_window VARCHAR(20),
  focus_area VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.prediction_text,
    p.predicted_for_time_window,
    p.focus_area
  FROM predictions p
  WHERE p.user_id = p_user_id
    AND p.predicted_for_date = CURRENT_DATE - INTERVAL '1 day'
    AND (p.user_feedback IS NULL OR p.user_feedback = 'pending')
  ORDER BY p.created_at DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Get user accuracy statistics
CREATE OR REPLACE FUNCTION get_user_accuracy_stats(p_user_id VARCHAR(255))
RETURNS TABLE (
  total_predictions INT,
  total_checked INT,
  hits INT,
  misses INT,
  monthly_accuracy DECIMAL,
  streak INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.total_predictions,
    a.total_hits + a.total_misses + a.total_partial as total_checked,
    a.total_hits as hits,
    a.total_misses as misses,
    a.monthly_accuracy,
    a.current_streak as streak
  FROM user_prediction_analytics a
  WHERE a.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- COMMENTS FOR DOCUMENTATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE predictions IS 'Stores predictions extracted from AI coach responses with retroactive verification';
COMMENT ON TABLE user_prediction_analytics IS 'Tracks user prediction accuracy, streaks, and performance metrics';
COMMENT ON TABLE prediction_templates IS 'Templates for generating and validating predictions';
COMMENT ON TABLE prediction_categories IS 'Configuration for prediction categories and premium requirements';
COMMENT ON TABLE user_birth_data IS 'User birth information for personalized astrological predictions';

COMMENT ON VIEW v_pending_feedback IS 'Predictions awaiting user feedback verification';
COMMENT ON VIEW v_accuracy_leaderboard IS 'Top users by prediction accuracy';
COMMENT ON VIEW v_recent_predictions IS 'Recent prediction activity across all users';

-- Verification query
SELECT
  'Migration completed successfully!' as status,
  COUNT(*) as tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('predictions', 'user_prediction_analytics', 'prediction_templates', 'prediction_categories', 'user_birth_data', 'prediction_generation_log');
