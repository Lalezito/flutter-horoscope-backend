const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");
const Sentry = require("@sentry/node");

// Load environment
dotenv.config();

// Validate critical environment variables
const requiredEnvVars = ['DATABASE_URL'];
const recommendedEnvVars = ['OPENAI_API_KEY', 'NODE_ENV'];
const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
const missingRecommended = recommendedEnvVars.filter(v => !process.env[v]);
if (missingRequired.length > 0) {
  console.error(`CRITICAL: Missing required env vars: ${missingRequired.join(', ')}`);
}
if (missingRecommended.length > 0) {
  console.warn(`Warning: Missing recommended env vars: ${missingRecommended.join(', ')}`);
}

// Initialize Sentry for error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: true,
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  });
  // // console.log('🛡️ Sentry error tracking initialized');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Import services with error handling
let logger, cacheService, firebaseService;

try {
  logger = require("./services/loggingService");
} catch (e) {
  // // console.log('⚠️ Logger service not available, using console');
  logger = {
    getLogger: () => ({ info: console.log, error: console.error }),
    logError: (err, ctx) => console.error('Error:', err.message, ctx),
    logRequest: (req, res, time) => // // console.log(`${req.method} ${req.path} - ${res.statusCode} (${time}ms)`)
  };
}

try {
  cacheService = require("./services/cacheService");
} catch (e) {
  // // console.log('⚠️ Cache service not available');
  cacheService = {
    initialize: async () => {},
    getStats: () => ({ mode: 'unavailable' })
  };
}

try {
  firebaseService = require("./services/firebaseService");
} catch (e) {
  // // console.log('⚠️ Firebase service not available');
  firebaseService = {
    initialize: async () => {},
    getStatus: () => ({ initialized: false, error: 'Service not loaded' })
  };
}

// Database initialization
let databaseInit;
try {
  databaseInit = require("./config/database-init");
} catch (e) {
  // // console.log('⚠️ Database init not available');
  databaseInit = {
    createTables: async () => // // console.log('Database init skipped')
  };
}

// Cron jobs for automatic horoscope generation
let cronJobs;
try {
  cronJobs = require("./services/cronJobs");
} catch (e) {
  // // console.log('⚠️ Cron jobs service not available');
  cronJobs = {
    init: () => // // console.log('Cron jobs skipped')
  };
}

// Trust proxy for Railway
app.set('trust proxy', true);

// Security with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Simplified for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key']
}));

// Compression
app.use(compression());

// Rate limiting - protect against abuse
const { apiLimiter, authLimiter, premiumLimiter } = require('./middleware/rateLimiter');
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/premium/', premiumLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout - prevent hanging requests
app.use('/api/', (req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout', timeout: '30s' });
    }
  });
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  next();
});

// Health endpoint with service status (includes database check)
app.get('/health', async (req, res) => {
  try {
    const firebaseStatus = firebaseService.getStatus();
    const cacheStats = cacheService.getStats();

    // Database health check with 5s timeout
    let dbHealth = { status: 'unknown' };
    try {
      const db = require('./config/db');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      dbHealth = await Promise.race([db.healthCheck(), timeoutPromise]);
    } catch (dbError) {
      dbHealth = { status: 'unhealthy', error: dbError.message };
    }

    const isHealthy = dbHealth.status === 'healthy';

    const health = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        firebase: firebaseStatus,
        cache: cacheStats
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasFirebase: !!process.env.FIREBASE_PROJECT_ID
      },
      uptime: process.uptime(),
      version: '2.2.0'
    };

    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.logError(error, { endpoint: 'health' });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.2.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Zodiac Backend API - Production',
    version: '2.2.0',
    status: 'running',
    endpoints: {
      health: '/health',
      ping: '/ping',
      api: '/api/*'
    }
  });
});

// Load API routes before defining error handlers
const loadedRoutes = [];

// Helper function to load routes safely
function loadRoute(path, routePath, description) {
  try {
    const route = require(routePath);
    app.use(path, route);
    loadedRoutes.push({ path, description, status: 'loaded' });
    // // console.log(`✅ ${description} loaded`);
    return true;
  } catch (e) {
    loadedRoutes.push({ path, description, status: 'failed', error: e.message });
    // // console.log(`⚠️ ${description} not available:`, e.message);
    return false;
  }
}

// Load all routes
loadRoute('/api/coaching', './routes/coaching', 'Coaching routes');
loadRoute('/api/weekly', './routes/weekly', 'Weekly routes');
loadRoute('/api/compatibility', './routes/compatibility', 'Compatibility routes');
loadRoute('/api/receipts', './routes/receipts', 'Receipt validation routes');
loadRoute('/api/admin', './routes/admin', 'Admin routes');
loadRoute('/api/monitoring', './routes/monitoring', 'Monitoring routes');
loadRoute('/api/notifications', './routes/notification', 'Notification routes');
loadRoute('/api/neural-compatibility', './routes/neuralCompatibility', 'Neural Compatibility routes');
loadRoute('/api/ai-coach', './routes/aiCoach', 'AI Coach real-time chat with horoscopeData');
loadRoute('/api/ai/goals', './routes/goalPlanner', 'Goal Planner routes (Stellar Premium)');
loadRoute('/api/generate', './routes/generation', 'Horoscope Generation routes (Admin)');

// Routes status endpoint
app.get('/api/routes', (req, res) => {
  res.json({
    total: loadedRoutes.length,
    loaded: loadedRoutes.filter(r => r.status === 'loaded').length,
    failed: loadedRoutes.filter(r => r.status === 'failed').length,
    routes: loadedRoutes
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: ['/health', '/ping', '/api/*']
  });
});

// Global error handler with Sentry
app.use((error, req, res, next) => {
  // Send error to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: {
        url: req.url,
        method: req.method,
        ip: req.ip,
        body: req.body
      }
    });
  }

  logger.logError(error, {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
let server; // Populated in app.listen callback

async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);

  // Force exit after 30s if graceful shutdown hangs
  const forceTimer = setTimeout(() => {
    console.error('Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
  forceTimer.unref();

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Close database pool
    const db = require('./config/db');
    await db.end();
    // Close cache
    await cacheService.close?.();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections (prevents silent crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  logger.logError(reason instanceof Error ? reason : new Error(String(reason)), {
    type: 'unhandledRejection'
  });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});

// Catch uncaught exceptions (log + exit — process is in undefined state)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.logError(error, { type: 'uncaughtException' });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  // Must exit — process state is unreliable after uncaught exception
  process.exit(1);
});

// Start server
server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Zodiac Backend Production v2.2.0 running on port ${PORT}`);

  // Initialize services after server is listening
  try {
    await cacheService.initialize();
  } catch (error) {
    console.error('Cache initialization failed:', error.message);
  }

  try {
    await firebaseService.initialize();
  } catch (error) {
    console.error('Firebase initialization failed:', error.message);
  }

  // Initialize database tables — cron jobs depend on this
  let dbReady = false;
  try {
    await databaseInit.createTables();
    dbReady = true;
  } catch (error) {
    console.error('Database initialization failed:', error.message);
  }

  // Only start cron jobs if database initialized successfully
  if (dbReady) {
    try {
      cronJobs.init();
    } catch (error) {
      console.error('Cron jobs initialization failed:', error.message);
    }
  } else {
    console.error('Cron jobs skipped — database not ready');
  }

  console.log('Server ready to accept requests');
});
