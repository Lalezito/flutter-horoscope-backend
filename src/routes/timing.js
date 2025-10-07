/**
 * TIMING RECOMMENDATION API ROUTES
 * 
 * Comprehensive API endpoints for astrological timing and calendar integration
 * Provides optimal timing recommendations and calendar synchronization
 */

const express = require('express');
const router = express.Router();
const astrologicalTimingService = require('../services/astrologicalTimingService');
const calendarSyncService = require('../services/calendarSyncService');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rateLimit');
const validationMiddleware = require('../middleware/validation');
const { body, param, query, validationResult } = require('express-validator');

/**
 * @swagger
 * components:
 *   schemas:
 *     TimingRecommendation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the timing recommendation
 *         activityType:
 *           type: string
 *           description: Type of activity for timing optimization
 *           enum: [business_meeting, job_interview, first_date, contract_signing, surgery_scheduling, travel_booking, investment_decision, important_conversation, creative_project_launch, property_purchase]
 *         recommendedDateTime:
 *           type: string
 *           format: date-time
 *           description: Recommended start time for the activity
 *         confidence:
 *           type: number
 *           format: float
 *           minimum: 0
 *           maximum: 1
 *           description: Confidence score for the recommendation
 *         astrologicalFactors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               planet:
 *                 type: string
 *               influence:
 *                 type: string
 *               strength:
 *                 type: number
 *         reasoning:
 *           type: string
 *           description: Astrological reasoning for the timing recommendation
 *     CalendarEvent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Calendar event identifier
 *         title:
 *           type: string
 *           description: Event title
 *         start:
 *           type: string
 *           format: date-time
 *         end:
 *           type: string
 *           format: date-time
 *         provider:
 *           type: string
 *           enum: [google, apple, microsoft]
 *         astrologicalOverlay:
 *           type: object
 *           description: Astrological analysis of the event timing
 */

/**
 * @swagger
 * /api/timing/recommendations:
 *   post:
 *     summary: Generate optimal timing recommendations for an activity
 *     tags: [Timing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activityType
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [business_meeting, job_interview, first_date, contract_signing, surgery_scheduling, travel_booking, investment_decision, important_conversation, creative_project_launch, property_purchase]
 *               dateRange:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                   end:
 *                     type: string
 *                     format: date-time
 *               timezone:
 *                 type: string
 *                 default: UTC
 *               minConfidence:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.4
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
 *                     activityType:
 *                       type: string
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TimingRecommendation'
 *                     totalOpportunities:
 *                       type: integer
 *                     dateRange:
 *                       type: object
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized - Authentication required
 *       429:
 *         description: Too many requests
 */
router.post('/recommendations',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('timing_recommendations', 20, 60), // 20 requests per minute
    [
        body('activityType')
            .isIn(['business_meeting', 'job_interview', 'first_date', 'contract_signing', 
                   'surgery_scheduling', 'travel_booking', 'investment_decision', 
                   'important_conversation', 'creative_project_launch', 'property_purchase'])
            .withMessage('Invalid activity type'),
        body('dateRange.start')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date format'),
        body('dateRange.end')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date format'),
        body('timezone')
            .optional()
            .isString()
            .withMessage('Invalid timezone'),
        body('minConfidence')
            .optional()
            .isFloat({ min: 0, max: 1 })
            .withMessage('Confidence must be between 0 and 1')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { activityType, dateRange, timezone, minConfidence } = req.body;
            const userId = req.user.id;

            console.log(`📅 Generating timing recommendations for ${activityType} - User: ${userId}`);

            const recommendations = await astrologicalTimingService.calculateOptimalTiming(
                userId,
                activityType,
                {
                    dateRange,
                    timezone,
                    minConfidence
                }
            );

            res.json({
                success: true,
                data: recommendations,
                meta: {
                    userId,
                    requestedAt: new Date().toISOString(),
                    processingTime: Date.now() - req.startTime
                }
            });

        } catch (error) {
            console.error('❌ Timing recommendations error:', error);
            
            if (error.message.includes('Premium subscription required')) {
                return res.status(403).json({
                    success: false,
                    error: 'premium_required',
                    message: 'Premium subscription required for this activity type'
                });
            }

            if (error.message.includes('birth data required')) {
                return res.status(400).json({
                    success: false,
                    error: 'birth_data_required',
                    message: 'Complete birth data required for personalized timing calculations'
                });
            }

            res.status(500).json({
                success: false,
                error: 'calculation_failed',
                message: 'Failed to generate timing recommendations',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/best-days/{activityType}:
 *   get:
 *     summary: Get best days for a specific activity type
 *     tags: [Timing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [business_meeting, job_interview, first_date, contract_signing, surgery_scheduling, travel_booking, investment_decision, important_conversation, creative_project_launch, property_purchase]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: UTC
 *     responses:
 *       200:
 *         description: Best days retrieved successfully
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
 *                     activityType:
 *                       type: string
 *                     bestDays:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           rating:
 *                             type: number
 *                           lunarPhase:
 *                             type: string
 *                           dayOfWeek:
 *                             type: string
 */
router.get('/best-days/:activityType',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('best_days', 30, 60), // 30 requests per minute
    [
        param('activityType')
            .isIn(['business_meeting', 'job_interview', 'first_date', 'contract_signing', 
                   'surgery_scheduling', 'travel_booking', 'investment_decision', 
                   'important_conversation', 'creative_project_launch', 'property_purchase'])
            .withMessage('Invalid activity type'),
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date format'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date format'),
        query('timezone')
            .optional()
            .isString()
            .withMessage('Invalid timezone')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { activityType } = req.params;
            const { startDate, endDate, timezone } = req.query;

            console.log(`📅 Getting best days for ${activityType}`);

            const dateRange = {};
            if (startDate) dateRange.start = startDate;
            if (endDate) dateRange.end = endDate;

            const bestDays = await astrologicalTimingService.getBestDays(activityType, {
                dateRange: Object.keys(dateRange).length > 0 ? dateRange : undefined,
                timezone
            });

            res.json({
                success: true,
                data: bestDays,
                meta: {
                    requestedAt: new Date().toISOString(),
                    processingTime: Date.now() - req.startTime
                }
            });

        } catch (error) {
            console.error('❌ Best days calculation error:', error);
            res.status(500).json({
                success: false,
                error: 'calculation_failed',
                message: 'Failed to calculate best days'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/avoid:
 *   get:
 *     summary: Get times to avoid (Mercury retrograde, void Moon, etc.)
 *     tags: [Timing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: UTC
 *     responses:
 *       200:
 *         description: Avoidance periods retrieved successfully
 */
router.get('/avoid',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('times_to_avoid', 30, 60),
    [
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date format'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date format'),
        query('timezone')
            .optional()
            .isString()
            .withMessage('Invalid timezone')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { startDate, endDate, timezone } = req.query;

            console.log(`📅 Getting times to avoid`);

            const dateRange = {};
            if (startDate) dateRange.start = startDate;
            if (endDate) dateRange.end = endDate;

            const timesToAvoid = await astrologicalTimingService.getTimesToAvoid({
                dateRange: Object.keys(dateRange).length > 0 ? dateRange : undefined,
                timezone
            });

            res.json({
                success: true,
                data: timesToAvoid,
                meta: {
                    requestedAt: new Date().toISOString(),
                    processingTime: Date.now() - req.startTime
                }
            });

        } catch (error) {
            console.error('❌ Times to avoid calculation error:', error);
            res.status(500).json({
                success: false,
                error: 'calculation_failed',
                message: 'Failed to calculate times to avoid'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/calendar/sync:
 *   put:
 *     summary: Sync with external calendars
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, apple, microsoft]
 *               force:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Calendar synced successfully
 */
router.put('/calendar/sync',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('calendar_sync', 10, 60), // 10 syncs per minute
    [
        body('provider')
            .isIn(['google', 'apple', 'microsoft'])
            .withMessage('Invalid calendar provider'),
        body('force')
            .optional()
            .isBoolean()
            .withMessage('Force must be boolean')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { provider, force } = req.body;
            const userId = req.user.id;

            console.log(`📅 Syncing ${provider} calendar for user ${userId}`);

            const syncResult = await calendarSyncService.syncCalendar(userId, provider, { force });

            res.json({
                success: true,
                data: syncResult,
                meta: {
                    userId,
                    syncedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Calendar sync error:', error);
            
            if (error.message.includes('No calendar connection found')) {
                return res.status(404).json({
                    success: false,
                    error: 'no_connection',
                    message: 'No calendar connection found. Please connect your calendar first.'
                });
            }

            res.status(500).json({
                success: false,
                error: 'sync_failed',
                message: 'Calendar synchronization failed'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/calendar/events:
 *   get:
 *     summary: Get calendar events with astrological overlays
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Calendar events with astrological analysis retrieved successfully
 */
router.get('/calendar/events',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('calendar_events', 30, 60),
    [
        query('startDate')
            .isISO8601()
            .withMessage('Start date is required and must be valid ISO8601 format'),
        query('endDate')
            .isISO8601()
            .withMessage('End date is required and must be valid ISO8601 format')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const userId = req.user.id;

            console.log(`📅 Getting calendar events with astrological overlay for user ${userId}`);

            const dateRange = { start: startDate, end: endDate };
            const eventsWithOverlay = await calendarSyncService.getCalendarWithAstrologicalOverlay(userId, dateRange);

            res.json({
                success: true,
                data: eventsWithOverlay,
                meta: {
                    userId,
                    requestedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Calendar events retrieval error:', error);
            res.status(500).json({
                success: false,
                error: 'retrieval_failed',
                message: 'Failed to retrieve calendar events'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/calendar/event:
 *   post:
 *     summary: Create calendar event at optimal time
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - activityType
 *               - duration
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               activityType:
 *                 type: string
 *                 enum: [business_meeting, job_interview, first_date, contract_signing, surgery_scheduling, travel_booking, investment_decision, important_conversation, creative_project_launch, property_purchase]
 *               duration:
 *                 type: integer
 *                 description: Duration in minutes
 *               location:
 *                 type: string
 *               attendees:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *               timezone:
 *                 type: string
 *                 default: UTC
 *     responses:
 *       201:
 *         description: Calendar event created successfully
 */
router.post('/calendar/event',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('create_calendar_event', 20, 60),
    [
        body('title')
            .isString()
            .isLength({ min: 1, max: 500 })
            .withMessage('Title is required and must be between 1-500 characters'),
        body('activityType')
            .isIn(['business_meeting', 'job_interview', 'first_date', 'contract_signing', 
                   'surgery_scheduling', 'travel_booking', 'investment_decision', 
                   'important_conversation', 'creative_project_launch', 'property_purchase'])
            .withMessage('Invalid activity type'),
        body('duration')
            .isInt({ min: 15, max: 480 })
            .withMessage('Duration must be between 15 minutes and 8 hours'),
        body('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
        body('location')
            .optional()
            .isString()
            .withMessage('Location must be a string'),
        body('attendees')
            .optional()
            .isArray()
            .withMessage('Attendees must be an array'),
        body('attendees.*')
            .optional()
            .isEmail()
            .withMessage('All attendees must be valid email addresses'),
        body('timezone')
            .optional()
            .isString()
            .withMessage('Timezone must be a string')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { title, description, activityType, duration, location, attendees, timezone } = req.body;
            const userId = req.user.id;

            console.log(`📅 Creating optimal timing event for user ${userId}: ${title}`);

            // First, get optimal timing recommendation
            const timingRecommendations = await astrologicalTimingService.calculateOptimalTiming(
                userId,
                activityType,
                { timezone }
            );

            if (!timingRecommendations.recommendations || timingRecommendations.recommendations.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'no_optimal_timing',
                    message: 'No optimal timing found for this activity type'
                });
            }

            // Use the best recommendation
            const bestTiming = timingRecommendations.recommendations[0];
            
            // Calculate end time based on duration
            const startTime = new Date(bestTiming.date + 'T' + bestTiming.timeWindow.start);
            const endTime = new Date(startTime.getTime() + duration * 60000);

            const timingRecommendation = {
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                confidence: bestTiming.confidence,
                astrologicalFactors: bestTiming.astrologicalFactors,
                activityType,
                reasoning: bestTiming.reasoning
            };

            const eventData = {
                title,
                description,
                location,
                attendees: attendees || [],
                timezone: timezone || 'UTC'
            };

            // Create the calendar event
            const createdEvent = await calendarSyncService.createOptimalTimingEvent(
                userId,
                eventData,
                timingRecommendation
            );

            res.status(201).json({
                success: true,
                data: {
                    event: createdEvent,
                    timingRecommendation: {
                        confidence: timingRecommendation.confidence,
                        reasoning: timingRecommendation.reasoning,
                        astrologicalFactors: timingRecommendation.astrologicalFactors
                    }
                },
                meta: {
                    userId,
                    createdAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Calendar event creation error:', error);
            
            if (error.message.includes('No calendar connections found')) {
                return res.status(400).json({
                    success: false,
                    error: 'no_calendar_connection',
                    message: 'No calendar connections found. Please connect a calendar first.'
                });
            }

            res.status(500).json({
                success: false,
                error: 'event_creation_failed',
                message: 'Failed to create calendar event'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/calendar/conflicts:
 *   post:
 *     summary: Detect calendar conflicts for proposed event
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - start
 *               - end
 *             properties:
 *               start:
 *                 type: string
 *                 format: date-time
 *               end:
 *                 type: string
 *                 format: date-time
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conflict detection completed
 */
router.post('/calendar/conflicts',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('conflict_detection', 30, 60),
    [
        body('start')
            .isISO8601()
            .withMessage('Start time is required and must be valid ISO8601 format'),
        body('end')
            .isISO8601()
            .withMessage('End time is required and must be valid ISO8601 format'),
        body('title')
            .optional()
            .isString()
            .withMessage('Title must be a string')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { start, end, title } = req.body;
            const userId = req.user.id;

            console.log(`📅 Detecting conflicts for user ${userId}: ${title || 'Unnamed event'}`);

            const proposedEvent = { start, end, title };
            const conflicts = await calendarSyncService.detectCalendarConflicts(userId, proposedEvent);

            res.json({
                success: true,
                data: conflicts,
                meta: {
                    userId,
                    checkedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Conflict detection error:', error);
            res.status(500).json({
                success: false,
                error: 'conflict_detection_failed',
                message: 'Failed to detect calendar conflicts'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/calendar/connect:
 *   post:
 *     summary: Connect external calendar provider
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - credentials
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, apple, microsoft]
 *               credentials:
 *                 type: object
 *                 description: Provider-specific authentication credentials
 *     responses:
 *       200:
 *         description: Calendar connected successfully
 */
router.post('/calendar/connect',
    authMiddleware.authenticate,
    rateLimitMiddleware.applyRateLimit('calendar_connect', 5, 60), // 5 connections per minute
    [
        body('provider')
            .isIn(['google', 'apple', 'microsoft'])
            .withMessage('Invalid calendar provider'),
        body('credentials')
            .isObject()
            .withMessage('Credentials object is required')
    ],
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { provider, credentials } = req.body;
            const userId = req.user.id;

            console.log(`📅 Connecting ${provider} calendar for user ${userId}`);

            const connectionResult = await calendarSyncService.initializeCalendarConnection(
                userId,
                provider,
                credentials
            );

            res.json({
                success: true,
                data: connectionResult,
                meta: {
                    userId,
                    connectedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Calendar connection error:', error);
            res.status(500).json({
                success: false,
                error: 'connection_failed',
                message: 'Failed to connect calendar provider'
            });
        }
    }
);

/**
 * @swagger
 * /api/timing/categories:
 *   get:
 *     summary: Get available timing categories
 *     tags: [Timing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Timing categories retrieved successfully
 */
router.get('/categories',
    authMiddleware.authenticate,
    async (req, res) => {
        try {
            const db = require('../config/db');
            
            const result = await db.query(`
                SELECT category_name, display_name, description, premium_only, complexity_level
                FROM timing_categories
                ORDER BY display_name ASC
            `);

            res.json({
                success: true,
                data: {
                    categories: result.rows,
                    total: result.rows.length
                }
            });

        } catch (error) {
            console.error('❌ Categories retrieval error:', error);
            res.status(500).json({
                success: false,
                error: 'retrieval_failed',
                message: 'Failed to retrieve timing categories'
            });
        }
    }
);

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('❌ Timing API error:', error);
    
    res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'An unexpected error occurred',
        requestId: req.id,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;