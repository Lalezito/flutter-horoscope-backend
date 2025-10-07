-- 📱 FCM TOKENS TABLE
-- Purpose: Store Firebase Cloud Messaging tokens for push notifications
-- Created: October 7, 2025
-- Ref: .claude/BACKEND_FIX_PLAN.md

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS fcm_tokens CASCADE;

-- Create fcm_tokens table
CREATE TABLE fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(50) DEFAULT 'unknown',
  device_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT fcm_tokens_device_id_unique UNIQUE (device_id)
);

-- Create indices for performance
CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_fcm_token ON fcm_tokens(fcm_token);
CREATE INDEX idx_fcm_tokens_created_at ON fcm_tokens(created_at);

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER trigger_update_fcm_tokens_updated_at
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_tokens_updated_at();

-- Verify table created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'fcm_tokens'
ORDER BY ordinal_position;

-- Success message
SELECT 'FCM tokens table created successfully!' AS status;
