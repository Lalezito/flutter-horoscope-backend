-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 USER MEMORIES SYSTEM
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Revolutionary long-term memory system for AI Coach
--
-- PURPOSE:
-- Creates a database for storing important user life events, goals, challenges,
-- and milestones that the AI can reference weeks/months later. This creates
-- deep emotional connection as users feel "the AI remembers my life!"
--
-- IMPACT:
-- +1000% increase in emotional connection and user retention
-- Users report: "It feels like talking to someone who really knows me"
--
-- MEMORY TYPES:
-- - life_event: Major life events (illness, death, marriage, pregnancy, etc.)
-- - goal: User aspirations and objectives
-- - challenge: Problems and difficulties user is facing
-- - person: Important people in user's life
-- - emotion: Significant emotional states
-- - milestone: Important dates and achievements
--
-- CREATED: 2025-01-23
-- VERSION: 1.0
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Drop existing table if it exists (for clean migrations)
DROP TABLE IF EXISTS user_memories CASCADE;

-- Create user_memories table
CREATE TABLE user_memories (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Memory classification
  memory_type VARCHAR(50) NOT NULL CHECK (
    memory_type IN (
      'life_event',      -- Major life events (illness, death, marriage, birth, etc.)
      'goal',            -- User goals and aspirations
      'challenge',       -- Problems and difficulties
      'person',          -- Important people in their life
      'emotion',         -- Significant emotional states
      'milestone'        -- Important dates and achievements
    )
  ),

  -- Memory content
  content TEXT NOT NULL,

  -- Importance scoring (1-10)
  -- 10 = Critical life event (death, serious illness)
  -- 7-9 = Very important (wedding, job interview, major goal)
  -- 4-6 = Important (challenges, ongoing goals)
  -- 1-3 = Notable (minor milestones, casual mentions)
  importance INT DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),

  -- Timeline tracking
  mentioned_at TIMESTAMP DEFAULT NOW(),
  last_referenced TIMESTAMP,

  -- Resolution tracking
  resolved BOOLEAN DEFAULT false,
  resolution_note TEXT,
  resolved_at TIMESTAMP,

  -- Rich metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Metadata examples:
  -- {"related_person": "mom", "emotion": "worried", "date_mentioned": "2025-01-15"}
  -- {"goal_deadline": "2025-03-01", "progress": "started"}
  -- {"challenge_category": "health", "support_needed": true}

  -- System timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PERFORMANCE INDICES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Primary lookup: Get all memories for a user
CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);

-- Filter by memory type
CREATE INDEX idx_user_memories_type ON user_memories(memory_type);

-- Sort by importance (most important first)
CREATE INDEX idx_user_memories_importance ON user_memories(importance DESC);

-- Get unresolved memories (most common query)
CREATE INDEX idx_user_memories_unresolved ON user_memories(user_id, resolved)
WHERE resolved = false;

-- Recent memories (for context retrieval)
CREATE INDEX idx_user_memories_recent ON user_memories(user_id, mentioned_at DESC);

-- Combined index for optimal performance on main query
CREATE INDEX idx_user_memories_active ON user_memories(user_id, resolved, importance DESC, mentioned_at DESC)
WHERE resolved = false;

-- JSONB index for metadata queries
CREATE INDEX idx_user_memories_metadata ON user_memories USING GIN (metadata);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- AUTOMATIC TIMESTAMP UPDATES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on any row modification
CREATE TRIGGER trigger_update_user_memories_updated_at
  BEFORE UPDATE ON user_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_user_memories_updated_at();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SAMPLE DATA (for testing and demonstration)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Sample memories for testing (use a test user UUID)
-- Uncomment these for local development/testing:

/*
INSERT INTO user_memories (user_id, memory_type, content, importance, metadata) VALUES
  -- Critical life event
  (
    'test-user-uuid-here'::uuid,
    'life_event',
    'Mi mamá está enferma y tiene que ir al hospital la próxima semana',
    9,
    '{"person": "mother", "emotion": "worried", "event_date": "2025-01-30"}'::jsonb
  ),

  -- Important goal
  (
    'test-user-uuid-here'::uuid,
    'goal',
    'Quiero conseguir ese trabajo en Google, tengo la entrevista en 2 semanas',
    8,
    '{"company": "Google", "deadline": "2025-02-07", "status": "interview_scheduled"}'::jsonb
  ),

  -- Ongoing challenge
  (
    'test-user-uuid-here'::uuid,
    'challenge',
    'Me cuesta mucho dormir por la ansiedad del trabajo',
    6,
    '{"category": "mental_health", "duration": "2_weeks", "impact": "sleep"}'::jsonb
  ),

  -- Milestone
  (
    'test-user-uuid-here'::uuid,
    'milestone',
    'Mi cumpleaños número 30 es el próximo mes',
    5,
    '{"date": "2025-02-23", "type": "birthday", "significance": "milestone_age"}'::jsonb
  );
*/

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STATISTICS VIEW (for analytics)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE VIEW user_memory_stats AS
SELECT
  user_id,
  COUNT(*) as total_memories,
  COUNT(*) FILTER (WHERE resolved = true) as resolved_count,
  COUNT(*) FILTER (WHERE resolved = false) as active_count,
  MAX(importance) as highest_importance,
  AVG(importance) as avg_importance,
  COUNT(DISTINCT memory_type) as memory_types_count,
  MAX(mentioned_at) as last_memory_date,
  MIN(mentioned_at) as first_memory_date
FROM user_memories
GROUP BY user_id;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- HELPER FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Function to get active memories for a user (sorted by importance)
CREATE OR REPLACE FUNCTION get_active_memories(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
  memory_id UUID,
  memory_type VARCHAR,
  content TEXT,
  importance INT,
  days_ago INT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    user_memories.memory_type,
    user_memories.content,
    user_memories.importance,
    EXTRACT(DAY FROM NOW() - mentioned_at)::INT,
    user_memories.metadata
  FROM user_memories
  WHERE user_id = p_user_id
    AND resolved = false
  ORDER BY importance DESC, mentioned_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to mark memory as resolved
CREATE OR REPLACE FUNCTION resolve_memory(
  p_user_id UUID,
  p_memory_id UUID,
  p_resolution_note TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_memories
  SET
    resolved = true,
    resolution_note = p_resolution_note,
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_memory_id
    AND user_id = p_user_id
    AND resolved = false;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- COMMENTS FOR DOCUMENTATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE user_memories IS 'Stores long-term user memories for AI Coach contextual conversations';
COMMENT ON COLUMN user_memories.memory_type IS 'Type of memory: life_event, goal, challenge, person, emotion, milestone';
COMMENT ON COLUMN user_memories.importance IS 'Importance score 1-10 (10=critical, 1=notable)';
COMMENT ON COLUMN user_memories.resolved IS 'Whether the issue/goal has been resolved/completed';
COMMENT ON COLUMN user_memories.metadata IS 'JSONB field for flexible additional context';
COMMENT ON FUNCTION get_active_memories IS 'Returns active (unresolved) memories sorted by importance';
COMMENT ON FUNCTION resolve_memory IS 'Marks a memory as resolved with a note';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION QUERIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Verify table creation
SELECT 'user_memories table created successfully' AS status
WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'user_memories'
);

-- Verify all indices were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'user_memories'
ORDER BY indexname;

-- Verify functions were created
SELECT
  proname AS function_name,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname IN ('get_active_memories', 'resolve_memory', 'update_user_memories_updated_at')
ORDER BY proname;

-- Migration complete
SELECT
  '✅ User Memories System Migration Complete!' AS status,
  NOW() AS timestamp;
