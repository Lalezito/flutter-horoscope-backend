/**
 * 🕰️ ASTROLOGICAL TIMING CONTROLLER
 * 
 * REST API endpoints for advanced astrological timing intelligence.
 * Provides optimal timing recommendations for various life activities
 * based on planetary transits, lunar cycles, and personalized astrology.
 */

const astrologicalTimingService = require('../services/astrologicalTimingService');
const logger = require('../utils/logger');
const { body, query, validationResult } = require('express-validator');

class AstrologicalTimingController {
    
    /**
     * Get optimal timing recommendations for specific activities
     * POST /api/timing/recommendations
     */
    async getTimingRecommendations(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const userId = req.user?.id || req.body.userId;
            const {
                activity,
                category,
                timeframe = 30,
                urgency = 'normal',
                personalizedBirthChart = true,
                includeExplanations = true,
                timezone = 'UTC'
            } = req.body;

            logger.info(`🕰️ Timing recommendations requested`, {
                userId,
                activity,
                category,
                timeframe,
                urgency
            });

            const recommendations = await astrologicalTimingService.getOptimalTimingRecommendations({
                userId,
                activity,
                category,
                timeframe,
                urgency,
                personalizedBirthChart,
                includeExplanations,
                timezone
            });

            return res.status(200).json({
                success: true,
                data: recommendations,
                message: `Generated ${recommendations.recommendations.length} timing recommendations`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get timing recommendations:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to generate timing recommendations',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get current astrological conditions
     * GET /api/timing/conditions
     */
    async getCurrentConditions(req, res) {
        try {
            const { timezone = 'UTC' } = req.query;

            logger.info('🌌 Current astrological conditions requested', { timezone });

            const conditions = await astrologicalTimingService.calculateCurrentAstrologicalConditions(timezone);

            // Format conditions for client consumption
            const formattedConditions = {
                timestamp: conditions.timestamp,
                lunarInfo: {
                    phase: conditions.lunarInfo.phase,
                    sign: conditions.lunarInfo.sign,
                    degree: Math.round(conditions.lunarInfo.degree * 10) / 10
                },
                planetaryPositions: Object.entries(conditions.planetaryPositions).map(([planet, pos]) => ({
                    planet,
                    sign: pos.sign,
                    degree: Math.round(pos.degree * 10) / 10,
                    isRetrograde: conditions.retrogradeStatus[planet]?.isRetrograde || false
                })),
                significantAspects: conditions.currentAspects.slice(0, 5).map(aspect => ({
                    planets: `${aspect.planet1} ${aspect.aspect} ${aspect.planet2}`,
                    strength: Math.round(aspect.strength * 100),
                    orb: Math.round(aspect.orb * 10) / 10,
                    applying: aspect.isApplying
                })),
                retrogradeCount: Object.values(conditions.retrogradeStatus).filter(status => status.isRetrograde).length,
                specialConditions: conditions.specialConditions
            };

            return res.status(200).json({
                success: true,
                data: formattedConditions,
                message: 'Current astrological conditions retrieved successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get current conditions:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve astrological conditions',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get quick timing recommendations for common activities
     * GET /api/timing/quick/:category
     */
    async getQuickRecommendations(req, res) {
        try {
            const { category } = req.params;
            const {
                urgency = 'normal',
                timeframe = 7,
                timezone = 'UTC'
            } = req.query;
            
            const userId = req.user?.id;

            logger.info(`🚀 Quick timing recommendations requested for ${category}`, {
                userId,
                urgency,
                timeframe
            });

            // Pre-defined activity mappings for quick recommendations
            const activityMappings = {
                business: {
                    activity: 'meetings',
                    description: 'Business meetings and professional activities'
                },
                relationships: {
                    activity: 'first_dates',
                    description: 'Romantic encounters and relationship activities'
                },
                financial: {
                    activity: 'investments',
                    description: 'Financial decisions and money matters'
                },
                health: {
                    activity: 'wellness',
                    description: 'Health and wellness activities'
                },
                creative: {
                    activity: 'artistic_projects',
                    description: 'Creative and artistic endeavors'
                },
                travel: {
                    activity: 'departure_times',
                    description: 'Travel and journey planning'
                },
                legal: {
                    activity: 'contract_signing',
                    description: 'Legal matters and contracts'
                }
            };

            const activityInfo = activityMappings[category];
            if (!activityInfo) {
                return res.status(400).json({
                    success: false,
                    message: `Unknown category: ${category}`,
                    availableCategories: Object.keys(activityMappings),
                    timestamp: new Date().toISOString()
                });
            }

            const recommendations = await astrologicalTimingService.getOptimalTimingRecommendations({
                userId,
                activity: activityInfo.activity,
                category,
                timeframe: parseInt(timeframe),
                urgency,
                personalizedBirthChart: !!userId,
                includeExplanations: true,
                timezone
            });

            // Format for quick response
            const quickResponse = {
                category,
                description: activityInfo.description,
                topRecommendations: recommendations.recommendations.slice(0, 3).map(rec => ({
                    dateTime: rec.localTime,
                    dayOfWeek: rec.dayOfWeek,
                    score: rec.score,
                    summary: rec.summary,
                    keyFactors: [
                        rec.astrologicalFactors.planetaryHour?.planet && `${rec.astrologicalFactors.planetaryHour.planet} hour`,
                        rec.astrologicalFactors.lunarPhase?.name && `${rec.astrologicalFactors.lunarPhase.name} moon`,
                        rec.astrologicalFactors.retrogradeImpact.length === 0 && 'No retrograde interference'
                    ].filter(Boolean)
                })),
                currentConditions: recommendations.currentConditions,
                confidence: recommendations.confidence
            };

            return res.status(200).json({
                success: true,
                data: quickResponse,
                message: `Quick timing recommendations for ${category}`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get quick recommendations:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to generate quick recommendations',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get optimal timing for specific time-sensitive activities
     * POST /api/timing/urgent
     */
    async getUrgentTiming(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const userId = req.user?.id || req.body.userId;
            const {
                activity,
                category,
                mustCompleteBy, // ISO date string
                timezone = 'UTC'
            } = req.body;

            logger.info(`⚡ Urgent timing analysis requested`, {
                userId,
                activity,
                category,
                mustCompleteBy
            });

            // Calculate timeframe based on deadline
            const deadline = new Date(mustCompleteBy);
            const now = new Date();
            const timeframeHours = Math.ceil((deadline - now) / (1000 * 60 * 60));
            const timeframeDays = Math.max(1, Math.ceil(timeframeHours / 24));

            if (timeframeDays > 30) {
                return res.status(400).json({
                    success: false,
                    message: 'Deadline too far in the future (maximum 30 days)',
                    timestamp: new Date().toISOString()
                });
            }

            const recommendations = await astrologicalTimingService.getOptimalTimingRecommendations({
                userId,
                activity,
                category,
                timeframe: timeframeDays,
                urgency: 'urgent',
                personalizedBirthChart: true,
                includeExplanations: true,
                timezone
            });

            // Filter recommendations that fall within deadline
            const urgentRecommendations = recommendations.recommendations.filter(rec => {
                const recDate = new Date(rec.dateTime);
                return recDate <= deadline;
            });

            // Analyze timing urgency
            const urgencyAnalysis = {
                availableWindows: urgentRecommendations.length,
                bestWindow: urgentRecommendations[0] || null,
                timeRemaining: `${Math.round(timeframeHours)} hours`,
                urgencyLevel: timeframeDays <= 1 ? 'critical' : 
                             timeframeDays <= 3 ? 'high' : 
                             timeframeDays <= 7 ? 'moderate' : 'low',
                recommendations: urgentRecommendations.slice(0, 5)
            };

            return res.status(200).json({
                success: true,
                data: urgencyAnalysis,
                message: `Urgent timing analysis for ${activity}`,
                deadline: mustCompleteBy,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get urgent timing:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to analyze urgent timing',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get Mercury retrograde information and alternatives
     * GET /api/timing/mercury-retrograde
     */
    async getMercuryRetrogradeInfo(req, res) {
        try {
            const { timezone = 'UTC', months = 6 } = req.query;

            logger.info('☿ Mercury retrograde information requested', { timezone, months });

            // Get current astrological conditions
            const conditions = await astrologicalTimingService.calculateCurrentAstrologicalConditions(timezone);
            
            const mercuryStatus = conditions.retrogradeStatus.mercury;
            const isMercuryRetrograde = mercuryStatus?.isRetrograde || false;

            // Get timing recommendations that avoid Mercury retrograde issues
            const safeActivities = ['communication', 'contracts', 'technology', 'travel'];
            const retrogradeInfo = {
                currentStatus: {
                    isRetrograde: isMercuryRetrograde,
                    speed: mercuryStatus?.speed,
                    nextStation: mercuryStatus?.stationaryDate,
                    currentSign: conditions.planetaryPositions.mercury?.sign
                },
                avoidDuring: [
                    'Signing important contracts',
                    'Major technology purchases',
                    'Starting new communication projects',
                    'Beginning travel plans',
                    'Launching websites or apps'
                ],
                goodFor: [
                    'Reviewing and revising existing work',
                    'Reconnecting with old contacts',
                    'Research and planning',
                    'Backup and organize data',
                    'Reflect on communication patterns'
                ],
                alternativeTiming: isMercuryRetrograde ? 
                    'Consider waiting until Mercury goes direct, or proceed with extra caution and backup plans' :
                    'Current timing is favorable for Mercury-ruled activities',
                tips: [
                    'Double-check all communications and documents',
                    'Allow extra time for travel and technology',
                    'Backup important data before Mercury retrograde periods',
                    'Be flexible with plans and expect delays',
                    'Use this time for revision rather than initiation'
                ]
            };

            return res.status(200).json({
                success: true,
                data: retrogradeInfo,
                message: 'Mercury retrograde information retrieved',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get Mercury retrograde info:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve Mercury retrograde information',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get monthly timing overview
     * GET /api/timing/monthly-overview
     */
    async getMonthlyOverview(req, res) {
        try {
            const {
                month,
                year,
                timezone = 'UTC'
            } = req.query;

            const userId = req.user?.id;

            logger.info('📅 Monthly timing overview requested', {
                userId,
                month,
                year,
                timezone
            });

            const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
            const targetYear = year ? parseInt(year) : new Date().getFullYear();

            // Get optimal timing for each category throughout the month
            const categories = ['business', 'relationships', 'financial', 'health', 'creative'];
            const monthlyOverview = {
                month: targetMonth,
                year: targetYear,
                timezone,
                categoryHighlights: {},
                lunarPhases: [],
                retrogradeAlerts: [],
                bestDays: [],
                challengingDays: []
            };

            // Analyze each category for the month
            for (const category of categories) {
                try {
                    const recommendations = await astrologicalTimingService.getOptimalTimingRecommendations({
                        userId,
                        activity: 'general',
                        category,
                        timeframe: 30,
                        urgency: 'flexible',
                        personalizedBirthChart: !!userId,
                        includeExplanations: false,
                        timezone
                    });

                    monthlyOverview.categoryHighlights[category] = {
                        bestDays: recommendations.recommendations.slice(0, 3).map(rec => ({
                            date: rec.localTime.split(' ')[0],
                            score: rec.score,
                            summary: rec.summary
                        })),
                        confidence: recommendations.confidence
                    };
                } catch (error) {
                    logger.warn(`⚠️ Failed to analyze ${category} for monthly overview:`, error);
                    monthlyOverview.categoryHighlights[category] = {
                        bestDays: [],
                        confidence: 0,
                        error: 'Analysis unavailable'
                    };
                }
            }

            return res.status(200).json({
                success: true,
                data: monthlyOverview,
                message: `Monthly timing overview for ${targetMonth}/${targetYear}`,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get monthly overview:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to generate monthly overview',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get available categories and activities
     * GET /api/timing/categories
     */
    async getAvailableCategories(req, res) {
        try {
            const categories = {
                business: {
                    description: 'Professional activities and career decisions',
                    activities: ['job_interviews', 'salary_negotiations', 'product_launches', 'meetings', 'presentations'],
                    favorablePlanets: ['Jupiter', 'Sun', 'Mercury'],
                    examples: [
                        'Job interviews and career changes',
                        'Salary negotiations and promotions',
                        'Business launches and presentations',
                        'Important meetings and decisions',
                        'Professional networking events'
                    ]
                },
                relationships: {
                    description: 'Love, romance, and personal relationships',
                    activities: ['first_dates', 'proposals', 'difficult_conversations', 'breakups'],
                    favorablePlanets: ['Venus', 'Moon'],
                    examples: [
                        'First dates and romantic encounters',
                        'Marriage proposals and commitments',
                        'Difficult relationship conversations',
                        'Meeting new people socially',
                        'Reconciling after conflicts'
                    ]
                },
                financial: {
                    description: 'Money, investments, and financial decisions',
                    activities: ['investments', 'major_purchases', 'contract_signing', 'loan_applications'],
                    favorablePlanets: ['Jupiter', 'Venus', 'Sun'],
                    examples: [
                        'Stock market investments',
                        'Real estate purchases',
                        'Loan applications and approvals',
                        'Starting new business ventures',
                        'Financial planning sessions'
                    ]
                },
                health: {
                    description: 'Health, wellness, and medical procedures',
                    activities: ['surgery', 'detox', 'fitness_routines', 'medical_procedures'],
                    favorablePlanets: ['Sun', 'Moon'],
                    examples: [
                        'Elective medical procedures',
                        'Starting new fitness routines',
                        'Detox and cleansing programs',
                        'Dental work and treatments',
                        'Health consultations'
                    ]
                },
                creative: {
                    description: 'Artistic projects and creative expression',
                    activities: ['artistic_projects', 'writing', 'music', 'design_launches'],
                    favorablePlanets: ['Venus', 'Neptune', 'Moon'],
                    examples: [
                        'Launching creative projects',
                        'Starting writing projects',
                        'Music recording and releases',
                        'Art exhibitions and showcases',
                        'Design presentations'
                    ]
                },
                legal: {
                    description: 'Legal matters and official procedures',
                    activities: ['court_dates', 'contract_negotiations', 'legal_filings'],
                    favorablePlanets: ['Jupiter', 'Sun', 'Saturn'],
                    examples: [
                        'Court appearances and hearings',
                        'Contract negotiations',
                        'Legal document filing',
                        'Dispute resolutions',
                        'Official registrations'
                    ]
                },
                travel: {
                    description: 'Travel planning and journeys',
                    activities: ['departure_times', 'booking_optimization', 'safe_travel_periods'],
                    favorablePlanets: ['Jupiter', 'Mercury'],
                    examples: [
                        'Flight departure times',
                        'Vacation and trip planning',
                        'Business travel scheduling',
                        'Moving and relocations',
                        'International travel'
                    ]
                },
                home: {
                    description: 'Home, family, and domestic matters',
                    activities: ['moving', 'renovations', 'family_gatherings', 'childcare_decisions'],
                    favorablePlanets: ['Moon', 'Venus', 'Saturn'],
                    examples: [
                        'Moving to new homes',
                        'Home renovations and repairs',
                        'Family celebrations and gatherings',
                        'Childcare arrangements',
                        'Domestic purchases'
                    ]
                }
            };

            return res.status(200).json({
                success: true,
                data: {
                    categories,
                    totalCategories: Object.keys(categories).length,
                    urgencyLevels: ['normal', 'urgent', 'flexible'],
                    timezoneSupport: true,
                    personalizationAvailable: true
                },
                message: 'Available timing categories and activities',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Failed to get categories:', error);
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve categories',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }
}

/**
 * Validation middleware for timing recommendations
 */
const validateTimingRequest = [
    body('activity')
        .notEmpty()
        .withMessage('Activity is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Activity must be between 2 and 100 characters'),
    
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['business', 'relationships', 'financial', 'health', 'creative', 'legal', 'travel', 'home'])
        .withMessage('Invalid category'),
    
    body('timeframe')
        .optional()
        .isInt({ min: 1, max: 90 })
        .withMessage('Timeframe must be between 1 and 90 days'),
    
    body('urgency')
        .optional()
        .isIn(['normal', 'urgent', 'flexible'])
        .withMessage('Urgency must be normal, urgent, or flexible'),
    
    body('timezone')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Invalid timezone format')
];

const validateUrgentRequest = [
    body('activity')
        .notEmpty()
        .withMessage('Activity is required'),
    
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['business', 'relationships', 'financial', 'health', 'creative', 'legal', 'travel', 'home'])
        .withMessage('Invalid category'),
    
    body('mustCompleteBy')
        .notEmpty()
        .withMessage('Deadline is required')
        .isISO8601()
        .withMessage('Deadline must be a valid ISO date'),
    
    body('timezone')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Invalid timezone format')
];

module.exports = {
    AstrologicalTimingController: new AstrologicalTimingController(),
    validateTimingRequest,
    validateUrgentRequest
};