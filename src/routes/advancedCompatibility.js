/**
 * ADVANCED COMPATIBILITY ROUTES
 * API endpoints for the revolutionary compatibility system
 *
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/advancedCompatibilityController');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rateLimit');

/**
 * PUBLIC ROUTES
 */

// Get service status
router.get('/status', controller.getServiceStatus.bind(controller));

/**
 * AUTHENTICATED ROUTES
 * Require user authentication
 */

// Deep compatibility analysis
router.post(
  '/analyze',
  authMiddleware.authenticate,
  rateLimitMiddleware.compatibilityRateLimit,
  controller.analyzeCompatibility.bind(controller)
);

// Get compatibility timeline predictions
router.post(
  '/timeline',
  authMiddleware.authenticate,
  rateLimitMiddleware.compatibilityRateLimit,
  controller.getCompatibilityTimeline.bind(controller)
);

// Find compatible matches (Dating feature)
router.post(
  '/matches',
  authMiddleware.authenticate,
  rateLimitMiddleware.compatibilityRateLimit,
  controller.findMatches.bind(controller)
);

// Predict relationship milestones
router.post(
  '/milestones',
  authMiddleware.authenticate,
  rateLimitMiddleware.compatibilityRateLimit,
  controller.predictMilestones.bind(controller)
);

// Generate PDF compatibility report
router.post(
  '/report',
  authMiddleware.authenticate,
  rateLimitMiddleware.reportRateLimit,
  controller.generateReport.bind(controller)
);

/**
 * USER PROFILE ROUTES
 */

// Get user compatibility profile
router.get(
  '/profile/:userId',
  authMiddleware.authenticate,
  controller.getUserProfile.bind(controller)
);

// Create/Update user compatibility profile
router.post(
  '/profile',
  authMiddleware.authenticate,
  controller.updateUserProfile.bind(controller)
);

/**
 * HISTORY & FEEDBACK ROUTES
 */

// Get compatibility history
router.get(
  '/history/:userId',
  authMiddleware.authenticate,
  controller.getCompatibilityHistory.bind(controller)
);

// Submit compatibility feedback
router.post(
  '/feedback',
  authMiddleware.authenticate,
  controller.submitFeedback.bind(controller)
);

/**
 * ROUTE DOCUMENTATION
 */
router.get('/', (req, res) => {
  res.json({
    service: 'Advanced Compatibility API v2',
    version: '1.0.0',
    description: 'Revolutionary multi-dimensional astrological compatibility analysis',
    endpoints: {
      public: {
        status: 'GET /api/v2/compatibility/status - Service status and features'
      },
      authenticated: {
        analyze: 'POST /api/v2/compatibility/analyze - Deep compatibility analysis',
        timeline: 'POST /api/v2/compatibility/timeline - Timeline predictions',
        matches: 'POST /api/v2/compatibility/matches - Find compatible matches',
        milestones: 'POST /api/v2/compatibility/milestones - Predict relationship milestones',
        report: 'POST /api/v2/compatibility/report - Generate PDF report',
        profile_get: 'GET /api/v2/compatibility/profile/:userId - Get user profile',
        profile_update: 'POST /api/v2/compatibility/profile - Update user profile',
        history: 'GET /api/v2/compatibility/history/:userId - Get compatibility history',
        feedback: 'POST /api/v2/compatibility/feedback - Submit feedback'
      }
    },
    features: [
      'Multi-dimensional compatibility (Sun, Moon, Rising, Venus, Mars, Mercury)',
      'Birth chart synastry analysis',
      'Real-time timeline predictions',
      'Advanced matching algorithm',
      'Relationship milestone predictions',
      'Beautiful PDF reports',
      'Subscription tier integration'
    ],
    subscriptionTiers: {
      free: {
        limit: '1 check/day',
        features: ['Basic sun sign compatibility']
      },
      cosmic: {
        limit: '10 checks/month',
        price: '$4.99/month',
        features: [
          'Multi-dimensional analysis',
          'Basic PDF reports',
          'Timeline predictions'
        ]
      },
      universe: {
        limit: 'Unlimited',
        price: '$9.99/month',
        features: [
          'All features',
          'Elite PDF reports',
          'Matching algorithm',
          'Milestone predictions',
          'Birth chart synastry'
        ]
      }
    },
    documentation: 'https://docs.zodia.app/compatibility',
    support: 'support@zodia.app'
  });
});

module.exports = router;
