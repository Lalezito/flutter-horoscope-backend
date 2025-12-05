const express = require("express");
const router = express.Router();
const recoveryController = require("../controllers/recoveryController");
const monitoringController = require("../controllers/monitoringController");
const { endpointLimits } = require("../middleware/rateLimiter");

// Apply strict rate limiting to all admin endpoints
router.use(endpointLimits.admin);

/**
 * @route GET /api/admin/health
 * @description Comprehensive system health check
 */
router.get("/health", monitoringController.healthCheck);

/**
 * @route GET /api/admin/analytics
 * @description Get system analytics dashboard
 * @query {string} admin_key - Admin authentication key (required)
 */
router.get("/analytics", monitoringController.getAnalytics);

/**
 * @route POST /api/admin/force-weekly
 * @description Force generation of missing weekly horoscopes
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/force-weekly", recoveryController.forceWeeklyGeneration);

/**
 * @route POST /api/admin/cleanup
 * @description Clean up old data and perform maintenance
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/cleanup", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Perform various cleanup tasks
    const tasks = [
      { name: 'analytics_cleanup', task: () => monitoringController.cleanupAnalytics() },
      { name: 'rate_limit_cleanup', task: () => require("../middleware/rateLimiter").cleanupRateLimitData() }
    ];

    const results = [];
    
    for (const { name, task } of tasks) {
      try {
        await task();
        results.push({ task: name, status: 'completed' });
      } catch (error) {
        results.push({ task: name, status: 'failed', error: error.message });
      }
    }

    // Clean up old horoscopes (keep last 7 days of dailies, 4 weeks of weeklies)
    try {
      const db = require("../config/db");
      
      const cleanDaily = await db.query(`
        DELETE FROM daily_horoscopes 
        WHERE date < CURRENT_DATE - INTERVAL '7 days'
      `);
      
      const cleanWeekly = await db.query(`
        DELETE FROM weekly_horoscopes 
        WHERE week_start < CURRENT_DATE - INTERVAL '28 days'
      `);
      
      results.push({
        task: 'horoscope_cleanup',
        status: 'completed',
        dailies_deleted: cleanDaily.rowCount,
        weeklies_deleted: cleanWeekly.rowCount
      });
      
    } catch (error) {
      results.push({ 
        task: 'horoscope_cleanup', 
        status: 'failed', 
        error: error.message 
      });
    }

    res.json({
      success: true,
      message: 'Cleanup tasks completed',
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin cleanup error:', error);
    res.status(500).json({ 
      error: 'Cleanup failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/admin/system-status
 * @description Get detailed system status and metrics
 * @query {string} admin_key - Admin authentication key (required)
 */
router.get("/system-status", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const db = require("../config/db");
    const { getRateLimitStats } = require("../middleware/rateLimiter");
    
    // Get comprehensive system status
    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodejs_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      
      // Database stats
      database: {},
      
      // Content stats
      content: {},
      
      // Rate limiting stats
      rate_limiting: getRateLimitStats(),
      
      // Recent errors
      recent_errors: []
    };

    // Get database table sizes and recent data
    const tableStats = await db.query(`
      SELECT
        schemaname,
        relname as tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        last_autovacuum,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);
    
    status.database.tables = tableStats.rows;

    // Get content coverage
    const dailyCoverage = await db.query(`
      SELECT COUNT(*) as count 
      FROM daily_horoscopes 
      WHERE date = CURRENT_DATE
    `);
    
    const weeklyCoverage = await db.query(`
      SELECT COUNT(*) as count 
      FROM weekly_horoscopes 
      WHERE week_start = date_trunc('week', CURRENT_DATE)
    `);
    
    status.content = {
      daily_horoscopes_today: parseInt(dailyCoverage.rows[0].count),
      weekly_horoscopes_current: parseInt(weeklyCoverage.rows[0].count),
      expected_daily: 72,
      expected_weekly: 72,
      daily_coverage: Math.round((parseInt(dailyCoverage.rows[0].count) / 72) * 100),
      weekly_coverage: Math.round((parseInt(weeklyCoverage.rows[0].count) / 72) * 100)
    };

    // Get recent errors
    const recentErrors = await db.query(`
      SELECT error_type, error_message, timestamp, context
      FROM error_logs 
      WHERE timestamp > CURRENT_DATE - INTERVAL '24 hours'
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    
    status.recent_errors = recentErrors.rows;

    res.json(status);

  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ 
      error: 'Failed to get system status',
      message: error.message
    });
  }
});

/**
 * @route POST /api/admin/test-alert
 * @description Test alert system
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/test-alert", async (req, res) => {
  const { admin_key } = req.query;
  const { message, type = 'info' } = req.body;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await monitoringController.sendAlert(
      message || 'Test alert from admin panel',
      type,
      { test: true, timestamp: new Date().toISOString() }
    );
    
    res.json({
      success: true,
      message: 'Test alert sent successfully',
      alert_type: type
    });

  } catch (error) {
    console.error('Test alert error:', error);
    res.status(500).json({ 
      error: 'Failed to send test alert',
      message: error.message
    });
  }
});

module.exports = router;