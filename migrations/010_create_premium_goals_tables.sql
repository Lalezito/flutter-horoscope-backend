-- 🎯 PREMIUM GOALS SYSTEM TABLES
-- Purpose: Store AI-generated SMART goals and user progress tracking
-- Created: October 7, 2025
-- Feature: Goal Planner for Stellar tier users

-- Drop tables if they exist (for clean recreation)
DROP TABLE IF EXISTS goal_check_ins CASCADE;
DROP TABLE IF EXISTS premium_goals CASCADE;

-- ========================================
-- PREMIUM_GOALS TABLE
-- ========================================
-- Stores AI-generated SMART goals for premium users

CREATE TABLE premium_goals (
  id SERIAL PRIMARY KEY,
  goal_id UUID UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  zodiac_sign VARCHAR(20) NOT NULL,
  focus_area VARCHAR(50) NOT NULL, -- 'career', 'relationships', 'wellness', 'personal_growth'
  objective TEXT NOT NULL,

  -- AI-generated goal structure (stored as JSON)
  main_goal JSONB NOT NULL,
  weekly_focus JSONB NOT NULL,
  micro_habits JSONB NOT NULL,
  success_indicators JSONB NOT NULL,
  potential_obstacles JSONB NOT NULL,
  motivational_message TEXT,

  -- Goal metadata
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT goals_status_check CHECK (status IN ('active', 'completed', 'archived')),
  CONSTRAINT goals_focus_area_check CHECK (focus_area IN ('career', 'relationships', 'wellness', 'personal_growth'))
);

-- Create indices for performance
CREATE INDEX idx_premium_goals_user_id ON premium_goals(user_id);
CREATE INDEX idx_premium_goals_goal_id ON premium_goals(goal_id);
CREATE INDEX idx_premium_goals_status ON premium_goals(status);
CREATE INDEX idx_premium_goals_focus_area ON premium_goals(focus_area);
CREATE INDEX idx_premium_goals_created_at ON premium_goals(created_at);

-- Create GIN index for JSON fields (fast JSON queries)
CREATE INDEX idx_premium_goals_main_goal ON premium_goals USING GIN (main_goal);
CREATE INDEX idx_premium_goals_micro_habits ON premium_goals USING GIN (micro_habits);

-- ========================================
-- GOAL_CHECK_INS TABLE
-- ========================================
-- Stores daily/weekly check-ins for goal progress tracking

CREATE TABLE goal_check_ins (
  id SERIAL PRIMARY KEY,
  goal_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Check-in data
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100), -- 0-100%
  feedback TEXT,
  mood VARCHAR(50), -- 'motivated', 'challenged', 'confident', 'struggling', etc.

  -- Timestamps
  check_in_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key
  CONSTRAINT fk_goal_check_ins_goal FOREIGN KEY (goal_id) REFERENCES premium_goals(goal_id) ON DELETE CASCADE
);

-- Create indices for performance
CREATE INDEX idx_goal_check_ins_goal_id ON goal_check_ins(goal_id);
CREATE INDEX idx_goal_check_ins_user_id ON goal_check_ins(user_id);
CREATE INDEX idx_goal_check_ins_date ON goal_check_ins(check_in_date);

-- ========================================
-- TRIGGERS
-- ========================================

-- Auto-update updated_at timestamp on premium_goals
CREATE OR REPLACE FUNCTION update_premium_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;

  -- Auto-set completed_at when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_premium_goals_updated_at
  BEFORE UPDATE ON premium_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_premium_goals_updated_at();

-- ========================================
-- SAMPLE DATA (for testing)
-- ========================================

-- Insert a sample goal for testing
INSERT INTO premium_goals (
  goal_id,
  user_id,
  zodiac_sign,
  focus_area,
  objective,
  main_goal,
  weekly_focus,
  micro_habits,
  success_indicators,
  potential_obstacles,
  motivational_message,
  status
) VALUES (
  gen_random_uuid(),
  'test_user_123',
  'aries',
  'career',
  'Advance my career and develop leadership skills',
  '{"title": "Become a team lead within 6 months", "why": "To make a greater impact and develop my leadership potential", "specific": "Lead a cross-functional project team", "measurable": "Successfully deliver 2 major projects", "achievable": "Leverage my initiative and action-oriented nature", "relevant": "Aligns with career growth and personal development", "timeBound": "Within 6 months from today"}'::jsonb,
  '{"theme": "Building confidence and visibility", "keyActions": ["Present in team meetings", "Volunteer for leadership opportunities", "Network with senior leaders"], "astroTiming": "Tuesday and Thursday are optimal for bold career moves this week"}'::jsonb,
  '[{"habit": "Start each day reviewing top 3 priorities", "when": "First thing every morning", "why": "Builds focus and leadership clarity", "difficulty": "easy"}, {"habit": "Share one win or learning with the team", "when": "End of each workday", "why": "Increases visibility and builds leadership presence", "difficulty": "medium"}]'::jsonb,
  '["Successfully led at least one team meeting", "Received positive feedback from manager", "Completed leadership training module"]'::jsonb,
  '[{"obstacle": "Impatience with slow team progress", "solution": "Practice active listening and allow others to contribute"}]'::jsonb,
  'Your Aries energy is perfect for leadership. Channel your natural initiative into inspiring others!',
  'active'
);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify tables created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('premium_goals', 'goal_check_ins')
ORDER BY table_name, ordinal_position;

-- Count records
SELECT 'premium_goals' as table_name, COUNT(*) as record_count FROM premium_goals
UNION ALL
SELECT 'goal_check_ins' as table_name, COUNT(*) as record_count FROM goal_check_ins;

-- Success message
SELECT '✅ Premium Goals System tables created successfully!' AS status;
