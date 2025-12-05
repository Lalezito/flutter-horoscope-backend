-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FIX: PostgreSQL Index Error for Railway Deployment
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Error: functions in index predicate must be marked IMMUTABLE
-- Fix: Remove indexes with volatile functions like CURRENT_DATE, NOW()
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Drop the problematic index with CURRENT_DATE
DROP INDEX IF EXISTS idx_predictions_yesterday;

-- Create a simpler replacement index without WHERE clause
CREATE INDEX IF NOT EXISTS idx_predictions_user_date
  ON predictions(user_id, predicted_for_date DESC);

-- This index serves the same purpose but without volatile functions
COMMENT ON INDEX idx_predictions_user_date IS 'Efficient index for querying user predictions by date (replaces idx_predictions_yesterday)';

-- Verify fix
SELECT
  'PostgreSQL index fix applied successfully!' as status,
  COUNT(*) FILTER (WHERE indexname = 'idx_predictions_user_date') as new_index_exists,
  COUNT(*) FILTER (WHERE indexname = 'idx_predictions_yesterday') as old_index_removed
FROM pg_indexes
WHERE tablename = 'predictions';
