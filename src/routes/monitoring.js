/**
 * PRODUCTION MONITORING ROUTES
 * 
 * Endpoints for real-time monitoring, alerts, and dashboard
 */

const express = require('express');
const router = express.Router();
const productionMonitoring = require('../controllers/productionMonitoringController');
const { endpointLimits } = require('../middleware/rateLimiter');

// Apply monitoring-specific rate limits
router.use(endpointLimits.api);

/**
 * @route GET /monitoring/health
 * @desc Comprehensive production health check
 * @access Public
 */
router.get('/health', productionMonitoring.comprehensiveHealthCheck.bind(productionMonitoring));

/**
 * @route GET /monitoring/dashboard
 * @desc Real-time monitoring dashboard (admin only)
 * @access Private - requires admin_key
 */
router.get('/dashboard', productionMonitoring.getMonitoringDashboard.bind(productionMonitoring));

/**
 * @route GET /monitoring/metrics/realtime
 * @desc Real-time system metrics
 * @access Private - requires admin_key
 */
router.get('/metrics/realtime', async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const metrics = await productionMonitoring.getRealTimeMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get real-time metrics', message: error.message });
  }
});

/**
 * @route GET /monitoring/sla
 * @desc SLA compliance status
 * @access Private - requires admin_key
 */
router.get('/sla', async (req, res) => {
  const { admin_key, timeframe = '24h' } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const slaStatus = await productionMonitoring.getSLAStatus(timeframe);
    res.json(slaStatus);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get SLA status', message: error.message });
  }
});

/**
 * @route GET /monitoring/alerts
 * @desc Get active system alerts
 * @access Private - requires admin_key
 */
router.get('/alerts', async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const alerts = await productionMonitoring.getActiveAlerts();
    res.json({
      timestamp: new Date().toISOString(),
      active_alerts: alerts.length,
      alerts: alerts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alerts', message: error.message });
  }
});

/**
 * @route POST /monitoring/alerts/test
 * @desc Test alert system
 * @access Private - requires admin_key
 */
router.post('/alerts/test', async (req, res) => {
  const { admin_key } = req.query;
  const { message = 'Test alert from monitoring system', level = 'info' } = req.body;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await productionMonitoring.sendAlert(message, level, {
      test: true,
      timestamp: new Date().toISOString(),
      initiated_by: req.ip
    });
    
    res.json({
      success: true,
      message: 'Test alert sent successfully',
      alert: { message, level }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test alert', message: error.message });
  }
});

/**
 * @route GET /monitoring/performance/trends
 * @desc Performance trends over time
 * @access Private - requires admin_key
 */
router.get('/performance/trends', async (req, res) => {
  const { admin_key, timeframe = '24h' } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const trends = await productionMonitoring.getPerformanceTrends(timeframe);
    res.json({
      timeframe: timeframe,
      data_points: trends.length,
      trends: trends
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance trends', message: error.message });
  }
});

/**
 * @route GET /monitoring/capacity
 * @desc System capacity and scaling metrics
 * @access Private - requires admin_key
 */
router.get('/capacity', async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const capacity = await productionMonitoring.getCapacityMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      capacity: capacity
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get capacity metrics', message: error.message });
  }
});

/**
 * @route GET /monitoring/errors
 * @desc Error analytics and patterns
 * @access Private - requires admin_key
 */
router.get('/errors', async (req, res) => {
  const { admin_key, timeframe = '24h' } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const errors = await productionMonitoring.getErrorAnalytics(timeframe);
    res.json({
      timeframe: timeframe,
      error_types: errors.length,
      errors: errors
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get error analytics', message: error.message });
  }
});

/**
 * @route GET /monitoring/api-usage
 * @desc API usage patterns and statistics
 * @access Private - requires admin_key
 */
router.get('/api-usage', async (req, res) => {
  const { admin_key, timeframe = '24h' } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const usage = await productionMonitoring.getApiUsagePatterns(timeframe);
    res.json({
      timeframe: timeframe,
      endpoints: usage.length,
      usage_patterns: usage
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get API usage patterns', message: error.message });
  }
});

/**
 * @route GET /monitoring/uptime
 * @desc System uptime and availability
 * @access Public (limited info) / Private (detailed info with admin_key)
 */
router.get('/uptime', async (req, res) => {
  const { admin_key } = req.query;
  const isAdmin = admin_key === process.env.ADMIN_KEY;

  try {
    const uptimeData = {
      uptime_seconds: Math.round(process.uptime()),
      uptime_human: formatUptime(process.uptime()),
      started_at: new Date(Date.now() - (process.uptime() * 1000)).toISOString(),
      status: 'operational'
    };

    if (isAdmin) {
      // Add detailed admin-only information
      const slaStatus = await productionMonitoring.getSLAStatus('24h');
      uptimeData.sla_compliance = slaStatus;
      uptimeData.system_info = {
        node_version: process.version,
        platform: process.platform,
        pid: process.pid,
        memory_usage: process.memoryUsage()
      };
    }

    res.json(uptimeData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get uptime information', message: error.message });
  }
});

/**
 * @route POST /monitoring/manual-check
 * @desc Trigger manual health check
 * @access Private - requires admin_key
 */
router.post('/manual-check', async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Create a mock request/response for the health check
    const mockReq = { ip: req.ip, get: () => req.get('User-Agent') };
    const mockRes = {
      status: (code) => mockRes,
      json: (data) => data
    };

    const healthResult = await productionMonitoring.comprehensiveHealthCheck(mockReq, mockRes);
    
    res.json({
      success: true,
      message: 'Manual health check completed',
      initiated_by: req.ip,
      timestamp: new Date().toISOString(),
      result: healthResult
    });
  } catch (error) {
    res.status(500).json({ error: 'Manual health check failed', message: error.message });
  }
});

// Helper function to format uptime in human readable format
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${secs}s`;
  
  return result.trim();
}

module.exports = router;