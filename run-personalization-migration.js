#!/usr/bin/env node
/**
 * RUN PERSONALIZATION MIGRATION
 * 
 * Script to run the personalization system database migration
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runPersonalizationMigration() {
    console.log('🚀 Running Personalization System Migration...\n');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', '007_create_user_birth_data_tables.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executing migration: 007_create_user_birth_data_tables.sql');
        
        // Execute migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify tables were created
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'user_birth_data', 'user_birth_chart', 'personalized_horoscopes', 'user_horoscope_preferences')
            ORDER BY table_name
        `);
        
        console.log('\n📊 Created Tables:');
        tableCheck.rows.forEach(row => {
            console.log(`  ✅ ${row.table_name}`);
        });
        
        // Check if indexes were created
        const indexCheck = await pool.query(`
            SELECT schemaname, tablename, indexname 
            FROM pg_indexes 
            WHERE tablename IN ('users', 'user_birth_data', 'user_birth_chart', 'personalized_horoscopes', 'user_horoscope_preferences')
            ORDER BY tablename, indexname
        `);
        
        console.log('\n🔍 Created Indexes:');
        let currentTable = '';
        indexCheck.rows.forEach(row => {
            if (row.tablename !== currentTable) {
                console.log(`  Table: ${row.tablename}`);
                currentTable = row.tablename;
            }
            console.log(`    - ${row.indexname}`);
        });

        // Insert test admin user if not exists
        const adminCheck = await pool.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
        if (adminCheck.rows.length === 0) {
            await pool.query(`
                INSERT INTO users (username, email, role, status, subscription_status) 
                VALUES ('admin', 'admin@zodiac-system.local', 'super_admin', 'active', 'premium_plus')
            `);
            console.log('\n👤 Created default admin user');
        }

        console.log('\n🎉 Personalization system database setup complete!');
        console.log('\n📋 Next Steps:');
        console.log('1. Start the server: npm start');
        console.log('2. Run tests: node test-personalization-system.js');
        console.log('3. Configure Swiss Ephemeris data files if needed');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    runPersonalizationMigration().catch(console.error);
}

module.exports = runPersonalizationMigration;