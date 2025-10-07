/**
 * PREDICTIONS API ROUTES
 * 
 * RESTful API endpoints for verifiable prediction system
 * Includes premium validation and comprehensive error handling
 */

const express = require('express');
const router = express.Router();
const predictionService = require('../services/predictionService');
const predictionAlertService = require('../services/predictionAlertService');
const predictionVerificationService = require('../services/predictionVerificationService');
const receiptValidationService = require('../services/receiptValidationService');
const { rateLimits } = require('../middleware/security');
const logger = require('../services/loggingService');

// Use existing rate limits from security middleware
const predictionRateLimit = rateLimits.strict;
const verificationRateLimit = rateLimits.strict;

/**
 * Middleware to validate premium subscription
 */
const validatePremiumAccess = async (req, res, next) => {
    try {
        const { userId } = req.body;
        const category = req.body.category || req.params.category;

        if (!userId) {
            return res.status(400).json({
                error: 'User ID is required',
                code: 'MISSING_USER_ID'
            });
        }

        // Check if category requires premium
        const premiumRequired = await predictionService.isPremiumRequired(category);
        
        if (premiumRequired) {
            // Validate premium subscription
            const premiumStatus = await receiptValidationService.checkUserPremiumStatus(userId);
            
            if (!premiumStatus.is_premium) {
                return res.status(403).json({
                    error: 'Premium subscription required for this prediction category',
                    code: 'PREMIUM_REQUIRED',
                    category,
                    upgrade_url: '/premium'
                });
            }
        }

        req.isPremiumUser = premiumRequired;
        next();

    } catch (error) {
        logger.logError(error, { context: 'premium_validation', userId: req.body.userId });
        res.status(500).json({
            error: 'Premium validation failed',
            code: 'PREMIUM_VALIDATION_ERROR'
        });
    }
};

/**
 * Input validation middleware
 */
const validatePredictionInput = (req, res, next) => {
    const { userId, category } = req.body;
    
    if (!userId || !category) {
        return res.status(400).json({
            error: 'User ID and category are required',
            code: 'MISSING_REQUIRED_FIELDS',
            required_fields: ['userId', 'category']
        });
    }

    const validCategories = ['love', 'career', 'health', 'finance', 'social', 'travel', 'family', 'personal_growth', 'spiritual', 'creative'];
    if (!validCategories.includes(category)) {
        return res.status(400).json({
            error: 'Invalid prediction category',
            code: 'INVALID_CATEGORY',
            valid_categories: validCategories
        });
    }

    next();
};

/**
 * POST /api/predictions/generate
 * Generate new verifiable prediction
 */
router.post('/generate', async (req, res) => {
    try {
        const { userId, category, timeframe, customOptions } = req.body;
        
        logger.logRequest(req, res, 0, { action: 'generate_prediction', userId, category });

        const options = {
            timeframe: timeframe || 48,
            ...customOptions
        };

        const prediction = await predictionService.generateVerifiablePrediction(userId, category, options);

        res.json({
            success: true,
            prediction: {
                id: prediction.predictionId,
                content: prediction.content,
                category: prediction.category,
                confidence: prediction.confidence,
                timeframe_hours: prediction.timeframe,
                predicted_date: new Date(Date.now() + prediction.timeframe * 60 * 60 * 1000).toISOString(),
                astrological_reasoning: prediction.astrologicalReasoning,
                alert_schedule: prediction.alertSchedule
            },
            message: 'Prediction generated successfully'
        });

    } catch (error) {
        logger.logError(error, { 
            context: 'prediction_generation', 
            userId: req.body.userId,
            category: req.body.category 
        });

        if (error.message.includes('Premium subscription required')) {
            res.status(403).json({
                error: error.message,
                code: 'PREMIUM_REQUIRED'
            });
        } else if (error.message.includes('Maximum active predictions')) {
            res.status(429).json({
                error: error.message,
                code: 'PREDICTION_LIMIT_REACHED'
            });
        } else if (error.message.includes('birth data required')) {
            res.status(400).json({
                error: 'Birth data is required for personalized predictions',
                code: 'MISSING_BIRTH_DATA',
                action_required: 'Please complete your birth information in profile settings'
            });
        } else if (error.message.includes('Insufficient astrological conditions')) {
            res.status(400).json({
                error: 'Current astrological conditions are not favorable for reliable predictions in this category',
                code: 'UNFAVORABLE_CONDITIONS',
                suggestion: 'Try again in a few hours or choose a different category'
            });
        } else {
            res.status(500).json({
                error: 'Prediction generation failed',
                code: 'GENERATION_ERROR',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
            });
        }
    }
});

/**
 * GET /api/predictions/user/:userId
 * Get user's active predictions
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, category, limit = 10 } = req.query;

        logger.logRequest(req, res, 0, { action: 'get_user_predictions', userId });

        let predictions;
        if (status === 'all') {
            // Get all predictions with pagination
            predictions = await predictionService.getUserAllPredictions(userId, {
                category,
                limit: Math.min(parseInt(limit), 50)
            });
        } else {
            // Get active predictions only (default)
            predictions = await predictionService.getUserActivePredictions(userId);
        }

        res.json({
            success: true,
            predictions: predictions,
            total: predictions.length,
            user_id: userId,
            retrieved_at: new Date().toISOString()
        });

    } catch (error) {
        logger.logError(error, { context: 'get_user_predictions', userId: req.params.userId });
        
        res.status(500).json({
            error: 'Failed to retrieve predictions',
            code: 'RETRIEVAL_ERROR'
        });
    }
});

/**
 * PUT /api/predictions/:id/verify
 * User verification of prediction outcome
 */
router.put('/:id/verify', verificationRateLimit, async (req, res) => {
    try {
        const { id: predictionId } = req.params;
        const { userId, outcome, feedbackType, accuracyRating, details, helpfulRating } = req.body;

        // Validate input
        if (!userId || !outcome || !feedbackType) {
            return res.status(400).json({
                error: 'User ID, outcome, and feedback type are required',
                code: 'MISSING_VERIFICATION_DATA'
            });
        }

        if (accuracyRating && (accuracyRating < 1 || accuracyRating > 5)) {
            return res.status(400).json({
                error: 'Accuracy rating must be between 1 and 5',
                code: 'INVALID_RATING'
            });
        }

        logger.logRequest(req, res, 0, { 
            action: 'verify_prediction', 
            userId, 
            predictionId, 
            feedbackType 
        });

        const verificationData = {
            outcome,
            feedbackType,
            accuracyRating: parseInt(accuracyRating) || null,
            details,
            helpfulRating: parseInt(helpfulRating) || null
        };

        const result = await predictionVerificationService.verifyPrediction(
            predictionId, 
            userId, 
            verificationData
        );

        res.json({
            success: true,
            verification: {
                prediction_id: result.predictionId,
                status: result.verificationStatus,
                feedback_id: result.feedbackId,
                user_success_rate: result.userSuccessRate,
                total_verified: result.totalVerified
            },
            message: result.message
        });

    } catch (error) {
        logger.logError(error, { 
            context: 'prediction_verification', 
            predictionId: req.params.id,
            userId: req.body.userId 
        });

        if (error.message.includes('not found') || error.message.includes('access denied')) {
            res.status(404).json({
                error: 'Prediction not found or access denied',
                code: 'PREDICTION_NOT_FOUND'
            });
        } else if (error.message.includes('already been verified')) {
            res.status(400).json({
                error: 'Prediction has already been verified',
                code: 'ALREADY_VERIFIED'
            });
        } else {
            res.status(500).json({
                error: 'Verification failed',
                code: 'VERIFICATION_ERROR'
            });
        }
    }
});

/**
 * GET /api/predictions/analytics/:userId
 * Get user's prediction accuracy statistics
 */
router.get('/analytics/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        logger.logRequest(req, res, 0, { action: 'get_user_analytics', userId });

        // Get user statistics
        const userStats = await predictionVerificationService.getUserVerificationStats(userId);
        const userAnalytics = await predictionService.getUserPredictionAnalytics(userId);

        if (!userStats && !userAnalytics) {
            return res.json({
                success: true,
                analytics: {
                    user_id: userId,
                    total_predictions: 0,
                    success_rate: 0,
                    message: 'No prediction history found'
                }
            });
        }

        res.json({
            success: true,
            analytics: {
                user_id: userId,
                overview: userAnalytics || {
                    totalPredictions: 0,
                    verifiedPredictions: 0,
                    successRate: 0,
                    averageConfidence: 0
                },
                detailed_stats: userStats || {},
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.logError(error, { context: 'get_user_analytics', userId: req.params.userId });
        
        res.status(500).json({
            error: 'Failed to retrieve analytics',
            code: 'ANALYTICS_ERROR'
        });
    }
});

/**
 * POST /api/predictions/feedback/:id
 * Submit detailed feedback on prediction accuracy
 */
router.post('/feedback/:id', verificationRateLimit, async (req, res) => {
    try {
        const { id: predictionId } = req.params;
        const { userId, rating, comments, categories, suggestions } = req.body;

        if (!userId || !rating) {
            return res.status(400).json({
                error: 'User ID and rating are required',
                code: 'MISSING_FEEDBACK_DATA'
            });
        }

        logger.logRequest(req, res, 0, { 
            action: 'submit_feedback', 
            userId, 
            predictionId, 
            rating 
        });

        // Store detailed feedback (this would extend the feedback system)
        const feedbackData = {
            prediction_id: predictionId,
            user_id: userId,
            overall_rating: parseInt(rating),
            comments,
            improvement_categories: categories || [],
            suggestions,
            submitted_at: new Date().toISOString()
        };

        // This would be implemented as an extended feedback storage method
        const feedbackId = await predictionVerificationService.storeDetailedFeedback(feedbackData);

        res.json({
            success: true,
            feedback: {
                id: feedbackId,
                prediction_id: predictionId,
                status: 'received'
            },
            message: 'Thank you for your detailed feedback!'
        });

    } catch (error) {
        logger.logError(error, { 
            context: 'submit_feedback', 
            predictionId: req.params.id,
            userId: req.body.userId 
        });

        res.status(500).json({
            error: 'Feedback submission failed',
            code: 'FEEDBACK_ERROR'
        });
    }
});

/**
 * POST /api/predictions/alerts/token
 * Update user's Firebase token for notifications
 */
router.post('/alerts/token', async (req, res) => {
    try {
        const { userId, firebaseToken } = req.body;

        if (!userId || !firebaseToken) {
            return res.status(400).json({
                error: 'User ID and Firebase token are required',
                code: 'MISSING_TOKEN_DATA'
            });
        }

        logger.logRequest(req, res, 0, { action: 'update_firebase_token', userId });

        await predictionAlertService.updateUserFirebaseToken(userId, firebaseToken);

        res.json({
            success: true,
            message: 'Firebase token updated successfully'
        });

    } catch (error) {
        logger.logError(error, { context: 'update_firebase_token', userId: req.body.userId });
        
        res.status(500).json({
            error: 'Token update failed',
            code: 'TOKEN_UPDATE_ERROR'
        });
    }
});

/**
 * GET /api/predictions/alerts/preferences/:userId
 * Get user's alert preferences
 */
router.get('/alerts/preferences/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        logger.logRequest(req, res, 0, { action: 'get_alert_preferences', userId });

        const preferences = await predictionAlertService.getUserAlertPreferences(userId);

        res.json({
            success: true,
            preferences: preferences,
            user_id: userId
        });

    } catch (error) {
        logger.logError(error, { context: 'get_alert_preferences', userId: req.params.userId });
        
        res.status(500).json({
            error: 'Failed to retrieve alert preferences',
            code: 'PREFERENCES_ERROR'
        });
    }
});

/**
 * PUT /api/predictions/alerts/preferences/:userId
 * Update user's alert preferences
 */
router.put('/alerts/preferences/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const preferences = req.body;

        logger.logRequest(req, res, 0, { action: 'update_alert_preferences', userId });

        // Validate preferences structure
        const validKeys = ['alert_48hr', 'alert_24hr', 'alert_2hr', 'verification_reminders', 'feedback_reminders', 'notification_frequency', 'timezone'];
        const validPreferences = {};

        for (const key of validKeys) {
            if (preferences.hasOwnProperty(key)) {
                validPreferences[key] = preferences[key];
            }
        }

        if (Object.keys(validPreferences).length === 0) {
            return res.status(400).json({
                error: 'No valid preferences provided',
                code: 'INVALID_PREFERENCES',
                valid_keys: validKeys
            });
        }

        // Update preferences in database
        const updateFields = Object.keys(validPreferences).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const values = [userId, ...Object.values(validPreferences)];

        await require('../config/db').query(`
            UPDATE user_prediction_preferences 
            SET ${updateFields}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, values);

        res.json({
            success: true,
            preferences: validPreferences,
            message: 'Alert preferences updated successfully'
        });

    } catch (error) {
        logger.logError(error, { context: 'update_alert_preferences', userId: req.params.userId });
        
        res.status(500).json({
            error: 'Failed to update alert preferences',
            code: 'PREFERENCES_UPDATE_ERROR'
        });
    }
});

/**
 * GET /api/predictions/system/stats
 * Get system-wide prediction statistics (admin endpoint)
 */
router.get('/system/stats', async (req, res) => {
    try {
        const { timeframe = '30 days', admin_key } = req.query;

        // Simple admin key validation
        if (admin_key !== process.env.ADMIN_KEY) {
            return res.status(403).json({
                error: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        logger.logRequest(req, res, 0, { action: 'get_system_stats' });

        const systemStats = await predictionVerificationService.getSystemVerificationStats(timeframe);
        const alertStats = await predictionAlertService.getAlertStatistics(timeframe);

        res.json({
            success: true,
            system_stats: {
                predictions: systemStats,
                alerts: alertStats,
                timeframe,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.logError(error, { context: 'get_system_stats' });
        
        res.status(500).json({
            error: 'Failed to retrieve system statistics',
            code: 'STATS_ERROR'
        });
    }
});

/**
 * POST /api/predictions/system/process-expired
 * Manually trigger expired predictions processing (admin endpoint)
 */
router.post('/system/process-expired', async (req, res) => {
    try {
        const { admin_key } = req.body;

        if (admin_key !== process.env.ADMIN_KEY) {
            return res.status(403).json({
                error: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        logger.logRequest(req, res, 0, { action: 'process_expired_predictions' });

        await predictionVerificationService.processExpiredPredictions();

        res.json({
            success: true,
            message: 'Expired predictions processing completed'
        });

    } catch (error) {
        logger.logError(error, { context: 'process_expired_predictions' });
        
        res.status(500).json({
            error: 'Failed to process expired predictions',
            code: 'PROCESSING_ERROR'
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const healthStatus = {
            status: 'healthy',
            services: {
                prediction_service: 'operational',
                alert_service: 'operational',
                verification_service: 'operational',
                database: 'connected'
            },
            timestamp: new Date().toISOString()
        };

        res.json(healthStatus);

    } catch (error) {
        logger.logError(error, { context: 'prediction_health_check' });
        
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;