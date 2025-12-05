-- Migration: 005_create_goal_planner_tables.sql (FIXED)
-- Description: Create tables for AI-powered Goal Planner feature
-- Date: 2025-10-08
-- Fixed: 2025-12-04 - Corrected PostgreSQL syntax for indexes

-- Main goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    goal_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,

    -- Main goal data
    focus_area VARCHAR(50) NOT NULL, -- career, relationships, wellness, personal_growth
    status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, deleted

    -- SMART goal structure
    main_goal_title TEXT NOT NULL,
    main_goal_description TEXT,
    main_goal_specific TEXT,
    main_goal_measurable TEXT,
    main_goal_achievable TEXT,
    main_goal_relevant TEXT,
    main_goal_timebound TEXT,

    -- Context
    zodiac_sign VARCHAR(50),
    timeframe VARCHAR(50), -- weekly, monthly, quarterly
    emotional_state VARCHAR(50),
    objective TEXT,

    -- Astrological alignment
    astrological_alignment_planet VARCHAR(100),
    astrological_alignment_house VARCHAR(100),
    astrological_alignment_strength INTEGER,
    astrological_alignment_description TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for goals table
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_focus_area ON goals(focus_area);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);

-- Micro habits table
CREATE TABLE IF NOT EXISTS goal_micro_habits (
    id SERIAL PRIMARY KEY,
    goal_id VARCHAR(255) NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,

    habit TEXT NOT NULL,
    frequency VARCHAR(100), -- "Daily", "3x per week", etc
    duration VARCHAR(100), -- "15 minutes", "30 minutes", etc
    order_index INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for micro habits
CREATE INDEX IF NOT EXISTS idx_micro_habits_goal_id ON goal_micro_habits(goal_id);

-- Milestones table
CREATE TABLE IF NOT EXISTS goal_milestones (
    id SERIAL PRIMARY KEY,
    goal_id VARCHAR(255) NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,

    milestone TEXT NOT NULL,
    target_date VARCHAR(100), -- "Week 1", "End of month", etc
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    order_index INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for milestones
CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON goal_milestones(is_completed);

-- Obstacles table
CREATE TABLE IF NOT EXISTS goal_obstacles (
    id SERIAL PRIMARY KEY,
    goal_id VARCHAR(255) NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,

    obstacle TEXT NOT NULL,
    solution TEXT,
    order_index INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for obstacles
CREATE INDEX IF NOT EXISTS idx_obstacles_goal_id ON goal_obstacles(goal_id);

-- Check-ins table (progress tracking)
CREATE TABLE IF NOT EXISTS goal_checkins (
    id SERIAL PRIMARY KEY,
    checkin_id VARCHAR(255) UNIQUE NOT NULL,
    goal_id VARCHAR(255) NOT NULL REFERENCES goals(goal_id) ON DELETE CASCADE,

    progress INTEGER NOT NULL, -- 0-100
    mood VARCHAR(50), -- excited, motivated, neutral, struggling, stuck
    feedback TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for check-ins
CREATE INDEX IF NOT EXISTS idx_checkins_goal_id ON goal_checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON goal_checkins(created_at);

-- Comments
COMMENT ON TABLE goals IS 'AI-generated SMART goals for users based on zodiac sign';
COMMENT ON TABLE goal_micro_habits IS 'Daily micro-habits for achieving goals';
COMMENT ON TABLE goal_milestones IS 'Trackable milestones for goal progress';
COMMENT ON TABLE goal_obstacles IS 'Potential obstacles and solutions';
COMMENT ON TABLE goal_checkins IS 'User progress check-ins for goals';

-- Grant permissions (adjust as needed for your setup)
GRANT ALL PRIVILEGES ON TABLE goals TO postgres;
GRANT ALL PRIVILEGES ON TABLE goal_micro_habits TO postgres;
GRANT ALL PRIVILEGES ON TABLE goal_milestones TO postgres;
GRANT ALL PRIVILEGES ON TABLE goal_obstacles TO postgres;
GRANT ALL PRIVILEGES ON TABLE goal_checkins TO postgres;

GRANT USAGE, SELECT ON SEQUENCE goals_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE goal_micro_habits_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE goal_milestones_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE goal_obstacles_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE goal_checkins_id_seq TO postgres;
