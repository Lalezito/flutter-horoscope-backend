/**
 * 🗄️ CREATE FCM TOKENS TABLE
 * Script to create fcm_tokens table in Railway PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const SQL_CREATE_TABLE = `
-- Create FCM tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  fcm_token TEXT NOT NULL,
  device_type VARCHAR(50) DEFAULT 'unknown',
  device_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indices
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_fcm_token ON fcm_tokens(fcm_token);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_created_at ON fcm_tokens(created_at);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER trigger_update_fcm_tokens_updated_at
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_tokens_updated_at();
`;

async function createTable() {
  const client = await pool.connect();

  try {
    console.log('🔌 Connecting to Railway PostgreSQL...');

    // Execute SQL
    console.log('📊 Creating fcm_tokens table...');
    await client.query(SQL_CREATE_TABLE);
    console.log('✅ fcm_tokens table created successfully!');

    // Verify table exists
    console.log('\n🔍 Verifying table structure...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'fcm_tokens'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Table structure:');
    console.table(result.rows);

    // Verify indices
    const indices = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'fcm_tokens'
    `);

    console.log('\n🔑 Indices created:');
    indices.rows.forEach(idx => {
      console.log(`  ✅ ${idx.indexname}`);
    });

    // Verify trigger
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'fcm_tokens'
    `);

    console.log('\n⚡ Triggers created:');
    triggers.rows.forEach(trg => {
      console.log(`  ✅ ${trg.trigger_name}`);
    });

    console.log('\n🎉 FCM tokens table setup complete!');

  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
createTable()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
