-- ===================================================================
-- ADVANCED COMPATIBILITY SYSTEM MIGRATION
-- Multi-dimensional compatibility analysis, matching, and tracking
-- Version: 1.0.0
-- ===================================================================

-- USER PROFILES TABLE
-- Extended user information for compatibility matching
CREATE TABLE IF NOT EXISTS user_compatibility_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,

    -- Basic Astrological Data
    sun_sign VARCHAR(50) NOT NULL,
    moon_sign VARCHAR(50),
    rising_sign VARCHAR(50),
    venus_sign VARCHAR(50),
    mars_sign VARCHAR(50),
    mercury_sign VARCHAR(50),

    -- Birth Data
    birth_date DATE,
    birth_time TIME,
    birth_location_lat DECIMAL(10, 7),
    birth_location_lng DECIMAL(10, 7),
    birth_location_city VARCHAR(255),
    birth_location_country VARCHAR(100),
    timezone VARCHAR(100),

    -- User Preferences
    looking_for TEXT[], -- ['romantic', 'friendship', 'business']
    preferred_age_min INTEGER,
    preferred_age_max INTEGER,
    preferred_distance_km INTEGER DEFAULT 50,
    preferred_languages TEXT[],

    -- Profile Info
    display_name VARCHAR(255),
    bio TEXT,
    profile_photo_url TEXT,
    age INTEGER,
    gender VARCHAR(50),
    location_city VARCHAR(255),
    location_country VARCHAR(100),

    -- Privacy Settings
    profile_visible BOOLEAN DEFAULT true,
    show_in_matching BOOLEAN DEFAULT false,
    show_birth_chart BOOLEAN DEFAULT false,

    -- Subscription Tier
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, cosmic, universe

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('free', 'cosmic', 'universe'))
);

-- COMPATIBILITY CHECKS TABLE
-- Track all compatibility analyses performed
CREATE TABLE IF NOT EXISTS compatibility_checks (
    id SERIAL PRIMARY KEY,
    check_id VARCHAR(100) UNIQUE NOT NULL,

    -- Users Involved
    user1_id VARCHAR(255) NOT NULL,
    user2_id VARCHAR(255) NOT NULL,

    -- Compatibility Scores (0-100 scale)
    overall_score DECIMAL(5, 2) NOT NULL,
    sun_compatibility DECIMAL(5, 2),
    moon_compatibility DECIMAL(5, 2),
    rising_compatibility DECIMAL(5, 2),
    venus_compatibility DECIMAL(5, 2),
    mars_compatibility DECIMAL(5, 2),
    mercury_compatibility DECIMAL(5, 2),

    -- Relationship Type Scores
    romantic_score DECIMAL(5, 2),
    friendship_score DECIMAL(5, 2),
    business_score DECIMAL(5, 2),

    -- Advanced Analysis
    emotional_compatibility DECIMAL(5, 2),
    communication_compatibility DECIMAL(5, 2),
    intimacy_compatibility DECIMAL(5, 2),
    conflict_resolution_score DECIMAL(5, 2),

    -- Birth Chart Analysis (if available)
    has_birth_chart_analysis BOOLEAN DEFAULT false,
    aspect_score DECIMAL(5, 2),
    synastry_highlights JSONB,

    -- Analysis Details
    strengths TEXT[],
    challenges TEXT[],
    recommendations TEXT[],
    red_flags TEXT[],

    -- Metadata
    analysis_depth VARCHAR(50), -- basic, standard, comprehensive, elite
    language VARCHAR(10) DEFAULT 'en',
    processing_time_ms INTEGER,

    -- User Context
    initiated_by VARCHAR(255),
    relationship_type VARCHAR(50), -- romantic, friendship, business, family

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- COMPATIBILITY REPORTS TABLE
-- Detailed PDF reports generated
CREATE TABLE IF NOT EXISTS compatibility_reports (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(100) UNIQUE NOT NULL,

    -- Associated Check
    check_id VARCHAR(100) REFERENCES compatibility_checks(check_id),

    -- Report Details
    report_type VARCHAR(50) NOT NULL, -- basic, premium, elite
    report_title VARCHAR(500),

    -- Content
    summary TEXT,
    detailed_analysis JSONB,
    charts_data JSONB,
    timeline_predictions JSONB,

    -- PDF Generation
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    pdf_size_kb INTEGER,

    -- Report Sections
    includes_strengths BOOLEAN DEFAULT true,
    includes_challenges BOOLEAN DEFAULT true,
    includes_timeline BOOLEAN DEFAULT false,
    includes_advice BOOLEAN DEFAULT true,
    includes_charts BOOLEAN DEFAULT false,

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    page_count INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- COMPATIBILITY TIMELINE TABLE
-- Track compatibility evolution over time
CREATE TABLE IF NOT EXISTS compatibility_timeline (
    id SERIAL PRIMARY KEY,
    timeline_id VARCHAR(100) UNIQUE NOT NULL,

    -- Relationship
    user1_id VARCHAR(255) NOT NULL,
    user2_id VARCHAR(255) NOT NULL,
    relationship_id VARCHAR(255), -- Optional relationship identifier

    -- Timeline Entry
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Scores for Period
    compatibility_score DECIMAL(5, 2),
    harmony_level VARCHAR(50), -- excellent, good, fair, challenging

    -- Astrological Events Impact
    active_transits JSONB,
    mercury_retrograde BOOLEAN DEFAULT false,
    eclipse_impact BOOLEAN DEFAULT false,
    major_aspects JSONB,

    -- Predictions
    best_days TEXT[],
    challenging_days TEXT[],
    highlights TEXT,
    warnings TEXT,

    -- Recommendations
    suggested_activities TEXT[],
    communication_tips TEXT[],

    -- Metadata
    confidence_score DECIMAL(5, 2),
    prediction_accuracy DECIMAL(5, 2), -- Filled retroactively

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMPATIBILITY MATCHES TABLE
-- Store matching algorithm results
CREATE TABLE IF NOT EXISTS compatibility_matches (
    id SERIAL PRIMARY KEY,
    match_id VARCHAR(100) UNIQUE NOT NULL,

    -- Matching
    seeker_user_id VARCHAR(255) NOT NULL,
    matched_user_id VARCHAR(255) NOT NULL,

    -- Match Score
    match_score DECIMAL(5, 2) NOT NULL,
    match_quality VARCHAR(50), -- excellent, very_good, good, fair

    -- Match Reasons
    primary_strength VARCHAR(500),
    secondary_strengths TEXT[],
    match_highlights TEXT[],

    -- Compatibility Breakdown
    overall_compatibility DECIMAL(5, 2),
    romantic_potential DECIMAL(5, 2),
    long_term_potential DECIMAL(5, 2),

    -- Match Status
    match_status VARCHAR(50) DEFAULT 'suggested', -- suggested, viewed, liked, mutual_match, passed, hidden
    viewed_at TIMESTAMP WITH TIME ZONE,
    liked_at TIMESTAMP WITH TIME ZONE,
    matched_at TIMESTAMP WITH TIME ZONE,

    -- Conversation
    conversation_started BOOLEAN DEFAULT false,
    first_message_at TIMESTAMP WITH TIME ZONE,

    -- Filters Applied
    passed_distance_filter BOOLEAN DEFAULT true,
    passed_age_filter BOOLEAN DEFAULT true,
    passed_preference_filter BOOLEAN DEFAULT true,

    -- Metadata
    algorithm_version VARCHAR(20),
    match_rank INTEGER, -- Ranking in user's match list

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RELATIONSHIP MILESTONES TABLE
-- Track and predict relationship milestones
CREATE TABLE IF NOT EXISTS relationship_milestones (
    id SERIAL PRIMARY KEY,
    milestone_id VARCHAR(100) UNIQUE NOT NULL,

    -- Relationship
    user1_id VARCHAR(255) NOT NULL,
    user2_id VARCHAR(255) NOT NULL,
    relationship_id VARCHAR(255),

    -- Milestone Details
    milestone_type VARCHAR(100) NOT NULL, -- first_date, first_kiss, meeting_family, moving_in, engagement, marriage, anniversary
    milestone_name VARCHAR(255),

    -- Timing
    predicted_date DATE,
    predicted_date_range_start DATE,
    predicted_date_range_end DATE,
    actual_date DATE,

    -- Astrological Timing
    optimal_astrological_window JSONB,
    favorable_aspects JSONB,
    supporting_transits JSONB,

    -- Status
    milestone_status VARCHAR(50) DEFAULT 'predicted', -- predicted, planned, completed, skipped

    -- Advice
    timing_advice TEXT,
    preparation_tips TEXT[],

    -- Accuracy Tracking
    prediction_confidence DECIMAL(5, 2),
    prediction_accurate BOOLEAN,
    days_off_prediction INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- COMPATIBILITY ANALYTICS TABLE
-- Track usage and performance metrics
CREATE TABLE IF NOT EXISTS compatibility_analytics (
    id SERIAL PRIMARY KEY,

    -- Time Period
    date DATE NOT NULL,
    hour INTEGER CHECK (hour >= 0 AND hour <= 23),

    -- Usage Metrics
    total_checks INTEGER DEFAULT 0,
    basic_checks INTEGER DEFAULT 0,
    premium_checks INTEGER DEFAULT 0,
    elite_checks INTEGER DEFAULT 0,

    -- Match Metrics
    matches_generated INTEGER DEFAULT 0,
    mutual_matches INTEGER DEFAULT 0,
    conversations_started INTEGER DEFAULT 0,

    -- Report Metrics
    reports_generated INTEGER DEFAULT 0,
    pdf_downloads INTEGER DEFAULT 0,

    -- Performance
    avg_processing_time_ms INTEGER,
    avg_compatibility_score DECIMAL(5, 2),

    -- Subscription Breakdown
    free_tier_checks INTEGER DEFAULT 0,
    cosmic_tier_checks INTEGER DEFAULT 0,
    universe_tier_checks INTEGER DEFAULT 0,

    -- Revenue Tracking
    estimated_revenue_usd DECIMAL(10, 2) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_date_hour UNIQUE (date, hour)
);

-- USER COMPATIBILITY PREFERENCES TABLE
-- Store user preferences for matching
CREATE TABLE IF NOT EXISTS user_compatibility_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,

    -- Deal Breakers
    required_sun_signs TEXT[],
    blocked_sun_signs TEXT[],

    -- Preferences
    preferred_elements TEXT[], -- fire, earth, air, water
    preferred_modalities TEXT[], -- cardinal, fixed, mutable

    -- Compatibility Minimum Scores
    min_overall_score INTEGER DEFAULT 60,
    min_romantic_score INTEGER,
    min_emotional_score INTEGER,

    -- Relationship Goals
    relationship_goals TEXT[], -- long_term, casual, friendship, marriage, family
    important_values TEXT[],

    -- Communication Style
    communication_preference VARCHAR(100), -- direct, gentle, intellectual, emotional
    conflict_style VARCHAR(100), -- assertive, accommodating, collaborative, avoiding

    -- Custom Filters
    custom_filters JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMPATIBILITY FEEDBACK TABLE
-- User feedback on compatibility accuracy
CREATE TABLE IF NOT EXISTS compatibility_feedback (
    id SERIAL PRIMARY KEY,

    -- Reference
    check_id VARCHAR(100) REFERENCES compatibility_checks(check_id),
    user_id VARCHAR(255) NOT NULL,

    -- Feedback
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    helpful_rating INTEGER CHECK (helpful_rating >= 1 AND helpful_rating <= 5),

    -- Specific Feedback
    accurate_aspects TEXT[],
    inaccurate_aspects TEXT[],
    missing_insights TEXT,

    -- Free Text
    comments TEXT,

    -- Relationship Outcome
    relationship_status VARCHAR(100), -- dating, committed, married, friends, ended, no_contact
    still_together BOOLEAN,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================

-- User Profiles
CREATE INDEX idx_user_profiles_user_id ON user_compatibility_profiles(user_id);
CREATE INDEX idx_user_profiles_sun_sign ON user_compatibility_profiles(sun_sign);
CREATE INDEX idx_user_profiles_location ON user_compatibility_profiles(location_city, location_country);
CREATE INDEX idx_user_profiles_matching ON user_compatibility_profiles(show_in_matching, subscription_tier) WHERE show_in_matching = true;
CREATE INDEX idx_user_profiles_tier ON user_compatibility_profiles(subscription_tier);

-- Compatibility Checks
CREATE INDEX idx_checks_users ON compatibility_checks(user1_id, user2_id);
CREATE INDEX idx_checks_created ON compatibility_checks(created_at DESC);
CREATE INDEX idx_checks_score ON compatibility_checks(overall_score DESC);
CREATE INDEX idx_checks_check_id ON compatibility_checks(check_id);

-- Compatibility Reports
CREATE INDEX idx_reports_check ON compatibility_reports(check_id);
CREATE INDEX idx_reports_created ON compatibility_reports(created_at DESC);

-- Compatibility Timeline
CREATE INDEX idx_timeline_users ON compatibility_timeline(user1_id, user2_id);
CREATE INDEX idx_timeline_period ON compatibility_timeline(period_start, period_end);
CREATE INDEX idx_timeline_created ON compatibility_timeline(created_at DESC);

-- Compatibility Matches
CREATE INDEX idx_matches_seeker ON compatibility_matches(seeker_user_id, match_score DESC);
CREATE INDEX idx_matches_status ON compatibility_matches(seeker_user_id, match_status);
CREATE INDEX idx_matches_mutual ON compatibility_matches(seeker_user_id, matched_user_id) WHERE match_status = 'mutual_match';
CREATE INDEX idx_matches_created ON compatibility_matches(created_at DESC);

-- Relationship Milestones
CREATE INDEX idx_milestones_users ON relationship_milestones(user1_id, user2_id);
CREATE INDEX idx_milestones_type ON relationship_milestones(milestone_type);
CREATE INDEX idx_milestones_status ON relationship_milestones(milestone_status);
CREATE INDEX idx_milestones_date ON relationship_milestones(predicted_date);

-- Analytics
CREATE INDEX idx_analytics_date ON compatibility_analytics(date DESC, hour DESC);

-- Preferences
CREATE INDEX idx_preferences_user ON user_compatibility_preferences(user_id);

-- Feedback
CREATE INDEX idx_feedback_check ON compatibility_feedback(check_id);
CREATE INDEX idx_feedback_user ON compatibility_feedback(user_id);
CREATE INDEX idx_feedback_rating ON compatibility_feedback(accuracy_rating);

-- ===================================================================
-- FUNCTIONS AND TRIGGERS
-- ===================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_compatibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_timestamp
    BEFORE UPDATE ON user_compatibility_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_compatibility_updated_at();

CREATE TRIGGER update_matches_timestamp
    BEFORE UPDATE ON compatibility_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_compatibility_updated_at();

CREATE TRIGGER update_milestones_timestamp
    BEFORE UPDATE ON relationship_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_compatibility_updated_at();

CREATE TRIGGER update_preferences_timestamp
    BEFORE UPDATE ON user_compatibility_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_compatibility_updated_at();

-- ===================================================================
-- VIEWS FOR COMMON QUERIES
-- ===================================================================

-- Top Matches View
CREATE OR REPLACE VIEW v_top_matches AS
SELECT
    cm.*,
    ucp1.display_name as seeker_name,
    ucp1.sun_sign as seeker_sun_sign,
    ucp2.display_name as matched_name,
    ucp2.sun_sign as matched_sun_sign,
    ucp2.age as matched_age,
    ucp2.location_city as matched_city
FROM compatibility_matches cm
LEFT JOIN user_compatibility_profiles ucp1 ON cm.seeker_user_id = ucp1.user_id
LEFT JOIN user_compatibility_profiles ucp2 ON cm.matched_user_id = ucp2.user_id
WHERE cm.match_status IN ('suggested', 'viewed')
ORDER BY cm.match_score DESC;

-- Active Relationships View
CREATE OR REPLACE VIEW v_active_relationships AS
SELECT
    user1_id,
    user2_id,
    COUNT(*) as total_checks,
    MAX(created_at) as last_check,
    AVG(overall_score) as avg_compatibility,
    BOOL_OR(has_birth_chart_analysis) as has_advanced_analysis
FROM compatibility_checks
GROUP BY user1_id, user2_id
HAVING COUNT(*) >= 2;

-- Daily Analytics View
CREATE OR REPLACE VIEW v_daily_compatibility_stats AS
SELECT
    date,
    SUM(total_checks) as total_checks,
    SUM(reports_generated) as total_reports,
    SUM(matches_generated) as total_matches,
    SUM(mutual_matches) as total_mutual_matches,
    AVG(avg_compatibility_score) as avg_score,
    SUM(estimated_revenue_usd) as total_revenue
FROM compatibility_analytics
GROUP BY date
ORDER BY date DESC;

-- ===================================================================
-- INITIAL DATA / SAMPLE RECORDS
-- ===================================================================

-- Sample compatibility check for testing (optional)
COMMENT ON TABLE user_compatibility_profiles IS 'User profiles for advanced compatibility matching and analysis';
COMMENT ON TABLE compatibility_checks IS 'Historical record of all compatibility analyses performed';
COMMENT ON TABLE compatibility_reports IS 'Generated PDF reports for premium users';
COMMENT ON TABLE compatibility_timeline IS 'Time-based compatibility predictions and tracking';
COMMENT ON TABLE compatibility_matches IS 'Dating feature matches generated by algorithm';
COMMENT ON TABLE relationship_milestones IS 'Predicted and actual relationship milestones';
COMMENT ON TABLE compatibility_analytics IS 'Usage metrics and performance tracking';
COMMENT ON TABLE user_compatibility_preferences IS 'User preferences for compatibility matching';
COMMENT ON TABLE compatibility_feedback IS 'User feedback on compatibility accuracy';

-- Migration complete message
DO $$
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'ADVANCED COMPATIBILITY SYSTEM MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Created Tables:';
    RAISE NOTICE '  - user_compatibility_profiles';
    RAISE NOTICE '  - compatibility_checks';
    RAISE NOTICE '  - compatibility_reports';
    RAISE NOTICE '  - compatibility_timeline';
    RAISE NOTICE '  - compatibility_matches';
    RAISE NOTICE '  - relationship_milestones';
    RAISE NOTICE '  - compatibility_analytics';
    RAISE NOTICE '  - user_compatibility_preferences';
    RAISE NOTICE '  - compatibility_feedback';
    RAISE NOTICE '';
    RAISE NOTICE 'Created Indexes: 25+ performance indexes';
    RAISE NOTICE 'Created Views: 3 analytics views';
    RAISE NOTICE 'Created Functions: Update timestamp triggers';
    RAISE NOTICE '=================================================================';
END $$;
