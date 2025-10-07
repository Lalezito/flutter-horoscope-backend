/**
 * 🔍 VERIFY FCM TABLE DATA
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyData() {
  const client = await pool.connect();

  try {
    console.log('🔍 Querying fcm_tokens table...\n');

    // Get all records
    const result = await client.query('SELECT * FROM fcm_tokens ORDER BY created_at DESC LIMIT 5');

    console.log(`📊 Total records: ${result.rowCount}`);
    console.log('\n📋 Latest entries:');
    console.table(result.rows);

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await client.query("DELETE FROM fcm_tokens WHERE device_id = 'test_device_verification_001'");
    console.log('✅ Test data cleaned');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
