const db = require('./db');
const migrationRunner = require('./migration-runner');

/**
 * 🗄️ DATABASE INITIALIZATION SCRIPT
 * Creates necessary tables if they don't exist and runs migrations
 */

const createTables = async () => {
  try {
    console.log('🔄 Initializing database tables...');

    // Create daily_horoscopes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS daily_horoscopes (
        id SERIAL PRIMARY KEY,
        sign VARCHAR(50) NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        date DATE NOT NULL,
        general TEXT,
        content TEXT,
        daily TEXT,
        weekly TEXT,
        monthly TEXT,
        yearly TEXT,
        love_rating INTEGER DEFAULT 3,
        work_rating INTEGER DEFAULT 3,
        health_rating INTEGER DEFAULT 3,
        money_rating INTEGER DEFAULT 3,
        overall_rating INTEGER DEFAULT 3,
        lucky_number VARCHAR(10),
        lucky_color VARCHAR(50),
        mood VARCHAR(100),
        advice TEXT,
        keywords TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sign, language_code, date)
      );
    `);
    
    // Create weekly_horoscopes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS weekly_horoscopes (
        id SERIAL PRIMARY KEY,
        sign VARCHAR(50) NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        content TEXT,
        weekly TEXT,
        predictions TEXT,
        love_rating INTEGER DEFAULT 3,
        work_rating INTEGER DEFAULT 3,
        health_rating INTEGER DEFAULT 3,
        money_rating INTEGER DEFAULT 3,
        overall_rating INTEGER DEFAULT 3,
        lucky_numbers TEXT,
        lucky_colors TEXT,
        advice TEXT,
        keywords TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sign, language_code, week_start)
      );
    `);

    // Create receipt_validations table for App Store receipts
    await db.query(`
      CREATE TABLE IF NOT EXISTS receipt_validations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        receipt_data TEXT NOT NULL,
        validation_status VARCHAR(50),
        is_valid BOOLEAN DEFAULT FALSE,
        environment VARCHAR(20),
        bundle_id VARCHAR(255),
        product_ids TEXT[],
        transaction_ids TEXT[],
        expires_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET
      );
    `);

    // Create system_status table for monitoring
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_status (
        id SERIAL PRIMARY KEY,
        service_name VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create fcm_tokens table for push notifications
    await db.query(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        fcm_token TEXT NOT NULL,
        device_type VARCHAR(50),
        device_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_horoscopes_date_sign_lang 
      ON daily_horoscopes(date, sign, language_code);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_horoscopes_week_sign_lang 
      ON weekly_horoscopes(week_start, sign, language_code);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_receipt_validations_user_id
      ON receipt_validations(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id
      ON fcm_tokens(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_fcm_tokens_device_id
      ON fcm_tokens(device_id);
    `);

    console.log('✅ Database tables initialized successfully');
    
    // Run migrations after basic table creation
    console.log('🔄 Running database migrations...');
    await migrationRunner.runMigrations();
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
};

// Function to seed some sample data if tables are empty
const seedSampleData = async () => {
  try {
    // Check if we have any daily horoscopes
    const result = await db.query('SELECT COUNT(*) FROM daily_horoscopes WHERE date = CURRENT_DATE');
    const count = parseInt(result.rows[0].count);
    
    if (count === 0) {
      console.log('🌱 Seeding sample horoscope data...');
      
      const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                     'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
      const languages = ['en', 'es', 'de', 'fr', 'it', 'pt'];
      
      for (const sign of signs) {
        for (const lang of languages) {
          // Check if the record already exists to avoid conflicts
          const existing = await db.query(`
            SELECT sign FROM daily_horoscopes 
            WHERE sign = $1 AND language_code = $2 AND date = CURRENT_DATE
          `, [sign, lang]);
          
          if (existing.rows.length === 0) {
            await db.query(`
              INSERT INTO daily_horoscopes 
              (sign, language_code, date, general, daily, love_rating, work_rating, health_rating, money_rating, overall_rating, lucky_number, lucky_color, mood, advice, keywords)
              VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
              sign,
              lang,
              `Today's ${sign} horoscope in ${lang}. The stars are aligned for positive energy and new opportunities.`,
              `Your ${sign} daily prediction. Focus on personal growth and embrace the changes coming your way.`,
              Math.floor(Math.random() * 5) + 1, // love_rating
              Math.floor(Math.random() * 5) + 1, // work_rating  
              Math.floor(Math.random() * 5) + 1, // health_rating
              Math.floor(Math.random() * 5) + 1, // money_rating
              Math.floor(Math.random() * 5) + 1, // overall_rating
              Math.floor(Math.random() * 99) + 1, // lucky_number
              ['Gold', 'Silver', 'Blue', 'Green', 'Red', 'Purple'][Math.floor(Math.random() * 6)], // lucky_color
              ['Optimistic', 'Energetic', 'Calm', 'Focused', 'Creative'][Math.floor(Math.random() * 5)], // mood
              'Trust your instincts today and take positive action toward your goals.',
              'Success, Growth, Opportunity, Change, Wisdom'
            ]);
          }
        }
      }
      
      console.log('✅ Sample data seeded successfully');
    }
  } catch (error) {
    console.error('❌ Sample data seeding failed:', error);
  }
};

module.exports = {
  createTables,
  seedSampleData
};