/**
 * ================================================================================
 * ANALYTICS ADMIN API ROUTES
 * ================================================================================
 *
 * Comprehensive API endpoints for analytics dashboard
 * Provides real-time metrics, revenue analytics, cohort analysis, and more
 *
 * Authentication: Requires admin access token
 */

const express = require('express');
const router = express.Router();
const analyticsEngine = require('../services/analyticsEngine');
const logger = require('../services/loggingService');

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Admin authentication middleware
 * TODO: Implement proper admin authentication
 */
const requireAdmin = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];

  if (!adminToken || adminToken !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin access required'
    });
  }

  next();
};

// Apply admin auth to all routes
router.use(requireAdmin);

// ============================================================================
// DASHBOARD & REAL-TIME METRICS
// ============================================================================

/**
 * GET /api/analytics/realtime
 * Get real-time metrics dashboard
 */
router.get('/realtime', async (req, res) => {
  try {
    const metrics = await analyticsEngine.getRealtimeMetrics();

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/realtime'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch real-time metrics',
      message: error.message
    });
  }
});

// ============================================================================
// REVENUE ANALYTICS
// ============================================================================

/**
 * GET /api/analytics/revenue
 * Get comprehensive revenue breakdown
 * Query params:
 *   - period: '7days', '30days', '90days', 'all'
 */
router.get('/revenue', async (req, res) => {
  try {
    const revenue = await analyticsEngine.getRevenueBreakdown();

    res.json({
      success: true,
      data: revenue
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/revenue'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/revenue/predictions
 * Get revenue predictions
 * Query params:
 *   - months: Number of months to predict (default: 6)
 */
router.get('/revenue/predictions', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;

    if (months < 1 || months > 24) {
      return res.status(400).json({
        success: false,
        error: 'Invalid months parameter',
        message: 'Months must be between 1 and 24'
      });
    }

    const predictions = await analyticsEngine.predictRevenue(months);

    res.json({
      success: true,
      data: predictions
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/revenue/predictions'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate revenue predictions',
      message: error.message
    });
  }
});

// ============================================================================
// USER COHORT ANALYSIS
// ============================================================================

/**
 * GET /api/analytics/cohorts
 * Analyze user cohorts
 * Query params:
 *   - period: '30days', '90days', '1year'
 *   - groupBy: 'signup_date', 'zodiac_sign', 'country', 'language'
 */
router.get('/cohorts', async (req, res) => {
  try {
    const { period = '30days', groupBy = 'signup_date' } = req.query;

    const validPeriods = ['30days', '90days', '1year'];
    const validGroupBy = ['signup_date', 'zodiac_sign', 'country', 'language'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period parameter',
        message: `Period must be one of: ${validPeriods.join(', ')}`
      });
    }

    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid groupBy parameter',
        message: `GroupBy must be one of: ${validGroupBy.join(', ')}`
      });
    }

    const cohorts = await analyticsEngine.analyzeUserCohorts({
      period,
      groupBy
    });

    res.json({
      success: true,
      data: cohorts
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/cohorts'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to analyze cohorts',
      message: error.message
    });
  }
});

// ============================================================================
// FEATURE USAGE ANALYTICS
// ============================================================================

/**
 * GET /api/analytics/features
 * Analyze feature usage and engagement
 * Query params:
 *   - timeRange: '7days', '30days', '90days'
 */
router.get('/features', async (req, res) => {
  try {
    const { timeRange = '30days' } = req.query;

    const validTimeRanges = ['7days', '30days', '90days'];

    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeRange parameter',
        message: `TimeRange must be one of: ${validTimeRanges.join(', ')}`
      });
    }

    const features = await analyticsEngine.analyzeFeatureUsage({ timeRange });

    res.json({
      success: true,
      data: features
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/features'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to analyze feature usage',
      message: error.message
    });
  }
});

// ============================================================================
// A/B TESTING
// ============================================================================

/**
 * GET /api/analytics/ab-tests
 * Get A/B test results
 * Query params:
 *   - experimentId: Specific experiment ID (optional)
 */
router.get('/ab-tests', async (req, res) => {
  try {
    const { experimentId } = req.query;

    const results = await analyticsEngine.getABTestResults(
      experimentId ? parseInt(experimentId) : null
    );

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/ab-tests'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch A/B test results',
      message: error.message
    });
  }
});

// ============================================================================
// INSIGHTS & ALERTS
// ============================================================================

/**
 * GET /api/analytics/insights
 * Get automated insights and recommendations
 */
router.get('/insights', async (req, res) => {
  try {
    const insights = await analyticsEngine.generateInsights();

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/insights'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate insights',
      message: error.message
    });
  }
});

// ============================================================================
// EVENT TRACKING
// ============================================================================

/**
 * POST /api/analytics/events
 * Track custom analytics event
 * Body:
 *   - userId: User ID
 *   - eventType: Event type
 *   - eventCategory: Event category
 *   - properties: Event properties (object)
 *   - metadata: Additional metadata (object)
 */
router.post('/events', async (req, res) => {
  try {
    const {
      userId,
      eventType,
      eventCategory,
      properties = {},
      metadata = {}
    } = req.body;

    if (!userId || !eventType || !eventCategory) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'userId, eventType, and eventCategory are required'
      });
    }

    await analyticsEngine.trackEvent(
      userId,
      eventType,
      eventCategory,
      properties,
      metadata
    );

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/events'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to track event',
      message: error.message
    });
  }
});

// ============================================================================
// EXPORT & REPORTS
// ============================================================================

/**
 * GET /api/analytics/export/revenue
 * Export revenue data as CSV
 * Query params:
 *   - period: '30days', '90days', '1year'
 */
router.get('/export/revenue', async (req, res) => {
  try {
    const { period = '30days' } = req.query;

    // Get revenue data
    const revenue = await analyticsEngine.getRevenueBreakdown();

    // Convert to CSV
    const csv = convertRevenueToCSV(revenue);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-report-${period}.csv"`);
    res.send(csv);

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/export/revenue'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export revenue data',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/export/cohorts
 * Export cohort data as CSV
 */
router.get('/export/cohorts', async (req, res) => {
  try {
    const { period = '30days', groupBy = 'signup_date' } = req.query;

    // Get cohort data
    const cohorts = await analyticsEngine.analyzeUserCohorts({ period, groupBy });

    // Convert to CSV
    const csv = convertCohortsToCSV(cohorts);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cohorts-${groupBy}-${period}.csv"`);
    res.send(csv);

  } catch (error) {
    logger.logError(error, {
      route: 'analytics',
      endpoint: '/export/cohorts'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export cohort data',
      message: error.message
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert revenue data to CSV format
 */
function convertRevenueToCSV(revenue) {
  const lines = [];

  // Header
  lines.push('Metric,Value');

  // Overall metrics
  lines.push(`MRR,${revenue.mrr}`);
  lines.push(`ARR,${revenue.arr}`);

  // Tier breakdown
  lines.push('');
  lines.push('Tier,Subscribers,MRR,Churn Rate,LTV');

  Object.entries(revenue.byTier || {}).forEach(([tier, data]) => {
    lines.push(`${tier},${data.subscribers},${data.mrr},${data.churnRate},${data.ltv}`);
  });

  // Growth metrics
  lines.push('');
  lines.push('Growth Metric,Value');
  lines.push(`MoM Growth,${revenue.growthMetrics?.momGrowth || 0}%`);
  lines.push(`CAC,$${revenue.growthMetrics?.cac || 0}`);
  lines.push(`LTV:CAC Ratio,${revenue.growthMetrics?.ltvcacRatio || 0}`);

  return lines.join('\n');
}

/**
 * Convert cohort data to CSV format
 */
function convertCohortsToCSV(cohorts) {
  const lines = [];

  if (!cohorts.cohorts || cohorts.cohorts.length === 0) {
    return 'No data available';
  }

  // Determine headers based on groupBy
  if (cohorts.groupBy === 'signup_date') {
    lines.push('Cohort,Total Users,Day 1 Retention,Day 7 Retention,Day 30 Retention,Day 90 Retention,LTV,Premium Conversion Rate');

    cohorts.cohorts.forEach(cohort => {
      lines.push([
        cohort.cohort,
        cohort.totalUsers,
        `${cohort.retention?.day1 || 0}%`,
        `${cohort.retention?.day7 || 0}%`,
        `${cohort.retention?.day30 || 0}%`,
        `${cohort.retention?.day90 || 0}%`,
        `$${cohort.ltv || 0}`,
        `${cohort.premiumConversionRate || 0}%`
      ].join(','));
    });
  } else if (cohorts.groupBy === 'zodiac_sign') {
    lines.push('Zodiac Sign,Total Users,Engagement,Avg Session,Premium Conversion Rate');

    cohorts.cohorts.forEach(cohort => {
      lines.push([
        cohort.sign,
        cohort.totalUsers,
        cohort.engagement,
        cohort.avgSessionLength,
        `${cohort.premiumConversionRate || 0}%`
      ].join(','));
    });
  } else {
    // Generic format
    lines.push('Category,Total Users,Premium Users,Avg LTV,Conversion Rate');

    cohorts.cohorts.forEach(cohort => {
      lines.push([
        cohort.country || cohort.language || cohort.sign || 'Unknown',
        cohort.totalUsers,
        cohort.premiumUsers || 0,
        `$${cohort.avgLTV || 0}`,
        `${cohort.conversionRate || 0}%`
      ].join(','));
    });
  }

  return lines.join('\n');
}

module.exports = router;
