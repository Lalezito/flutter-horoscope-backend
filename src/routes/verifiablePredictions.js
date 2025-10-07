/**
 * 🔮 VERIFIABLE PREDICTIONS API ROUTES
 * 
 * REST API endpoints for AI-powered verifiable prediction system
 * Features: prediction generation, outcome tracking, analytics, feedback
 */

const express = require('express');
const router = express.Router();
const verifiablePredictionController = require('../controllers/verifiablePredictionController');
const { authenticateUser } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

// Rate limiting for prediction generation (more restrictive)
const predictionRateLimit = rateLimiter.createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 predictions per hour per user
  message: 'Too many prediction requests. Please wait before requesting more predictions.',
  keyGenerator: (req) => `predictions:${req.user?.id || req.ip}`
});

// Standard rate limiting for other endpoints
const standardRateLimit = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 100, // 100 requests per 15 minutes
  keyGenerator: (req) => `pred_api:${req.user?.id || req.ip}`
});

/**
 * 🎯 GENERATE VERIFIABLE PREDICTIONS
 * POST /api/verifiable-predictions/generate
 * 
 * Generates highly specific, testable predictions using AI and astrology
 */
router.post('/generate',
  predictionRateLimit,
  authenticateUser,
  [
    // Validation rules
    body('birthData').optional().isObject(),
    body('birthData.birthDate').optional().isISO8601(),
    body('birthData.birthTime').optional().isObject(),
    body('birthData.birthLocation').optional().isObject(),
    body('preferredAreas').optional().isArray(),
    body('language').optional().isIn(['en', 'es']).withMessage('Language must be en or es'),
    body('preferences').optional().isObject(),
    body('specificityLevel').optional().isIn(['standard', 'high', 'premium']),
    body('maxPredictions').optional().isInt({ min: 1, max: 8 })
  ],
  validateRequest,
  verifiablePredictionController.generatePredictions
);

/**
 * 📋 GET USER PREDICTIONS  
 * GET /api/verifiable-predictions
 * 
 * Retrieves user's current and past predictions with filtering
 */
router.get('/',
  standardRateLimit,
  authenticateUser,
  [
    query('status').optional().isIn(['active', 'expired', 'completed', 'all']),
    query('category').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('sortBy').optional().isIn(['created_at', 'confidence', 'expires_at']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  validateRequest,
  verifiablePredictionController.getUserPredictions
);

/**
 * 🔍 GET SINGLE PREDICTION
 * GET /api/verifiable-predictions/:predictionId
 * 
 * Retrieves detailed information about a specific prediction
 */
router.get('/:predictionId',
  standardRateLimit,
  authenticateUser,
  [
    param('predictionId').isUUID().withMessage('Invalid prediction ID format')
  ],
  validateRequest,
  verifiablePredictionController.getSinglePrediction
);

/**
 * ✅ UPDATE PREDICTION OUTCOME
 * PUT /api/verifiable-predictions/:predictionId/outcome
 * 
 * Records whether a prediction came true for accuracy tracking
 */
router.put('/:predictionId/outcome',
  standardRateLimit,
  authenticateUser,
  [
    param('predictionId').isUUID().withMessage('Invalid prediction ID format'),
    body('outcome').isIn(['verified', 'false', 'partial', 'unclear']).withMessage('Invalid outcome value'),
    body('userFeedback').optional().isString().isLength({ max: 1000 }),
    body('details').optional().isString().isLength({ max: 2000 }),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('wasHelpful').optional().isBoolean()
  ],
  validateRequest,
  verifiablePredictionController.updatePredictionOutcome
);

/**
 * 📊 GET PREDICTION ANALYTICS
 * GET /api/verifiable-predictions/analytics
 * 
 * Retrieves user's prediction accuracy statistics and insights
 */
router.get('/analytics/summary',
  standardRateLimit,
  authenticateUser,
  [
    query('timeframe').optional().isIn(['7 days', '30 days', '90 days', '1 year']),
    query('category').optional().isString(),
    query('includeComparison').optional().isBoolean(),
    query('includeRecommendations').optional().isBoolean()
  ],
  validateRequest,
  verifiablePredictionController.getPredictionAnalytics
);

/**
 * 📈 GET ACCURACY TRENDS
 * GET /api/verifiable-predictions/analytics/trends
 * 
 * Retrieves accuracy trends over time for charts and insights
 */
router.get('/analytics/trends',
  standardRateLimit,
  authenticateUser,
  [
    query('category').optional().isString(),
    query('period').optional().isIn(['daily', 'weekly', 'monthly']),
    query('daysBack').optional().isInt({ min: 7, max: 365 })
  ],
  validateRequest,
  verifiablePredictionController.getAccuracyTrends
);

/**
 * ⚙️ GET/UPDATE USER PREFERENCES
 * GET /api/verifiable-predictions/preferences
 */
router.get('/preferences',
  standardRateLimit,
  authenticateUser,
  verifiablePredictionController.getUserPreferences
);

/**
 * PUT /api/verifiable-predictions/preferences
 */
router.put('/preferences',
  standardRateLimit,
  authenticateUser,
  [
    body('preferredCategories').optional().isArray(),
    body('timeframePreference').optional().isIn(['short', 'balanced', 'long']),
    body('specificityLevel').optional().isIn(['low', 'medium', 'high']),
    body('feedbackNotifications').optional().isBoolean(),
    body('emailReminders').optional().isBoolean(),
    body('maxActivePredictions').optional().isInt({ min: 1, max: 20 })
  ],
  validateRequest,
  verifiablePredictionController.updateUserPreferences
);

/**
 * 💬 SUBMIT PREDICTION FEEDBACK
 * POST /api/verifiable-predictions/:predictionId/feedback
 * 
 * Submit detailed feedback about prediction quality and relevance
 */
router.post('/:predictionId/feedback',
  standardRateLimit,
  authenticateUser,
  [
    param('predictionId').isUUID().withMessage('Invalid prediction ID format'),
    body('feedbackType').isIn(['accuracy', 'relevance', 'timing', 'general']),
    body('rating').isInt({ min: 1, max: 5 }),
    body('feedbackText').optional().isString().isLength({ max: 1000 }),
    body('isHelpful').optional().isBoolean(),
    body('suggestedImprovement').optional().isString().isLength({ max: 500 })
  ],
  validateRequest,
  verifiablePredictionController.submitPredictionFeedback
);

/**
 * 🔄 EXTEND PREDICTION DEADLINE
 * PUT /api/verifiable-predictions/:predictionId/extend
 * 
 * Extends the verification deadline for a prediction (limited usage)
 */
router.put('/:predictionId/extend',
  standardRateLimit,
  authenticateUser,
  [
    param('predictionId').isUUID().withMessage('Invalid prediction ID format'),
    body('extensionDays').isInt({ min: 1, max: 7 }).withMessage('Extension must be 1-7 days'),
    body('reason').optional().isString().isLength({ max: 200 })
  ],
  validateRequest,
  verifiablePredictionController.extendPredictionDeadline
);

/**
 * ❌ CANCEL PREDICTION
 * DELETE /api/verifiable-predictions/:predictionId
 * 
 * Cancels an active prediction (marks as cancelled)
 */
router.delete('/:predictionId',
  standardRateLimit,
  authenticateUser,
  [
    param('predictionId').isUUID().withMessage('Invalid prediction ID format'),
    body('reason').optional().isString().isLength({ max: 300 })
  ],
  validateRequest,
  verifiablePredictionController.cancelPrediction
);

/**
 * 🌟 GET PREDICTION EXAMPLES
 * GET /api/verifiable-predictions/examples
 * 
 * Returns example predictions for each category (for UI education)
 */
router.get('/examples/categories',
  standardRateLimit,
  [
    query('language').optional().isIn(['en', 'es']),
    query('category').optional().isString()
  ],
  validateRequest,
  verifiablePredictionController.getPredictionExamples
);

/**
 * 📱 GET NOTIFICATION REMINDERS
 * GET /api/verifiable-predictions/reminders
 * 
 * Gets predictions that need user attention (expiring, completed but not verified)
 */
router.get('/reminders/pending',
  standardRateLimit,
  authenticateUser,
  verifiablePredictionController.getPendingReminders
);

/**
 * 🎲 GET QUICK PREDICTION
 * POST /api/verifiable-predictions/quick
 * 
 * Generates a single quick prediction without full birth chart (simplified)
 */
router.post('/quick',
  predictionRateLimit,
  authenticateUser,
  [
    body('category').optional().isString(),
    body('timeframe').optional().isIn(['today', 'tomorrow', '3days', 'week']),
    body('language').optional().isIn(['en', 'es'])
  ],
  validateRequest,
  verifiablePredictionController.generateQuickPrediction
);

/**
 * 📊 ADMIN ROUTES (if admin middleware exists)
 */

/**
 * 📈 GET GLOBAL ANALYTICS (Admin only)
 * GET /api/verifiable-predictions/admin/analytics
 */
router.get('/admin/analytics',
  standardRateLimit,
  authenticateUser,
  // Add admin middleware here if available: requireAdmin,
  [
    query('timeframe').optional().isIn(['24h', '7d', '30d', '90d']),
    query('includeUserBreakdown').optional().isBoolean()
  ],
  validateRequest,
  verifiablePredictionController.getGlobalAnalytics
);

/**
 * 🛠️ SYSTEM HEALTH CHECK
 * GET /api/verifiable-predictions/health
 */
router.get('/health',
  verifiablePredictionController.healthCheck
);

/**
 * 📋 SYSTEM STATUS
 * GET /api/verifiable-predictions/status
 */
router.get('/status',
  verifiablePredictionController.getSystemStatus
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  logger.logError(error, { 
    context: 'verifiable_predictions_routes',
    path: req.path,
    method: req.method,
    userId: req.user?.id 
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'validation_failed',
      message: 'Request validation failed',
      details: error.details
    });
  }

  if (error.name === 'RateLimitError') {
    return res.status(429).json({
      success: false,
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please wait before trying again.',
      retryAfter: error.retryAfter
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;