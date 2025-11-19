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
      version: '2.2.0'
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
    console.log(`✅ ${description} loaded`);
    return true;
  } catch (e) {
    loadedRoutes.push({ path, description, status: 'failed', error: e.message });
    console.log(`⚠️ ${description} not available:`, e.message);
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
  console.log(`🚀 Zodiac Backend Production v2.2.0 running on port ${PORT}`);
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
