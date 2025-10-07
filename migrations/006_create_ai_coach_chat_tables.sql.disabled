-- Migration: AI Coach Chat System Tables
-- Created: 2025-01-15
-- Description: Creates tables for AI Coach real-time chat functionality

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    session_metadata JSONB DEFAULT '{}',
    conversation_context JSONB DEFAULT '{}',
    total_messages INTEGER DEFAULT 0,
    ai_coach_persona VARCHAR(100) DEFAULT 'general',
    language_code VARCHAR(10) DEFAULT 'en',
    premium_features_used JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT uq_chat_sessions_session_id UNIQUE (session_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ai_model VARCHAR(50),
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    confidence_score DECIMAL(3,2),
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    
    -- Foreign key constraint
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON chat_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_active ON chat_sessions(user_id, is_active, last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_chat_sessions_metadata_gin ON chat_sessions USING GIN (session_metadata);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_context_gin ON chat_sessions USING GIN (conversation_context);
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata_gin ON chat_messages USING GIN (metadata);

-- Create trigger to update last_activity on new messages
CREATE OR REPLACE FUNCTION update_chat_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions 
    SET 
        last_activity = CURRENT_TIMESTAMP,
        total_messages = total_messages + 1
    WHERE session_id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_session_activity
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_session_activity();

-- Create function to clean up old inactive sessions (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_inactive_chat_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_sessions 
    WHERE 
        is_active = false 
        AND last_activity < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create views for common queries
CREATE OR REPLACE VIEW v_active_chat_sessions AS
SELECT 
    cs.session_id,
    cs.user_id,
    cs.created_at,
    cs.last_activity,
    cs.total_messages,
    cs.ai_coach_persona,
    cs.language_code,
    COALESCE(recent_messages.message_count, 0) as recent_message_count
FROM chat_sessions cs
LEFT JOIN (
    SELECT 
        session_id,
        COUNT(*) as message_count
    FROM chat_messages 
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    GROUP BY session_id
) recent_messages ON cs.session_id = recent_messages.session_id
WHERE cs.is_active = true
ORDER BY cs.last_activity DESC;

CREATE OR REPLACE VIEW v_chat_session_stats AS
SELECT 
    cs.user_id,
    COUNT(DISTINCT cs.session_id) as total_sessions,
    COUNT(DISTINCT CASE WHEN cs.is_active THEN cs.session_id END) as active_sessions,
    COALESCE(SUM(cs.total_messages), 0) as total_messages,
    MAX(cs.last_activity) as last_chat_activity,
    COALESCE(AVG(msg_stats.avg_response_time), 0) as avg_response_time
FROM chat_sessions cs
LEFT JOIN (
    SELECT 
        session_id,
        AVG(response_time_ms) as avg_response_time
    FROM chat_messages 
    WHERE message_type = 'ai' AND response_time_ms IS NOT NULL
    GROUP BY session_id
) msg_stats ON cs.session_id = msg_stats.session_id
GROUP BY cs.user_id;

-- Add table comments for documentation
COMMENT ON TABLE chat_sessions IS 'AI Coach chat sessions with user context and metadata';
COMMENT ON TABLE chat_messages IS 'Individual messages in AI Coach chat conversations';

COMMENT ON COLUMN chat_sessions.session_id IS 'Unique UUID for each chat session';
COMMENT ON COLUMN chat_sessions.user_id IS 'User identifier from authentication system';
COMMENT ON COLUMN chat_sessions.conversation_context IS 'AI conversation memory and context';
COMMENT ON COLUMN chat_sessions.ai_coach_persona IS 'AI coach personality type (general, motivational, spiritual, etc.)';
COMMENT ON COLUMN chat_sessions.premium_features_used IS 'Tracking of premium features used in session';

COMMENT ON COLUMN chat_messages.message_type IS 'Type of message: user, ai, or system';
COMMENT ON COLUMN chat_messages.metadata IS 'Message-specific metadata (user_agent, location, etc.)';
COMMENT ON COLUMN chat_messages.ai_model IS 'AI model used for response generation';
COMMENT ON COLUMN chat_messages.tokens_used IS 'Number of tokens consumed for AI response';
COMMENT ON COLUMN chat_messages.response_time_ms IS 'AI response generation time in milliseconds';
COMMENT ON COLUMN chat_messages.confidence_score IS 'AI confidence score for response (0.00-1.00)';

COMMENT ON VIEW v_active_chat_sessions IS 'Active chat sessions with recent activity metrics';
COMMENT ON VIEW v_chat_session_stats IS 'Per-user chat session statistics and metrics';

-- Insert default AI coach personas
INSERT INTO chat_sessions (session_id, user_id, ai_coach_persona, conversation_context, is_active) 
VALUES 
('00000000-0000-0000-0000-000000000000', 'system', 'general', 
 '{"personas": ["general", "motivational", "spiritual", "career", "relationship", "wellness"]}', false)
ON CONFLICT (session_id) DO NOTHING;