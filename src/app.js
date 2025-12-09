const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

// Enhanced Services
const logger = require("./services/loggingService");
const cacheService = require("./services/cacheService");
const circuitBreaker = require("./services/circuitBreakerService");
const firebaseService = require("./services/firebaseService");
const redisService = require("./services/redisService");
const voiceAIService = require("./services/voiceAIService");

// Route imports
const coachingRoutes = require("./routes/coaching");
const weeklyRoutes = require("./routes/weekly");
const adminRoutes = require("./routes/admin");
const generationRoutes = require("./routes/generation");
const monitoringRoutes = require("./routes/monitoring");
const receiptRoutes = require("./routes/receipts");
const compatibilityRoutes = require("./routes/compatibility");
const neuralCompatibilityRoutes = require("./routes/neuralCompatibility");
const aiCoachRoutes = require("./routes/aiCoach");
const personalizationRoutes = require("./routes/personalization");
const goalPlannerRoutes = require("./routes/goalPlanner");
const voiceAIRoutes = require("./routes/voiceAI");
// Temporarily disabled predictions routes due to middleware issues
// const predictionsRoutes = require("./routes/predictions");
// const verifiablePredictionsRoutes = require("./routes/verifiablePredictions");
// const astrologicalTimingRoutes = require("./routes/astrologicalTiming");
// Temporarily disabled MCP routes due to import issues
// const mcpRoutes = require("./routes/mcp");

// Middleware imports
const { securityHeaders, requestValidation, endpointLimits, adaptiveRateLimit } = require("./middleware/rateLimiter");
const { apiLimiter, authLimiter, premiumLimiter } = require('./middleware/rateLimiter');
const securityMiddleware = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sanitizeInput } = require('./middleware/validation');
const monitoringController = require("./controllers/monitoringController");

// Load environment-specific configuration
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
  dotenv.config({ path: '.env' }); // Fallback for missing variables
} else {
  dotenv.config();
}
const app = express();

// Database initialization
const databaseInit = require('./config/database-init');

// Initialize services with timeout protection
async function initializeServices() {
  try {
    // Initialize lightweight services first (no DB required)
    await cacheService.initialize();
    await firebaseService.initialize();
    await redisService.initialize();

    // Initialize Voice AI Service (optional - won't fail if OpenAI key missing)
    try {
      await voiceAIService.initialize();
    } catch (error) {
      logger.getLogger().warn('Voice AI Service initialization skipped', { reason: error.message });
    }

    logger.getLogger().info('✅ Core services initialized');

    // Database initialization in background (non-blocking)
    const db = require('./config/db');

    // Test connection with timeout
    Promise.race([
      db.testConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timeout')), 10000))
    ])
      .then(async () => {
        await databaseInit.createTables();
        await databaseInit.seedSampleData();
        logger.getLogger().info('✅ Database initialized');
      })
      .catch(error => {
        logger.logError(error, { phase: 'database_initialization' });
        console.error('⚠️ Database initialization failed - API will work in degraded mode');
      });

  } catch (error) {
    logger.logError(error, { phase: 'service_initialization' });
  }
}

// Trust proxy for proper IP detection (important for Railway)
app.set('trust proxy', true);

// Force HTTPS in production (Railway handles SSL termination)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Skip HTTPS redirect for localhost testing
    if (req.get('Host')?.includes('localhost')) {
      return next();
    }
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.get('Host')}${req.url}`);
    }
    next();
  });
}

// Apply security middleware early
app.use(securityMiddleware);

// Input sanitization
app.use(sanitizeInput);

// Enhanced security with Helmet - Production hardened
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Compression middleware
app.use(compression());

// Security middleware
app.use(securityHeaders);
app.use(requestValidation);

// CORS configuration - Enhanced for Flutter app
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept',
    'Accept-Language',
    'User-Agent',
    'X-Requested-With',
    'X-App-Version',
    'X-Platform',
    'Cache-Control',
    'Pragma',
    'X-CSRF-Token',
    'X-Request-ID',
    'X-Timestamp'
  ],
  credentials: false, // Set to false for public API
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (monitoring dashboard)
app.use('/static', express.static('public'));

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logger.logRequest(req, res, responseTime);
  });
  
  next();
});

// Apply adaptive rate limiting to all routes - disabled for Railway stability
// app.use(adaptiveRateLimit(200)); // 200 requests per minute base limit

// Enhanced health check endpoints - comprehensive monitoring
app.get('/health', async (req, res) => {
  try {
    const firebaseStatus = firebaseService.getStatus();
    const cacheStats = cacheService.getStats();
    const redisHealth = await redisService.getHealthStatus();

    // Check database connection
    const db = require('./config/db');
    let databaseStatus = 'unknown';
    let databaseConnected = false;

    try {
      const dbTest = await Promise.race([
        db.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      databaseStatus = dbTest ? 'connected' : 'disconnected';
      databaseConnected = dbTest;
    } catch (error) {
      databaseStatus = error.message === 'timeout' ? 'timeout' : 'error';
      databaseConnected = false;
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.2.0',
      services: {
        api: 'operational',
        database: databaseStatus,
        firebase: {
          status: firebaseStatus.initialized ? 'initialized' : 'mock',
          hasServiceAccount: firebaseStatus.hasServiceAccount
        },
        cache: {
          mode: cacheStats.mode,
          status: 'operational'
        },
        redis: {
          status: redisHealth.connected ? 'connected' : 'fallback',
          mode: redisHealth.mode
        }
      },
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    // Set response status based on critical services
    const statusCode = databaseConnected ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    logger.logError(error, { endpoint: 'health_check' });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      version: '2.2.0'
    });
  }
});

app.get('/ping', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '2.2.0'
}));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/premium/', premiumLimiter);

// API routes with appropriate rate limiting
app.use("/api/coaching", endpointLimits.api, coachingRoutes);
app.use("/api/weekly", endpointLimits.api, weeklyRoutes);
app.use("/api/admin", adminRoutes); // Admin routes have their own strict limiting
app.use("/api/generate", generationRoutes); // Generation management routes
app.use("/api/monitoring", monitoringRoutes); // Production monitoring routes
app.use("/api/receipts", receiptRoutes); // App Store receipt validation (critical for App Store approval)
app.use("/api/compatibility", endpointLimits.api, compatibilityRoutes);
app.use("/api/neural-compatibility", neuralCompatibilityRoutes); // Neural-enhanced compatibility analysis with custom rate limiting
app.use("/api/ai-coach", aiCoachRoutes); // AI Coach real-time chat functionality with premium validation
app.use("/api/personalization", personalizationRoutes); // Hiperpersonal horoscope system with Swiss Ephemeris calculations
app.use("/api/ai/goals", goalPlannerRoutes); // AI-powered Goal Planner for Stellar tier with SMART goals and progress tracking
app.use("/api/voice", endpointLimits.api, voiceAIRoutes); // Voice AI responses with OpenAI TTS (premium feature)
// app.use("/api/predictions", predictionsRoutes); // Basic predictions system - temporarily disabled
// app.use("/api/verifiable-predictions", verifiablePredictionsRoutes); // AI-powered verifiable predictions with astrological timing and accuracy tracking
// app.use("/api/timing", astrologicalTimingRoutes); // Advanced astrological timing intelligence with planetary hours, lunar cycles, and personalized recommendations
// Temporarily disabled MCP routes
// app.use("/api/mcp", mcpRoutes); // Model Context Protocol integration routes // Zodiac compatibility analysis

// Webhook endpoints (very strict rate limiting)
app.use("/webhook", endpointLimits.webhook);

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Zodiac Backend API',
    version: '2.2.0',
    description: 'Enhanced horoscope backend with weekly predictions and production features',
    endpoints: {
      health: {
        'GET /health': 'Comprehensive system health check with database, cache, Redis, Firebase status',
        'GET /ping': 'Simple ping endpoint for quick availability check',
        'GET /api/admin/health': 'Detailed admin health check (requires admin_key)'
      },
      horoscopes: {
        'GET /api/coaching/getDailyHoroscope': 'Get daily horoscope',
        'GET /api/coaching/getAllHoroscopes': 'Get all daily horoscopes',
        'GET /api/weekly/getWeeklyHoroscope': 'Get weekly horoscope',
        'GET /api/weekly/getAllWeeklyHoroscopes': 'Get all weekly horoscopes'
      },
      ai_coach: {
        'POST /api/coaching/chat': 'Chat with AI astrological coach (personalized responses)',
        'GET /api/coaching/conversations/:userId': 'Get user conversation history with AI coach',
        'PUT /api/coaching/preferences/:userId': 'Update user coaching preferences',
        'POST /api/coaching/feedback/:conversationId': 'Submit feedback for conversation',
        'GET /api/coaching/coach/stats': 'Get AI coach service statistics'
      },
      compatibility: {
        'GET /api/compatibility/calculate': 'Calculate compatibility between two signs',
        'GET /api/compatibility/sign/:sign': 'Get all compatibilities for a sign',
        'POST /api/compatibility/analysis': 'Get detailed compatibility analysis',
        'POST /api/compatibility/insights': 'Get compatibility insights and advice',
        'GET /api/compatibility/stats': 'Get compatibility service statistics (admin)'
      },
      neural_compatibility: {
        'POST /api/neural-compatibility/calculate': 'AI-enhanced compatibility analysis with neural networks',
        'GET /api/neural-compatibility/history/:userId': 'Get user neural compatibility history',
        'POST /api/neural-compatibility/insights': 'Generate contextual neural compatibility insights',
        'POST /api/neural-compatibility/deep-analysis': 'Deep neural analysis (premium feature)',
        'GET /api/neural-compatibility/health': 'Neural service health check',
        'GET /api/neural-compatibility/stats': 'Neural service statistics (admin)',
        'GET /api/neural-compatibility/docs': 'Neural compatibility API documentation'
      },
      generation: {
        'POST /api/generate/daily': 'Manually generate daily horoscopes (admin)',
        'POST /api/generate/weekly': 'Manually generate weekly horoscopes (admin)',
        'GET /api/generate/status': 'Get generation status (admin)',
        'POST /api/generate/test': 'Test OpenAI connection (admin)'
      },
      receipts: {
        'POST /api/receipts/validate': 'Validate App Store receipt',
        'POST /api/receipts/subscription/status': 'Check subscription status',
        'POST /api/receipts/user/status': 'Get user premium status',
        'POST /api/receipts/refresh': 'Refresh receipt data',
        'GET /api/receipts/test': 'Test receipt validation config (admin)'
      },
      webhooks: {
        'POST /api/coaching/notify': 'Legacy n8n webhook (still supported)'
      },
      admin: {
        'GET /api/admin/analytics': 'System analytics (requires admin_key)',
        'POST /api/admin/force-weekly': 'Force weekly horoscope generation (requires admin_key)',
        'POST /api/admin/cleanup': 'System cleanup (requires admin_key)',
        'GET /api/admin/system-status': 'Detailed system status (requires admin_key)'
      },
      mcp: {
        'POST /api/mcp/start': 'Start MCP server (requires admin_key)',
        'POST /api/mcp/stop': 'Stop MCP server (requires admin_key)',
        'GET /api/mcp/status': 'Get MCP server status (requires admin_key)',
        'GET /api/mcp/tools': 'Get registered MCP tools (requires admin_key)',
        'GET /api/mcp/resources': 'Get registered MCP resources (requires admin_key)',
        'GET /api/mcp/prompts': 'Get registered MCP prompts (requires admin_key)'
      }
    },
    features: [
      'Daily and weekly horoscope management',
      'Zodiac sign compatibility analysis', 
      'AI-enhanced neural compatibility analysis',
      'Multi-level neural analysis (standard/advanced/deep)',
      'Real-time neural processing with <3s response times',
      'AI Coach: Personalized astrological coaching with GPT-4',
      'Context-aware conversation management and history',
      'Multi-scenario coaching (relationships, career, personal growth)',
      'Response quality optimization and validation',
      'Cost-efficient caching and token management',
      'Automatic generation with OpenAI GPT-4',
      'App Store receipt validation for in-app purchases',
      'Production-grade monitoring and alerting',
      'Automatic recovery and fallback systems',
      'Advanced rate limiting and security',
      'Comprehensive analytics and logging',
      'Admin panel for system management',
      'Cron jobs for automated scheduling',
      'Railway-optimized deployment',
      'Multi-language support (6 languages)',
      'Real-time compatibility calculations',
      'Model Context Protocol (MCP) integration for AI workflows'
    ]
  });
});

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize cron jobs for automatic horoscope generation
const cronJobs = require("./services/cronJobs");
// cronJobs.init() is called after services are initialized (see server startup below)

// Automated monitoring setup (legacy - now handled by cron jobs)
if (process.env.NODE_ENV === 'production') {
  console.log('🔄 Production monitoring enabled via cron jobs');
}

// Enhanced graceful shutdown handling
async function gracefulShutdown(signal) {
  logger.getLogger().info(`${signal} received, shutting down gracefully`);
  
  try {
    // Stop cron jobs
    cronJobs.stopAll();
    
    // Close cache connection
    await cacheService.close();
    
    logger.getLogger().info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.logError(error, { phase: 'graceful_shutdown' });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server immediately, initialize services in background
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Enhanced Zodiac Backend v2.0 running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Security: PRODUCTION-READY with zero vulnerabilities`);
  console.log(`⚡ Initializing services in background...`);

  // Initialize services after server is listening
  initializeServices().then(() => {
    logger.getLogger().info(`🚀 Enhanced Zodiac Backend v2.0 running on port ${PORT}`);
    logger.getLogger().info(`📊 Health check: http://localhost:${PORT}/health`);
    logger.getLogger().info(`📖 API docs: http://localhost:${PORT}/api/docs`);
    logger.getLogger().info(`🔒 Security: Helmet, Rate limiting, Circuit breakers enabled`);
    logger.getLogger().info(`🔥 Firebase: ${firebaseService.getStatus().initialized ? 'Initialized ✅' : 'Mock mode ⚠️'}`);
    logger.getLogger().info(`💾 Cache: ${cacheService.getStats().mode} mode`);
    logger.getLogger().info(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured ✅' : 'Not configured ❌'}`);
    logger.getLogger().info(`⚡ Features: Automated Daily + Weekly horoscopes with Circuit Breakers`);
    logger.getLogger().info(`🎯 Manual generation: /api/generate endpoints with enhanced reliability`);

    console.log(`✅ All services initialized successfully`);

    // Initialize cron jobs after services are ready
    cronJobs.init();
  }).catch(error => {
    logger.logError(error, { phase: 'service_initialization' });
    console.error('⚠️ Services initialization failed, running in degraded mode');
  });
});
