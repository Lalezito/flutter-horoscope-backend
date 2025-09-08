const express = require("express");
const router = express.Router();
const horoscopeGenerator = require("../services/horoscopeGenerator");
const cronJobs = require("../services/cronJobs");
const { endpointLimits } = require("../middleware/rateLimiter");

// Apply strict rate limiting to generation endpoints
router.use(endpointLimits.admin);

/**
 * @route POST /api/generate/daily
 * @description Manually trigger daily horoscope generation
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/daily", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🎯 Manual daily generation triggered');
    const startTime = Date.now();
    const results = await cronJobs.triggerDailyGeneration();
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      type: 'daily',
      results: {
        generated: results.success,
        errors: results.errors,
        total_expected: 72,
        coverage: Math.round((results.success / 72) * 100),
        duration_ms: duration,
        duration_seconds: Math.round(duration / 1000)
      },
      details: results.details,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual daily generation error:', error);
    res.status(500).json({ 
      error: 'Daily generation failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/generate/weekly
 * @description Manually trigger weekly horoscope generation
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/weekly", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🎯 Manual weekly generation triggered');
    const startTime = Date.now();
    const results = await cronJobs.triggerWeeklyGeneration();
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      type: 'weekly',
      results: {
        generated: results.success,
        errors: results.errors,
        total_expected: 72,
        coverage: Math.round((results.success / 72) * 100),
        duration_ms: duration,
        duration_seconds: Math.round(duration / 1000)
      },
      details: results.details,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual weekly generation error:', error);
    res.status(500).json({ 
      error: 'Weekly generation failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/generate/status
 * @description Get generation status and statistics
 * @query {string} admin_key - Admin authentication key (required)
 */
router.get("/status", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const stats = await horoscopeGenerator.getGenerationStats();
    const jobsStatus = cronJobs.getJobsStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      statistics: stats,
      cron_jobs: jobsStatus,
      openai_configured: !!process.env.OPENAI_API_KEY,
      generation_ready: !!process.env.OPENAI_API_KEY && stats !== null
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      error: 'Status check failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/generate/cron/start
 * @description Start all cron jobs (admin)
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/cron/start", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    cronJobs.startAll();
    const status = cronJobs.getJobsStatus();
    
    res.json({
      success: true,
      message: 'All cron jobs started',
      status: status
    });

  } catch (error) {
    console.error('Cron start error:', error);
    res.status(500).json({ 
      error: 'Failed to start cron jobs',
      message: error.message
    });
  }
});

/**
 * @route POST /api/generate/cron/stop
 * @description Stop all cron jobs (admin)
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/cron/stop", async (req, res) => {
  const { admin_key } = req.query;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    cronJobs.stopAll();
    const status = cronJobs.getJobsStatus();
    
    res.json({
      success: true,
      message: 'All cron jobs stopped',
      status: status
    });

  } catch (error) {
    console.error('Cron stop error:', error);
    res.status(500).json({ 
      error: 'Failed to stop cron jobs',
      message: error.message
    });
  }
});

/**
 * @route POST /api/generate/test
 * @description Test OpenAI connection with single horoscope
 * @query {string} admin_key - Admin authentication key (required)
 */
router.post("/test", async (req, res) => {
  const { admin_key } = req.query;
  const { sign = 'Aries', language = 'es' } = req.body;
  
  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const languageObj = { code: language, name: language === 'es' ? 'español' : 'english' };
    const date = new Date().toISOString().split('T')[0];
    
    console.log(`🧪 Testing OpenAI connection for ${sign} in ${language}`);
    const startTime = Date.now();
    
    const horoscope = await horoscopeGenerator.generateDailyHoroscope(sign, languageObj, date);
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'OpenAI connection test successful',
      test_result: horoscope,
      duration_ms: duration,
      openai_model: 'gpt-4',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    res.status(500).json({ 
      error: 'OpenAI test failed',
      message: error.message,
      details: error.response?.data || error.stack
    });
  }
});

module.exports = router;