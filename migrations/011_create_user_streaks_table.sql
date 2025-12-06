-- ========================================================
-- 011: USER STREAKS TABLE - DAILY GAMIFICATION SYSTEM
-- ========================================================
-- Created: 2025-01-23
-- Purpose: Track daily streaks and gamification for user retention
-- Expected Impact: +800% retention through FOMO and habit formation
-- ========================================================

-- Drop table if exists (for clean migrations)
DROP TABLE IF EXISTS user_streaks CASCADE;

-- Create user_streaks table
CREATE TABLE user_streaks (
  -- Primary identification
  -- ✅ FIX DIC-06-2025: Removed FK to users table (doesn't exist in Railway PostgreSQL)
  -- Original: user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID PRIMARY KEY,

  -- Streak tracking
  current_streak INT DEFAULT 0 NOT NULL CHECK (current_streak >= 0),
  longest_streak INT DEFAULT 0 NOT NULL CHECK (longest_streak >= 0),
  last_check_in DATE,
  total_check_ins INT DEFAULT 0 NOT NULL CHECK (total_check_ins >= 0),

  -- Gamification elements
  cosmic_points INT DEFAULT 0 NOT NULL CHECK (cosmic_points >= 0),
  badges JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- Milestone tracking (stores which milestones have been achieved)
  milestones_achieved JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance optimization
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_last_check_in ON user_streaks(last_check_in DESC);
CREATE INDEX idx_user_streaks_cosmic_points ON user_streaks(cosmic_points DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before updates
CREATE TRIGGER trigger_update_user_streaks_timestamp
BEFORE UPDATE ON user_streaks
FOR EACH ROW
EXECUTE FUNCTION update_user_streaks_updated_at();

-- Add helpful comments for documentation
COMMENT ON TABLE user_streaks IS 'Tracks daily check-in streaks and gamification rewards for user retention';
COMMENT ON COLUMN user_streaks.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_streaks.current_streak IS 'Current consecutive days streak';
COMMENT ON COLUMN user_streaks.longest_streak IS 'Personal best streak record';
COMMENT ON COLUMN user_streaks.last_check_in IS 'Date of last check-in (UTC date only, no time)';
COMMENT ON COLUMN user_streaks.total_check_ins IS 'Total lifetime check-ins';
COMMENT ON COLUMN user_streaks.cosmic_points IS 'Accumulated gamification points';
COMMENT ON COLUMN user_streaks.badges IS 'Array of earned badge identifiers (JSON array)';
COMMENT ON COLUMN user_streaks.milestones_achieved IS 'Array of milestone streak numbers achieved (JSON array)';

-- Sample data for testing (optional - remove in production)
-- INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_check_in, total_check_ins, cosmic_points, badges)
-- VALUES ('00000000-0000-0000-0000-000000000000', 5, 10, CURRENT_DATE, 25, 250, '["beginner", "week_warrior"]');

-- Grant permissions (adjust based on your database user configuration)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_streaks TO your_app_user;

-- ========================================================
-- MIGRATION COMPLETE
-- ========================================================
