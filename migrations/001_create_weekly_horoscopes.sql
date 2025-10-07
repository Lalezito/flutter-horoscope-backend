-- Migration: Create weekly horoscopes table and ensure daily horoscopes table exists
-- Created: 2025-08-26

-- Create daily horoscopes table if it doesn't exist (for compatibility)
CREATE TABLE IF NOT EXISTS daily_horoscopes (
  id SERIAL PRIMARY KEY,
  sign VARCHAR(20) NOT NULL,
  language_code VARCHAR(5) NOT NULL,
  date DATE NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sign, language_code, date)
);

-- Create weekly horoscopes table
CREATE TABLE IF NOT EXISTS weekly_horoscopes (
  id SERIAL PRIMARY KEY,
  sign VARCHAR(20) NOT NULL,
  language_code VARCHAR(5) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sign, language_code, week_start)
);

-- Indexes for optimal query performance (daily)
CREATE INDEX IF NOT EXISTS idx_daily_current ON daily_horoscopes(date);
CREATE INDEX IF NOT EXISTS idx_daily_sign_lang ON daily_horoscopes(sign, language_code);
CREATE INDEX IF NOT EXISTS idx_daily_created ON daily_horoscopes(created_at);

-- Indexes for optimal query performance (weekly)
CREATE INDEX IF NOT EXISTS idx_weekly_current ON weekly_horoscopes(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_weekly_sign_lang ON weekly_horoscopes(sign, language_code);
CREATE INDEX IF NOT EXISTS idx_weekly_created ON weekly_horoscopes(created_at);

-- Comments for documentation
COMMENT ON TABLE daily_horoscopes IS 'Store daily horoscope predictions for each zodiac sign and language';
COMMENT ON TABLE weekly_horoscopes IS 'Store weekly horoscope predictions for each zodiac sign and language';
COMMENT ON COLUMN daily_horoscopes.sign IS 'Zodiac sign name (e.g., Aries, Tauro, etc.)';
COMMENT ON COLUMN daily_horoscopes.language_code IS 'Language code (es, en, de, fr, it, pt)';
COMMENT ON COLUMN daily_horoscopes.content IS 'JSON content with horoscope data';
COMMENT ON COLUMN weekly_horoscopes.sign IS 'Zodiac sign name (e.g., Aries, Tauro, etc.)';
COMMENT ON COLUMN weekly_horoscopes.language_code IS 'Language code (es, en, de, fr, it, pt)';
COMMENT ON COLUMN weekly_horoscopes.content IS 'JSON content with weekly horoscope data';