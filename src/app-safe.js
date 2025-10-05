const express = require("express");
const dotenv = require("dotenv");

// Load environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import Firebase service
let firebaseService;
try {
  firebaseService = require("./services/firebaseService");
} catch (error) {
  console.error('Firebase service import failed:', error.message);
  firebaseService = null;
}

// Trust proxy for Railway
app.set('trust proxy', true);

// Body parsing
app.use(express.json());

// Basic health endpoint
app.get('/health', (req, res) => {
  let firebaseStatus = { error: 'Firebase service not loaded' };

  if (firebaseService) {
    try {
      firebaseStatus = firebaseService.getStatus();
    } catch (error) {
      firebaseStatus = { error: error.message };
    }
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: firebaseStatus
    },
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasFirebase: !!process.env.FIREBASE_PROJECT_ID
    },
    uptime: process.uptime(),
    version: '2.0.1-safe-firebase'
  });
});

app.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    service: 'Zodiac Backend API',
    version: '2.0.0-safe',
    status: 'running',
    endpoints: ['/health', '/ping']
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Safe Zodiac Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health: http://localhost:${PORT}/health`);

  // Initialize Firebase after server is listening
  if (firebaseService) {
    try {
      await firebaseService.initialize();
      const status = firebaseService.getStatus();
      console.log(`🔥 Firebase: ${status.initialized ? 'Initialized ✅' : 'Mock mode ⚠️'}`);
      console.log(`📋 Firebase config: ${JSON.stringify(status)}`);
    } catch (error) {
      console.error('⚠️ Firebase initialization failed:', error.message);
    }
  } else {
    console.error('❌ Firebase service not available');
  }
});
