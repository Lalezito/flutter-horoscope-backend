const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");

// Load environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import services with error handling
let logger, cacheService, firebaseService;

try {
  logger = require("./services/loggingService");
} catch (e) {
  console.log('⚠️ Logger service not available, using console');
  logger = {
    getLogger: () => ({ info: console.log, error: console.error }),
    logError: (err, ctx) => console.error('Error:', err.message, ctx),
    logRequest: (req, res, time) => console.log(`${req.method} ${req.path} - ${res.statusCode} (${time}ms)`)
  };
}

try {
  cacheService = require("./services/cacheService");
} catch (e) {
  console.log('⚠️ Cache service not available');
  cacheService = {
    initialize: async () => {},
    getStats: () => ({ mode: 'unavailable' })
  };
}

try {
  firebaseService = require("./services/firebaseService");
} catch (e) {
  console.log('⚠️ Firebase service not available');
  firebaseService = {
    initialize: async () => {},
    getStatus: () => ({ initialized: false, error: 'Service not loaded' })
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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  next();
});

// Health endpoint with service status
app.get('/health', (req, res) => {
  try {
    const firebaseStatus = firebaseService.getStatus();
    const cacheStats = cacheService.getStats();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
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
      version: '2.1.0-production'
    };

    res.json(health);
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
    version: '2.1.0-production'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Zodiac Backend API - Production',
    version: '2.1.0-production',
    status: 'running',
    endpoints: {
      health: '/health',
      ping: '/ping',
      api: '/api/*'
    }
  });
});

// API routes - load conditionally
try {
  const coachingRoutes = require("./routes/coaching");
  app.use("/api/coaching", coachingRoutes);
  console.log('✅ Coaching routes loaded');
} catch (e) {
  console.log('⚠️ Coaching routes not available:', e.message);
}

try {
  const weeklyRoutes = require("./routes/weekly");
  app.use("/api/weekly", weeklyRoutes);
  console.log('✅ Weekly routes loaded');
} catch (e) {
  console.log('⚠️ Weekly routes not available:', e.message);
}

try {
  const compatibilityRoutes = require("./routes/compatibility");
  app.use("/api/compatibility", compatibilityRoutes);
  console.log('✅ Compatibility routes loaded');
} catch (e) {
  console.log('⚠️ Compatibility routes not available:', e.message);
}

try {
  const receiptRoutes = require("./routes/receipts");
  app.use("/api/receipts", receiptRoutes);
  console.log('✅ Receipt validation routes loaded');
} catch (e) {
  console.log('⚠️ Receipt routes not available:', e.message);
}

try {
  const adminRoutes = require("./routes/admin");
  app.use("/api/admin", adminRoutes);
  console.log('✅ Admin routes loaded');
} catch (e) {
  console.log('⚠️ Admin routes not available:', e.message);
}

try {
  const monitoringRoutes = require("./routes/monitoring");
  app.use("/api/monitoring", monitoringRoutes);
  console.log('✅ Monitoring routes loaded');
} catch (e) {
  console.log('⚠️ Monitoring routes not available:', e.message);
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: ['/health', '/ping', '/api/*']
  });
});

// Global error handler
app.use((error, req, res, next) => {
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
async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  try {
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

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Zodiac Backend Production v2.1.0 running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health: http://localhost:${PORT}/health`);

  // Initialize services after server is listening
  try {
    await cacheService.initialize();
    console.log('✅ Cache service initialized');
  } catch (error) {
    console.error('⚠️ Cache initialization failed:', error.message);
  }

  try {
    await firebaseService.initialize();
    const status = firebaseService.getStatus();
    console.log(`🔥 Firebase: ${status.initialized ? 'Initialized ✅' : 'Mock mode ⚠️'}`);
  } catch (error) {
    console.error('⚠️ Firebase initialization failed:', error.message);
  }

  console.log('✅ Server ready to accept requests');
});
