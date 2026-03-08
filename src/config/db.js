// Database Configuration with Resilience
// Auto-reconnection, connection pooling, circuit breakers, and retry logic

const { Pool } = require("pg");
const dotenv = require('dotenv');

// Load environment variables
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
  dotenv.config({ path: '.env' });
} else {
  dotenv.config();
}

// Import resilience utilities (with fallback if not available)
let resilientDatabaseQuery, circuitBreakers, logger;

try {
  const resilience = require('./resilience');
  resilientDatabaseQuery = resilience.resilientDatabaseQuery;
  circuitBreakers = resilience.circuitBreakers;
} catch (e) {
  // Fallback if resilience module not available
  resilientDatabaseQuery = async (fn) => fn();
  circuitBreakers = {
    database: {
      execute: async (fn) => fn(),
      getState: () => ({ state: 'DISABLED', failures: 0 })
    }
  };
}

try {
  logger = require('../services/loggingService');
} catch (e) {
  // Fallback logger
  logger = {
    getLogger: () => ({
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: () => {}
    }),
    logError: (err, ctx) => console.error('Error:', err.message, ctx)
  };
}

let pool = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000;

/**
 * Create database connection pool with resilient configuration
 */
function createPool() {
  if (!pool) {
    // // console.log('🔄 Creating resilient database connection pool...');
    // // console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

    const poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
      } : false,

      // Enhanced connection pool settings
      max: parseInt(process.env.DATABASE_POOL_MAX) || (process.env.NODE_ENV === 'production' ? 15 : 10),
      min: parseInt(process.env.DATABASE_POOL_MIN) || (process.env.NODE_ENV === 'production' ? 5 : 2),

      // Timeout configuration
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
      query_timeout: 90000,

      // Advanced pool settings
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      createRetryIntervalMillis: 200,
      reapIntervalMillis: 1000,
      fifo: false,

      // Application name for monitoring
      application_name: 'zodiac-backend'
    };

    pool = new Pool(poolConfig);

    // Enhanced error handling with auto-reconnection
    pool.on('error', async (err) => {
      logger.logError(err, {
        context: 'database_pool_error',
        reconnectAttempts,
        poolSize: pool?.totalCount || 0
      });

      // Critical errors that require reconnection
      const criticalErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'Connection terminated'];
      const isCritical = criticalErrors.some(code =>
        err.code === code || err.message?.includes(code)
      );

      if (isCritical && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        await attemptReconnection();
      }
    });

    // Connection lifecycle events
    pool.on('connect', (client) => {
      reconnectAttempts = 0;
      // // console.log('✅ Connected to PostgreSQL database');
      logger.getLogger().info('Database client connected', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      });

      // Set application-level connection parameters
      client.query('SET application_name = $1', ['zodiac-backend']).catch(() => {});
    });

    pool.on('acquire', () => {
      logger.getLogger().debug('Database client acquired', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      });
    });

    pool.on('remove', () => {
      logger.getLogger().debug('Database client removed', {
        totalCount: pool?.totalCount || 0,
        idleCount: pool?.idleCount || 0
      });
    });

    logger.getLogger().info('Database pool created successfully', {
      maxConnections: poolConfig.max,
      minConnections: poolConfig.min,
      environment: process.env.NODE_ENV
    });
  }

  return pool;
}

/**
 * Attempt to reconnect to database with exponential backoff
 */
async function attemptReconnection() {
  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts - 1), 30000);

  logger.getLogger().warn(`Attempting database reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, {
    delay,
    nextAttempt: new Date(Date.now() + delay).toISOString()
  });

  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    // Destroy old pool
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }

    // Create new pool
    createPool();

    // Test connection
    await testConnection();

    logger.getLogger().info('Database reconnection successful', {
      attempts: reconnectAttempts
    });

    reconnectAttempts = 0;
  } catch (error) {
    logger.logError(error, {
      context: 'reconnection_failed',
      attempts: reconnectAttempts
    });

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      await attemptReconnection();
    } else {
      logger.getLogger().error('Max reconnection attempts reached', {
        maxAttempts: MAX_RECONNECT_ATTEMPTS
      });
    }
  }
}

/**
 * Test database connection with circuit breaker
 */
async function testConnection() {
  try {
    return await circuitBreakers.database.execute(async () => {
      const client = await getPool().connect();
      try {
        const result = await client.query('SELECT NOW() as now');
        // // console.log('✅ Database connection test successful');
        logger.getLogger().info('Database connection test successful', {
          serverTime: result.rows[0].now
        });
        return true;
      } finally {
        client.release();
      }
    });
  } catch (err) {
    console.error('❌ Database connection test failed:', err.message);
    return false;
  }
}

/**
 * Execute query with resilience and circuit breaker
 */
async function query(text, params) {
  return circuitBreakers.database.execute(async () => {
    return resilientDatabaseQuery(async () => {
      const start = Date.now();
      try {
        const result = await getPool().query(text, params);
        const duration = Date.now() - start;

        // Log slow queries
        if (duration > 5000) {
          logger.getLogger().warn('Slow query detected', {
            duration,
            query: text.substring(0, 100),
            rowCount: result.rowCount
          });
        }

        return result;
      } catch (error) {
        logger.logError(error, {
          context: 'database_query',
          query: text.substring(0, 100),
          params: params ? params.length : 0
        });
        throw error;
      }
    }, 'database query');
  });
}

/**
 * Get a client from the pool with resilience
 */
async function connect() {
  return circuitBreakers.database.execute(async () => {
    return resilientDatabaseQuery(async () => {
      return getPool().connect();
    }, 'database connection');
  });
}

/**
 * Close all connections
 */
async function end() {
  if (pool) {
    logger.getLogger().info('Closing database pool');
    await pool.end();
    pool = null;
    logger.getLogger().info('Database pool closed successfully');
  }
}

/**
 * Get pool statistics for monitoring
 */
function getPoolStats() {
  if (!pool) {
    return {
      status: 'not_initialized',
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0
    };
  }

  return {
    status: 'active',
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    reconnectAttempts,
    circuitBreakerState: circuitBreakers.database.getState()
  };
}

/**
 * Lazy getter for the pool
 */
function getPool() {
  return createPool();
}

/**
 * Health check for monitoring endpoints
 */
async function healthCheck() {
  try {
    await testConnection();
    const stats = getPoolStats();
    return {
      status: 'healthy',
      ...stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      reconnectAttempts,
      circuitBreakerState: circuitBreakers.database.getState().state,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  query,
  connect,
  end,
  testConnection,
  getPool,
  getPoolStats,
  healthCheck
};