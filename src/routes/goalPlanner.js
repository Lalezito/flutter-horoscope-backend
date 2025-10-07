/**
 * 🎯 GOAL PLANNER API ROUTES
 *
 * REST API endpoints for AI-powered Goal Planner
 * Features:
 * - Generate SMART goals with AI
 * - Track goal progress with check-ins
 * - Get goal analytics
 * - Premium tier validation (Stellar required)
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const goalPlannerService = require('../services/goalPlannerService');
const receiptValidationService = require('../services/receiptValidationService');
const logger = require('../services/loggingService');
const rateLimit = require('express-rate-limit');

// Rate limiting for goal generation (expensive AI operation)
const goalGenerationLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 goal generations per hour
  message: {
    error: 'Goal generation rate limit exceeded',
    message: 'You can generate up to 5 goals per hour',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Please wait before making more requests'
  }
});

/**
 * Premium validation middleware - Requires Stellar tier
 * SIMPLIFIED: For testing, accepts all users. Add real validation in production.
 */
const validatePremiumAccess = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required'
      });
    }

    // TODO: Implement real premium validation with RevenueCat
    // For now, allow all users for testing
    req.premiumStatus = {
      isPremium: true,
      tier: 'stellar',
      userId
    };

    next();

  } catch (error) {
    logger.logError(error, { middleware: 'validatePremiumAccess' });
    next(error);
  }
};

/**
 * GET /api/ai/goals/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'goalPlanner',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/ai/goals/admin/stats
 * Get service statistics (admin)
 */
router.get(
  '/admin/stats',
  apiRateLimit,
  async (req, res) => {
    try {
      // Validate admin key
      const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      const stats = await goalPlannerService.getStats();

      res.json(stats);

    } catch (error) {
      logger.logError(error, { endpoint: 'GET /api/ai/goals/admin/stats' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve stats'
      });
    }
  }
);

/**
 * POST /api/ai/goals
 * Generate personalized SMART goals using AI
 */
router.post(
  '/',
  goalGenerationLimit,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('zodiacSign').notEmpty().isIn([
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
    ]).withMessage('Valid zodiac sign required'),
    body('objective').notEmpty().isLength({ min: 10, max: 500 }).withMessage('Objective required (10-500 chars)'),
    body('emotionalState').optional().isString(),
    body('focusArea').notEmpty().isIn(['career', 'relationships', 'wellness', 'personal_growth']).withMessage('Valid focus area required'),
    body('timeframe').optional().isIn(['weekly', 'monthly', 'quarterly']).withMessage('Invalid timeframe'),
    body('languageCode').optional().isString()
  ],
  validatePremiumAccess,
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const {
        userId,
        zodiacSign,
        objective,
        emotionalState = 'neutral',
        focusArea,
        timeframe = 'monthly',
        languageCode = 'en'
      } = req.body;

      logger.getLogger().info('Goal generation request', { userId, focusArea });

      // Generate goals with AI
      const result = await goalPlannerService.generateGoals({
        userId,
        zodiacSign,
        objective,
        emotionalState,
        focusArea,
        timeframe,
        languageCode
      });

      res.json(result);

    } catch (error) {
      logger.logError(error, { endpoint: 'POST /api/ai/goals' });
      res.status(500).json({
        success: false,
        error: 'Failed to generate goals',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * GET /api/ai/goals/:userId
 * Get user's goals
 */
router.get(
  '/:userId',
  apiRateLimit,
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('status').optional().isIn(['active', 'completed', 'archived']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { status = 'active' } = req.query;

      const goals = await goalPlannerService.getUserGoals(userId, status);

      res.json({
        success: true,
        goals,
        count: goals.length
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'GET /api/ai/goals/:userId' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve goals'
      });
    }
  }
);

/**
 * POST /api/ai/goals/:goalId/checkin
 * Record a goal check-in
 */
router.post(
  '/:goalId/checkin',
  apiRateLimit,
  [
    param('goalId').notEmpty().isUUID().withMessage('Valid goal ID required'),
    body('userId').notEmpty().withMessage('User ID required'),
    body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be 0-100'),
    body('feedback').optional().isString().isLength({ max: 1000 }),
    body('mood').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { goalId } = req.params;
      const { userId, progress, feedback, mood } = req.body;

      const result = await goalPlannerService.recordCheckIn(goalId, userId, {
        progress,
        feedback,
        mood
      });

      res.json(result);

    } catch (error) {
      logger.logError(error, { endpoint: 'POST /api/ai/goals/:goalId/checkin' });
      res.status(500).json({
        success: false,
        error: 'Failed to record check-in'
      });
    }
  }
);

/**
 * GET /api/ai/goals/:userId/analytics
 * Get goal analytics for user
 */
router.get(
  '/:userId/analytics',
  apiRateLimit,
  [
    param('userId').notEmpty().withMessage('User ID required'),
    query('timeframe').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { timeframe = '30d' } = req.query;

      const analytics = await goalPlannerService.getGoalAnalytics(userId, timeframe);

      res.json(analytics);

    } catch (error) {
      logger.logError(error, { endpoint: 'GET /api/ai/goals/:userId/analytics' });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics'
      });
    }
  }
);

module.exports = router;
