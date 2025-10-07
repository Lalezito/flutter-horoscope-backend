const db = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * 🔄 DATABASE MIGRATION RUNNER
 * Runs database migrations in order and tracks execution
 */

// Create migration tracking table
const createMigrationTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_file VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT TRUE,
      error_message TEXT
    );
  `);
};

// Get executed migrations
const getExecutedMigrations = async () => {
  try {
    const result = await db.query(`
      SELECT migration_file FROM schema_migrations 
      WHERE success = TRUE 
      ORDER BY executed_at ASC
    `);
    return result.rows.map(row => row.migration_file);
  } catch (error) {
    // Table doesn't exist yet
    return [];
  }
};

// Record migration execution
const recordMigration = async (filename, executionTime, success, errorMessage = null) => {
  await db.query(`
    INSERT INTO schema_migrations (migration_file, execution_time_ms, success, error_message)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (migration_file) DO UPDATE SET
      executed_at = CURRENT_TIMESTAMP,
      execution_time_ms = EXCLUDED.execution_time_ms,
      success = EXCLUDED.success,
      error_message = EXCLUDED.error_message
  `, [filename, executionTime, success, errorMessage]);
};

// Run a single migration file
const runMigration = async (migrationPath) => {
  const filename = path.basename(migrationPath);
  console.log(`🔄 Running migration: ${filename}`);
  
  const startTime = Date.now();
  let success = true;
  let errorMessage = null;
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration SQL
    await db.query(sql);
    
    const executionTime = Date.now() - startTime;
    await recordMigration(filename, executionTime, success);
    
    console.log(`✅ Migration completed: ${filename} (${executionTime}ms)`);
    
  } catch (error) {
    success = false;
    errorMessage = error.message;
    const executionTime = Date.now() - startTime;
    
    await recordMigration(filename, executionTime, success, errorMessage);
    
    console.error(`❌ Migration failed: ${filename}`);
    console.error(`Error: ${errorMessage}`);
    throw error;
  }
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    console.log('🔄 Initializing migration system...');
    
    // Ensure migration table exists
    await createMigrationTable();
    
    // Get executed migrations
    const executed = await getExecutedMigrations();
    console.log(`📋 Already executed: ${executed.length} migrations`);
    
    // Get migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure order by filename
    
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    
    // Run pending migrations
    let pendingCount = 0;
    for (const file of migrationFiles) {
      if (!executed.includes(file)) {
        const migrationPath = path.join(migrationsDir, file);
        await runMigration(migrationPath);
        pendingCount++;
      }
    }
    
    if (pendingCount === 0) {
      console.log('✅ All migrations up to date');
    } else {
      console.log(`✅ Successfully ran ${pendingCount} migrations`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration system failed:', error);
    throw error;
  }
};

// Rollback last migration (for development)
const rollbackLastMigration = async () => {
  try {
    const result = await db.query(`
      SELECT migration_file FROM schema_migrations 
      WHERE success = TRUE 
      ORDER BY executed_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('ℹ️  No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].migration_file;
    console.log(`⚠️  Rolling back migration: ${lastMigration}`);
    
    // Mark as rolled back
    await db.query(`
      UPDATE schema_migrations 
      SET success = FALSE, error_message = 'Manually rolled back' 
      WHERE migration_file = $1
    `, [lastMigration]);
    
    console.log('✅ Migration rolled back successfully');
    console.log('⚠️  Note: This only marks the migration as not executed. Manual cleanup may be required.');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
};

// Get migration status
const getMigrationStatus = async () => {
  try {
    const result = await db.query(`
      SELECT 
        migration_file,
        executed_at,
        execution_time_ms,
        success,
        error_message
      FROM schema_migrations 
      ORDER BY executed_at DESC
    `);
    
    return result.rows;
  } catch (error) {
    return [];
  }
};

module.exports = {
  runMigrations,
  rollbackLastMigration,
  getMigrationStatus,
  runMigration
};