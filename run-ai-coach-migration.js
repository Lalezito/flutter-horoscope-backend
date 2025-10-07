/**
 * 🚀 AI COACH DATABASE MIGRATION RUNNER
 * 
 * Runs the AI Coach chat tables migration script
 */

const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

async function runMigration() {
  try {
    console.log('🔄 Starting AI Coach database migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_create_ai_coach_chat_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');

    // Test database connection
    console.log('🔍 Testing database connection...');
    await db.testConnection();

    // Run the migration
    console.log('⚡ Executing migration...');
    await db.query(migrationSQL);

    console.log('✅ AI Coach migration completed successfully!');

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('chat_sessions', 'chat_messages')
      ORDER BY table_name;
    `);

    console.log(`📋 Created tables: ${tableCheck.rows.map(row => row.table_name).join(', ')}`);

    // Check table structure
    const sessionColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chat_sessions' 
      ORDER BY ordinal_position;
    `);

    console.log('📊 Chat Sessions table columns:');
    sessionColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    const messageColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' 
      ORDER BY ordinal_position;
    `);

    console.log('📊 Chat Messages table columns:');
    messageColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Check indexes
    const indexes = await db.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('chat_sessions', 'chat_messages') 
      AND schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    console.log('🔍 Created indexes:');
    indexes.rows.forEach(idx => {
      console.log(`   - ${idx.tablename}.${idx.indexname}`);
    });

    // Check views
    const views = await db.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%chat%'
      ORDER BY table_name;
    `);

    console.log('👀 Created views:');
    views.rows.forEach(view => {
      console.log(`   - ${view.table_name}`);
    });

    console.log('\n🎉 AI Coach database setup completed successfully!');
    console.log('🚀 You can now start using the AI Coach API endpoints');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };