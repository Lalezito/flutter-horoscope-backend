-- =====================================================
-- IMAGE GENERATION SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Tables for DALL-E 3 image generation and management
--
-- Features:
-- - Generated images tracking
-- - Usage statistics
-- - Cost analytics
-- - Social sharing metrics
-- =====================================================

-- Table: generated_images
-- Stores all DALL-E generated images
CREATE TABLE IF NOT EXISTS generated_images (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    quality VARCHAR(20) DEFAULT 'standard',
    cost DECIMAL(10, 4) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_category ON generated_images(category);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_user_created ON generated_images(user_id, created_at DESC);

-- Table: image_generation_stats
-- Tracks usage statistics per user
CREATE TABLE IF NOT EXISTS image_generation_stats (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    generated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_image_stats_user_id ON image_generation_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_image_stats_generated_at ON image_generation_stats(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_stats_user_week ON image_generation_stats(user_id, generated_at DESC);

-- Table: image_share_events
-- Tracks social sharing events for analytics
CREATE TABLE IF NOT EXISTS image_share_events (
    id SERIAL PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- instagram_square, instagram_story, twitter, facebook
    shared_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_share_events_image_id ON image_share_events(image_id);
CREATE INDEX IF NOT EXISTS idx_share_events_user_id ON image_share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_share_events_platform ON image_share_events(platform);
CREATE INDEX IF NOT EXISTS idx_share_events_shared_at ON image_share_events(shared_at DESC);

-- Table: image_download_events
-- Tracks image downloads
CREATE TABLE IF NOT EXISTS image_download_events (
    id SERIAL PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    format VARCHAR(50) NOT NULL,
    downloaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_download_events_image_id ON image_download_events(image_id);
CREATE INDEX IF NOT EXISTS idx_download_events_user_id ON image_download_events(user_id);

-- Table: batch_generation_logs
-- Logs for automated batch generation jobs
CREATE TABLE IF NOT EXISTS batch_generation_logs (
    id SERIAL PRIMARY KEY,
    run_date DATE NOT NULL,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    cached_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    duration_seconds DECIMAL(10, 2) DEFAULT 0,
    error_log JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_batch_logs_run_date ON batch_generation_logs(run_date DESC);

-- Table: image_favorites
-- User's favorite images
CREATE TABLE IF NOT EXISTS image_favorites (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    image_id UUID NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
    favorited_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, image_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON image_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_favorited_at ON image_favorites(favorited_at DESC);

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- View: daily_generation_stats
-- Daily aggregated statistics
CREATE OR REPLACE VIEW daily_generation_stats AS
SELECT
    DATE(created_at) as generation_date,
    category,
    model,
    COUNT(*) as image_count,
    SUM(cost) as total_cost,
    AVG(cost) as avg_cost
FROM generated_images
GROUP BY DATE(created_at), category, model
ORDER BY generation_date DESC;

-- View: user_weekly_usage
-- Weekly usage per user (for tier limits)
CREATE OR REPLACE VIEW user_weekly_usage AS
SELECT
    user_id,
    DATE_TRUNC('week', generated_at) as week_start,
    COUNT(*) as generation_count
FROM image_generation_stats
WHERE generated_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id, DATE_TRUNC('week', generated_at);

-- View: popular_shared_images
-- Most shared images
CREATE OR REPLACE VIEW popular_shared_images AS
SELECT
    gi.id,
    gi.image_url,
    gi.category,
    gi.metadata,
    COUNT(ise.id) as share_count,
    COUNT(DISTINCT ise.platform) as platforms_count
FROM generated_images gi
LEFT JOIN image_share_events ise ON gi.id = ise.image_id
GROUP BY gi.id, gi.image_url, gi.category, gi.metadata
HAVING COUNT(ise.id) > 0
ORDER BY share_count DESC;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function: get_user_weekly_limit_status
-- Check if user has reached weekly generation limit
CREATE OR REPLACE FUNCTION get_user_weekly_limit_status(p_user_id TEXT, p_limit INTEGER)
RETURNS TABLE(
    used INTEGER,
    remaining INTEGER,
    limit_reached BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(COUNT(*)::INTEGER, 0) as used,
        GREATEST(0, p_limit - COALESCE(COUNT(*)::INTEGER, 0)) as remaining,
        COALESCE(COUNT(*)::INTEGER, 0) >= p_limit as limit_reached
    FROM image_generation_stats
    WHERE user_id = p_user_id
    AND generated_at >= DATE_TRUNC('week', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function: record_image_share
-- Record a share event and return share count
CREATE OR REPLACE FUNCTION record_image_share(
    p_image_id UUID,
    p_user_id TEXT,
    p_platform VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
    v_share_count INTEGER;
BEGIN
    -- Insert share event
    INSERT INTO image_share_events (image_id, user_id, platform)
    VALUES (p_image_id, p_user_id, p_platform);

    -- Get total share count for this image
    SELECT COUNT(*) INTO v_share_count
    FROM image_share_events
    WHERE image_id = p_image_id;

    RETURN v_share_count;
END;
$$ LANGUAGE plpgsql;

-- Function: get_cost_report
-- Generate cost report for a date range
CREATE OR REPLACE FUNCTION get_cost_report(
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
)
RETURNS TABLE(
    total_images BIGINT,
    total_cost NUMERIC,
    avg_cost_per_image NUMERIC,
    breakdown JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_images,
        SUM(cost)::NUMERIC as total_cost,
        AVG(cost)::NUMERIC as avg_cost_per_image,
        jsonb_agg(
            jsonb_build_object(
                'category', category,
                'model', model,
                'count', count,
                'cost', total_cost
            )
        ) as breakdown
    FROM (
        SELECT
            category,
            model,
            COUNT(*) as count,
            SUM(cost) as total_cost
        FROM generated_images
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY category, model
    ) subq;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: update_timestamp
-- Automatically update updated_at on record changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_generated_images_updated_at
    BEFORE UPDATE ON generated_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA / CLEANUP
-- =====================================================

-- Clean up old stats (optional - run manually or via cron)
-- DELETE FROM image_generation_stats WHERE generated_at < NOW() - INTERVAL '90 days';
-- DELETE FROM image_share_events WHERE shared_at < NOW() - INTERVAL '90 days';

COMMENT ON TABLE generated_images IS 'Stores all DALL-E 3 generated cosmic images';
COMMENT ON TABLE image_generation_stats IS 'Tracks user image generation usage for tier limits';
COMMENT ON TABLE image_share_events IS 'Analytics for social media sharing events';
COMMENT ON TABLE image_download_events IS 'Tracks image download events';
COMMENT ON TABLE batch_generation_logs IS 'Logs for automated daily batch generation';
COMMENT ON TABLE image_favorites IS 'User favorite images';

-- Verify tables created
SELECT 'Image generation tables created successfully!' AS status;
