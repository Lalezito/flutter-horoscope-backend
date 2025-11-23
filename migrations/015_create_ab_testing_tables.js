/**
 * Migration: Create A/B Testing Tables
 *
 * Tables:
 * - ab_tests: Store test configurations
 * - ab_variant_stats: Track performance metrics for each variant
 * - ab_user_assignments: Track which variant each user is assigned to
 * - ab_events: Track all events for analysis
 * - ab_winning_variants: Store winning configurations for rollout
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function up() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ab_tests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ab_tests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hypothesis TEXT,
        variants JSONB NOT NULL,
        metrics JSONB NOT NULL,
        min_sample_size INTEGER DEFAULT 1000,
        confidence_level INTEGER DEFAULT 95,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        target_segments JSONB,
        auto_rollout BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'running',
        winner VARCHAR(100),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create ab_variant_stats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ab_variant_stats (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
        variant_id VARCHAR(100) NOT NULL,
        users INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        revenue DECIMAL(10, 2) DEFAULT 0,
        events JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(test_id, variant_id)
      );
    `);

    // Create ab_user_assignments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ab_user_assignments (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        variant_id VARCHAR(100) NOT NULL,
        variant_config JSONB,
        assigned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(test_id, user_id)
      );
    `);

    // Create ab_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ab_events (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        variant_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create ab_winning_variants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ab_winning_variants (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
        variant_id VARCHAR(100) NOT NULL,
        config JSONB NOT NULL,
        rolled_out_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_dates ON ab_tests(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_ab_user_assignments_user ON ab_user_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_ab_user_assignments_test ON ab_user_assignments(test_id);
      CREATE INDEX IF NOT EXISTS idx_ab_events_test_variant ON ab_events(test_id, variant_id);
      CREATE INDEX IF NOT EXISTS idx_ab_events_created ON ab_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_ab_variant_stats_test ON ab_variant_stats(test_id);
    `);

    await client.query('COMMIT');
    console.log('✅ A/B Testing tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating A/B Testing tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DROP TABLE IF EXISTS ab_winning_variants CASCADE');
    await client.query('DROP TABLE IF EXISTS ab_events CASCADE');
    await client.query('DROP TABLE IF EXISTS ab_user_assignments CASCADE');
    await client.query('DROP TABLE IF EXISTS ab_variant_stats CASCADE');
    await client.query('DROP TABLE IF EXISTS ab_tests CASCADE');

    await client.query('COMMIT');
    console.log('✅ A/B Testing tables dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping A/B Testing tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'down') {
    down()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else {
    up()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }
}

module.exports = { up, down };
