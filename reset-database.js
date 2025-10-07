#!/usr/bin/env node

/**
 * Database Reset Script
 * Drops all tables and reinitializes the database from scratch
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function resetDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting database reset...\n');

    // Drop all tables in reverse dependency order
    const tables = [
      'timing_intelligence_alerts',
      'timing_intelligence_cycles',
      'timing_intelligence_events',
      'user_birth_data',
      'prediction_feedbacks',
      'predictions',
      'ai_coach_chat_messages',
      'ai_coach_chat_sessions',
      'ai_coach_interactions',
      'receipt_validation_logs',
      'subscription_receipts',
      'analytics_events',
      'weekly_horoscopes',
      'daily_horoscopes',
      'database_migrations'
    ];

    console.log('🗑️  Dropping existing tables...');
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`   ✓ Dropped ${table}`);
    }

    console.log('\n✅ All tables dropped successfully!');
    console.log('\n📝 Now you can run the backend to recreate tables with migrations:');
    console.log('   NODE_ENV=production node src/app.js\n');

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase()
  .then(() => {
    console.log('✅ Database reset completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  });