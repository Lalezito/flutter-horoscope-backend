// Load environment variables first
const dotenv = require('dotenv');
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
  dotenv.config({ path: '.env' }); // Fallback for missing variables
} else {
  dotenv.config();
}

const { Pool } = require("pg");

let pool = null;

// Function to create the pool with current environment variables
function createPool() {
  if (!pool) {
    console.log('🔄 Creating database connection pool...');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
      } : false,
      // Optimized connection pool settings for production
      max: process.env.DATABASE_POOL_MAX || (process.env.NODE_ENV === 'production' ? 25 : 10),
      min: process.env.DATABASE_POOL_MIN || (process.env.NODE_ENV === 'production' ? 5 : 2),
      idleTimeoutMillis: process.env.NODE_ENV === 'production' ? 60000 : 30000,
      connectionTimeoutMillis: 15000, // Increased for production stability
      query_timeout: process.env.DATABASE_QUERY_TIMEOUT || 90000, // Longer for complex queries
      acquireTimeoutMillis: 30000, // Time to wait for connection from pool
      createTimeoutMillis: 30000, // Time to wait for new connection creation
      createRetryIntervalMillis: 200, // Retry interval for connection creation
      reapIntervalMillis: 1000, // How often to check for idle connections
      fifo: false, // Use LIFO for better cache locality
    });

    // Enhanced error handling
    pool.on('error', (err) => {
      console.error('⚠️ Unexpected error on idle client:', err.message);
      console.error('Stack:', err.stack);
      // DO NOT exit process - let pool handle reconnection
      // Log error for monitoring but keep server running
    });

    pool.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database');
    });
  }
  return pool;
}

// Test database connection
async function testConnection() {
  try {
    const client = await getPool().connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection test successful');
    return true;
  } catch (err) {
    console.error('❌ Database connection test failed:', err.message);
    return false;
  }
}

// Lazy getter for the pool
function getPool() {
  return createPool();
}

module.exports = {
  query: (...args) => getPool().query(...args),
  connect: () => getPool().connect(),
  end: () => pool ? pool.end() : Promise.resolve(),
  testConnection: testConnection,
  getPool: getPool
};
