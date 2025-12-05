-- Script para arreglar los índices en PostgreSQL Railway
-- Ejecutar esto si las tablas ya existen con índices incorrectos
-- Date: 2025-12-04

-- Drop existing indexes if they were created incorrectly
DROP INDEX IF EXISTS idx_goals_user_id;
DROP INDEX IF EXISTS idx_goals_status;
DROP INDEX IF EXISTS idx_goals_focus_area;
DROP INDEX IF EXISTS idx_goals_created_at;
DROP INDEX IF EXISTS idx_micro_habits_goal_id;
DROP INDEX IF EXISTS idx_milestones_goal_id;
DROP INDEX IF EXISTS idx_milestones_completed;
DROP INDEX IF EXISTS idx_obstacles_goal_id;
DROP INDEX IF EXISTS idx_checkins_goal_id;
DROP INDEX IF EXISTS idx_checkins_created_at;

-- Create indexes correctly (PostgreSQL syntax)
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_focus_area ON goals(focus_area);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
CREATE INDEX IF NOT EXISTS idx_micro_habits_goal_id ON goal_micro_habits(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON goal_milestones(is_completed);
CREATE INDEX IF NOT EXISTS idx_obstacles_goal_id ON goal_obstacles(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_goal_id ON goal_checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON goal_checkins(created_at);

-- Verify indexes were created
SELECT
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename IN ('goals', 'goal_micro_habits', 'goal_milestones', 'goal_obstacles', 'goal_checkins')
ORDER BY
    tablename, indexname;
