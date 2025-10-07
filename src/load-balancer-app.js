/**
 * DEDICATED LOAD BALANCER APPLICATION
 * 
 * This is a specialized instance that only handles load balancing
 * and doesn't run the full application stack
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load balancer specific services
const redisService = require('./services/redisService');
const loadBalancerService = require('./services/loadBalancerService');
const productionMonitoring = require('./controllers/productionMonitoringController');

dotenv.config();
const app = express();

// Trust proxy headers
app.set('trust proxy', true);

// Basic middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Initialize services
let servicesReady = false;

async function initializeServices() {
  try {
    console.log('🔧 Initializing load balancer services...');
    
    // Initialize Redis
    await redisService.initialize();
    
    // Initialize load balancer
    await loadBalancerService.initialize();
    
    servicesReady = true;
    console.log('✅ Load balancer services initialized');
    
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    process.exit(1);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  if (!servicesReady) {
    return res.status(503).json({
      status: 'initializing',
      message: 'Services are still starting up'
    });
  }
  
  try {
    const redisHealth = await redisService.getHealthStatus();
    const lbStatus = await loadBalancerService.getLoadBalancerStatus();
    
    const health = {
      status: 'healthy',
      service: 'load-balancer',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      redis: redisHealth,
      load_balancer: {
        instances: lbStatus.total_instances,
        healthy_instances: lbStatus.healthy_instances,
        algorithm: lbStatus.algorithm
      }
    };
    
    res.json(health);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Load balancer status endpoint
app.get('/status', async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    const status = await loadBalancerService.getLoadBalancerStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scaling recommendations endpoint
app.get('/scaling', async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    const recommendations = await loadBalancerService.getScalingRecommendations();
    res.json({
      timestamp: new Date().toISOString(),
      recommendations: recommendations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Main proxy endpoint - handles all other requests
app.all('*', async (req, res) => {
  if (!servicesReady) {
    return res.status(503).json({
      error: 'Load balancer is not ready',
      retry_after: 5
    });
  }
  
  try {
    // Prepare request for proxying
    const proxyRequest = {
      method: req.method,
      path: req.path,
      query: req.url.includes('?') ? req.url.split('?')[1] : '',
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      sessionId: req.headers['x-session-id'] || req.cookies?.sessionId
    };
    
    // Proxy the request
    const result = await loadBalancerService.proxyRequest(proxyRequest);
    
    // Set response headers
    Object.keys(result.headers || {}).forEach(header => {
      if (!header.toLowerCase().startsWith('x-') || header.toLowerCase() === 'x-response-time') {
        res.set(header, result.headers[header]);
      }
    });
    
    // Add load balancer headers
    res.set({
      'X-Load-Balancer': 'zodiac-lb',
      'X-Instance-Id': result.instanceId,
      'X-Response-Time': result.responseTime + 'ms'
    });
    
    res.status(result.statusCode).json(result.data);
    
  } catch (error) {
    console.error('Proxy request failed:', error);
    
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'All backend instances are unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Load balancer error:', error);
  
  res.status(500).json({
    error: 'Load balancer error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down load balancer...');
  
  try {
    await loadBalancerService.shutdown();
    await redisService.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down load balancer...');
  
  try {
    await loadBalancerService.shutdown();
    await redisService.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
});

// Start server
const PORT = process.env.PORT || 3000;

initializeServices().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Load Balancer running on port ${PORT}`);
    console.log(`🎯 Proxying requests to backend instances`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
    console.log(`📈 Scaling endpoint: http://localhost:${PORT}/scaling`);
  });
});

module.exports = app;