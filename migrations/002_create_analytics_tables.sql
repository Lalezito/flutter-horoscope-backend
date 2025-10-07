-- Migration: Create analytics and monitoring tables
-- Created: 2025-08-26

-- Usage analytics for tracking API usage
CREATE TABLE IF NOT EXISTS usage_analytics (
  id SERIAL PRIMARY KEY,
  ip VARCHAR(45),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_agent TEXT,
  response_time_ms INTEGER DEFAULT NULL,
  status_code INTEGER DEFAULT NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON usage_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_endpoint ON usage_analytics(endpoint);
CREATE INDEX IF NOT EXISTS idx_analytics_ip ON usage_analytics(ip);

-- System health logs
CREATE TABLE IF NOT EXISTS system_health_logs (
  id SERIAL PRIMARY KEY,
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'ok', 'warning', 'error'
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Index for health monitoring
CREATE INDEX IF NOT EXISTS idx_health_timestamp ON system_health_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_health_status ON system_health_logs(status);

-- Error logs for better debugging
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Index for error monitoring
CREATE INDEX IF NOT EXISTS idx_error_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_type ON error_logs(error_type);

-- Comments
COMMENT ON TABLE usage_analytics IS 'Track API usage patterns and performance metrics';
COMMENT ON TABLE system_health_logs IS 'Log system health check results';
COMMENT ON TABLE error_logs IS 'Store application errors for debugging and monitoring';