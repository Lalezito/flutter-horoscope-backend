/**
 * 🕰️ ASTROLOGICAL TIMING ROUTES
 * 
 * API routes for advanced astrological timing intelligence.
 * Provides optimal timing recommendations for various life activities.
 */

const express = require('express');
const router = express.Router();
const { 
    AstrologicalTimingController, 
    validateTimingRequest, 
    validateUrgentRequest 
} = require('../controllers/astrologicalTimingController');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rateLimit');

// Apply rate limiting to all timing routes
router.use(rateLimitMiddleware.timingRequests);

/**
 * @swagger
 * /api/timing/recommendations:
 *   post:
 *     summary: Get optimal timing recommendations for specific activities
 *     description: Analyzes astrological conditions to provide personalized timing recommendations
 *     tags: [Astrological Timing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activity
 *               - category
 *             properties:
 *               activity:
 *                 type: string
 *                 description: Specific activity to time
 *                 example: "job_interview"
 *               category:
 *                 type: string
 *                 enum: [business, relationships, financial, health, creative, legal, travel, home]
 *                 description: Activity category
 *                 example: "business"
 *               timeframe:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 90
 *                 default: 30
 *                 description: Days to look ahead for optimal timing
 *               urgency:
 *                 type: string
 *                 enum: [normal, urgent, flexible]
 *                 default: "normal"
 *                 description: Urgency level affecting recommendations
 *               personalizedBirthChart:
 *                 type: boolean
 *                 default: true
 *                 description: Include birth chart in analysis
 *               includeExplanations:
 *                 type: boolean
 *                 default: true
 *                 description: Include AI-generated explanations
 *               timezone:
 *                 type: string
 *                 default: "UTC"
 *                 description: Timezone for timing calculations
 *                 example: "America/New_York"
 *     responses:
 *       200:
 *         description: Timing recommendations generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activity:
 *                       type: string
 *                     category:
 *                       type: string
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rank:
 *                             type: integer
 *                           dateTime:
 *                             type: string
 *                             format: date-time
 *                           localTime:
 *                             type: string
 *                           score:
 *                             type: integer
 *                           confidence:
 *                             type: number
 *                           summary:
 *                             type: string
 *                           astrologicalFactors:
 *                             type: object
 *                           explanation:
 *                             type: object
 *                     confidence:
 *                       type: number
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post('/recommendations', 
    authMiddleware.authenticateOptional,
    validateTimingRequest,
    AstrologicalTimingController.getTimingRecommendations
);

/**
 * @swagger
 * /api/timing/conditions:
 *   get:
 *     summary: Get current astrological conditions
 *     description: Retrieve current planetary positions, lunar phase, and astrological aspects
 *     tags: [Astrological Timing]
 *     parameters:
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "UTC"
 *         description: Timezone for calculations
 *     responses:
 *       200:
 *         description: Current astrological conditions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     lunarInfo:
 *                       type: object
 *                     planetaryPositions:
 *                       type: array
 *                     significantAspects:
 *                       type: array
 *                     retrogradeCount:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/conditions', AstrologicalTimingController.getCurrentConditions);

/**
 * @swagger
 * /api/timing/quick/{category}:
 *   get:
 *     summary: Get quick timing recommendations for common activities
 *     description: Fast timing recommendations for popular activity categories
 *     tags: [Astrological Timing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [business, relationships, financial, health, creative, travel, legal]
 *         description: Activity category
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *           enum: [normal, urgent, flexible]
 *           default: "normal"
 *         description: Urgency level
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 30
 *           default: 7
 *         description: Days to look ahead
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "UTC"
 *         description: Timezone for calculations
 *     responses:
 *       200:
 *         description: Quick timing recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     category:
 *                       type: string
 *                     description:
 *                       type: string
 *                     topRecommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dateTime:
 *                             type: string
 *                           score:
 *                             type: integer
 *                           summary:
 *                             type: string
 *                           keyFactors:
 *                             type: array
 *                             items:
 *                               type: string
 *       400:
 *         description: Invalid category
 *       500:
 *         description: Server error
 */
router.get('/quick/:category', 
    authMiddleware.authenticateOptional,
    AstrologicalTimingController.getQuickRecommendations
);

/**
 * @swagger
 * /api/timing/urgent:
 *   post:
 *     summary: Get optimal timing for time-sensitive activities
 *     description: Analyze timing for activities that must be completed by a specific deadline
 *     tags: [Astrological Timing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activity
 *               - category
 *               - mustCompleteBy
 *             properties:
 *               activity:
 *                 type: string
 *                 description: Specific activity to time
 *               category:
 *                 type: string
 *                 enum: [business, relationships, financial, health, creative, legal, travel, home]
 *                 description: Activity category
 *               mustCompleteBy:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline for completion
 *               timezone:
 *                 type: string
 *                 default: "UTC"
 *                 description: Timezone for calculations
 *     responses:
 *       200:
 *         description: Urgent timing analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     availableWindows:
 *                       type: integer
 *                     bestWindow:
 *                       type: object
 *                     timeRemaining:
 *                       type: string
 *                     urgencyLevel:
 *                       type: string
 *                       enum: [critical, high, moderate, low]
 *                     recommendations:
 *                       type: array
 *       400:
 *         description: Invalid request or deadline too far
 *       500:
 *         description: Server error
 */
router.post('/urgent', 
    authMiddleware.authenticateOptional,
    validateUrgentRequest,
    AstrologicalTimingController.getUrgentTiming
);

/**
 * @swagger
 * /api/timing/mercury-retrograde:
 *   get:
 *     summary: Get Mercury retrograde information and alternatives
 *     description: Current Mercury retrograde status with guidance for affected activities
 *     tags: [Astrological Timing]
 *     parameters:
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "UTC"
 *         description: Timezone for calculations
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           default: 6
 *         description: Months to look ahead for retrograde periods
 *     responses:
 *       200:
 *         description: Mercury retrograde information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentStatus:
 *                       type: object
 *                       properties:
 *                         isRetrograde:
 *                           type: boolean
 *                         speed:
 *                           type: number
 *                         nextStation:
 *                           type: string
 *                         currentSign:
 *                           type: integer
 *                     avoidDuring:
 *                       type: array
 *                       items:
 *                         type: string
 *                     goodFor:
 *                       type: array
 *                       items:
 *                         type: string
 *                     alternativeTiming:
 *                       type: string
 *                     tips:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get('/mercury-retrograde', AstrologicalTimingController.getMercuryRetrogradeInfo);

/**
 * @swagger
 * /api/timing/monthly-overview:
 *   get:
 *     summary: Get monthly timing overview
 *     description: Comprehensive timing analysis for an entire month across all categories
 *     tags: [Astrological Timing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month to analyze (default current month)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Year to analyze (default current year)
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "UTC"
 *         description: Timezone for calculations
 *     responses:
 *       200:
 *         description: Monthly timing overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     month:
 *                       type: integer
 *                     year:
 *                       type: integer
 *                     categoryHighlights:
 *                       type: object
 *                     lunarPhases:
 *                       type: array
 *                     retrogradeAlerts:
 *                       type: array
 *                     bestDays:
 *                       type: array
 *                     challengingDays:
 *                       type: array
 *       500:
 *         description: Server error
 */
router.get('/monthly-overview', 
    authMiddleware.authenticateOptional,
    AstrologicalTimingController.getMonthlyOverview
);

/**
 * @swagger
 * /api/timing/categories:
 *   get:
 *     summary: Get available categories and activities
 *     description: List all available timing categories with descriptions and examples
 *     tags: [Astrological Timing]
 *     responses:
 *       200:
 *         description: Available timing categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: object
 *                     totalCategories:
 *                       type: integer
 *                     urgencyLevels:
 *                       type: array
 *                       items:
 *                         type: string
 *                     timezoneSupport:
 *                       type: boolean
 *                     personalizationAvailable:
 *                       type: boolean
 *       500:
 *         description: Server error
 */
router.get('/categories', AstrologicalTimingController.getAvailableCategories);

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Astrological Timing Intelligence',
        status: 'operational',
        version: '1.0.0',
        features: [
            'Planetary timing algorithms',
            'Lunar cycle optimization',
            'Activity-specific intelligence',
            'Personalized birth chart integration',
            'AI-powered explanations',
            'Mercury retrograde guidance',
            'Real-time astrological conditions'
        ],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;