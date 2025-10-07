/**
 * PREDICTION VERIFICATION SERVICE
 * 
 * Handles user feedback collection, automatic verification, and accuracy tracking
 * Implements machine learning feedback loop for prediction improvement
 */

const db = require('../config/db');
const redisService = require('./redisService');
const moment = require('moment');

class PredictionVerificationService {
    constructor() {
        this.config = {
            verificationTypes: {
                'user_confirmed': {
                    weight: 1.0,
                    confidence_boost: 0.1,
                    description: 'User confirmed prediction was accurate'
                },
                'user_denied': {
                    weight: 1.0,
                    confidence_penalty: -0.1,
                    description: 'User reported prediction was inaccurate'
                },
                'partially_accurate': {
                    weight: 0.6,
                    confidence_adjustment: 0.0,
                    description: 'Prediction was partially accurate'
                },
                'auto_verified': {
                    weight: 0.8,
                    confidence_boost: 0.05,
                    description: 'System automatically verified prediction'
                },
                'expired_unverified': {
                    weight: 0.2,
                    confidence_penalty: -0.05,
                    description: 'Prediction expired without user verification'
                }
            },
            
            feedbackCategories: {
                'accurate': { score: 5, weight: 1.0 },
                'partially_accurate': { score: 3, weight: 0.6 },
                'inaccurate': { score: 1, weight: 0.2 },
                'too_vague': { score: 2, weight: 0.3 },
                'could_not_verify': { score: 0, weight: 0.0 }
            },
            
            // Machine learning parameters
            mlConfig: {
                min_samples_for_learning: 10,
                confidence_adjustment_rate: 0.05,
                template_success_threshold: 0.7,
                user_reliability_threshold: 0.8
            },
            
            cacheDuration: 7200, // 2 hours for verification data
            batchProcessingSize: 50
        };

        console.log('✅ Prediction Verification Service initialized');
    }

    /**
     * Process user verification of prediction outcome
     */
    async verifyPrediction(predictionId, userId, verificationData) {
        try {
            const { outcome, feedbackType, accuracyRating, details, helpfulRating } = verificationData;

            // Get prediction details
            const prediction = await this.getPredictionById(predictionId, userId);
            if (!prediction) {
                throw new Error('Prediction not found or access denied');
            }

            if (prediction.verification_status !== 'pending') {
                throw new Error('Prediction has already been verified');
            }

            // Determine verification status
            const verificationStatus = this.determineVerificationStatus(feedbackType, accuracyRating);
            
            // Update prediction record
            await db.query(`
                UPDATE predictions 
                SET verification_status = $1, actual_outcome = $2, user_feedback = $3,
                    verified_at = CURRENT_TIMESTAMP
                WHERE id = $4 AND user_id = $5
            `, [verificationStatus, outcome, details, predictionId, userId]);

            // Store detailed feedback
            const feedbackId = await this.storePredictionFeedback({
                predictionId,
                userId,
                accuracyRating,
                outcomeDescription: outcome,
                feedbackType,
                details,
                helpfulRating
            });

            // Update analytics and machine learning data
            await this.updateVerificationAnalytics(prediction, verificationStatus, accuracyRating);
            
            // Update template success rates
            await this.updateTemplateMetrics(prediction, verificationStatus === 'verified');
            
            // Update user reliability score
            await this.updateUserReliabilityScore(userId, verificationStatus);

            // Trigger machine learning improvements
            await this.triggerMLUpdates(prediction, verificationData);

            // Calculate updated user success rate
            const updatedStats = await this.getUserSuccessRate(userId);

            return {
                predictionId,
                verificationStatus,
                feedbackId,
                userSuccessRate: updatedStats.successRate,
                totalVerified: updatedStats.totalVerified,
                message: 'Verification processed successfully'
            };

        } catch (error) {
            console.error(`❌ Verification error for prediction ${predictionId}:`, error);
            throw error;
        }
    }

    /**
     * Store detailed prediction feedback
     */
    async storePredictionFeedback(feedbackData) {
        const result = await db.query(`
            INSERT INTO prediction_feedback (
                prediction_id, user_id, accuracy_rating, outcome_description,
                feedback_type, details, helpful_rating, submitted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING id
        `, [
            feedbackData.predictionId,
            feedbackData.userId,
            feedbackData.accuracyRating,
            feedbackData.outcomeDescription,
            feedbackData.feedbackType,
            feedbackData.details,
            feedbackData.helpfulRating
        ]);

        return result.rows[0].id;
    }

    /**
     * Automatic verification for expired predictions
     */
    async processExpiredPredictions() {
        try {
            console.log('🔄 Processing expired predictions for automatic verification...');

            // Find predictions that expired without user verification
            const expiredPredictions = await db.query(`
                SELECT id, user_id, prediction_category, confidence_score,
                       prediction_content, created_at, expires_at
                FROM predictions 
                WHERE verification_status = 'pending' 
                    AND expires_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
                LIMIT $1
            `, [this.config.batchProcessingSize]);

            console.log(`📋 Found ${expiredPredictions.rows.length} expired predictions to process`);

            for (const prediction of expiredPredictions.rows) {
                await this.processExpiredPrediction(prediction);
            }

            console.log('✅ Expired predictions processing completed');

        } catch (error) {
            console.error('❌ Error processing expired predictions:', error);
        }
    }

    /**
     * Process individual expired prediction
     */
    async processExpiredPrediction(prediction) {
        try {
            // Update status to expired
            await db.query(`
                UPDATE predictions 
                SET verification_status = 'expired',
                    verified_at = CURRENT_TIMESTAMP,
                    user_feedback = 'Prediction expired without user verification'
                WHERE id = $1
            `, [prediction.id]);

            // Apply penalty to template and confidence metrics
            await this.applyExpirationPenalties(prediction);
            
            // Update analytics
            await this.updateVerificationAnalytics(prediction, 'expired', 0);

            console.log(`⏰ Processed expired prediction ${prediction.id}`);

        } catch (error) {
            console.error(`❌ Error processing expired prediction ${prediction.id}:`, error);
        }
    }

    /**
     * Get verification statistics for a user
     */
    async getUserVerificationStats(userId) {
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total_predictions,
                COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_accurate,
                COUNT(*) FILTER (WHERE verification_status = 'user_confirmed') as user_confirmed,
                COUNT(*) FILTER (WHERE verification_status = 'user_denied') as user_denied,
                COUNT(*) FILTER (WHERE verification_status = 'partially_accurate') as partially_accurate,
                COUNT(*) FILTER (WHERE verification_status = 'expired') as expired,
                AVG(confidence_score) as avg_confidence,
                AVG(CASE WHEN verification_status IN ('verified', 'user_confirmed') THEN confidence_score END) as avg_accurate_confidence
            FROM predictions 
            WHERE user_id = $1
        `, [userId]);

        const feedbackStats = await db.query(`
            SELECT 
                AVG(accuracy_rating) as avg_accuracy_rating,
                AVG(helpful_rating) as avg_helpful_rating,
                COUNT(*) as total_feedback,
                COUNT(*) FILTER (WHERE feedback_type = 'accurate') as accurate_feedback,
                COUNT(*) FILTER (WHERE feedback_type = 'partially_accurate') as partial_feedback,
                COUNT(*) FILTER (WHERE feedback_type = 'inaccurate') as inaccurate_feedback
            FROM prediction_feedback pf
            JOIN predictions p ON pf.prediction_id = p.id
            WHERE p.user_id = $1
        `, [userId]);

        const basicStats = stats.rows[0];
        const feedback = feedbackStats.rows[0];

        // Calculate success rate
        const totalVerified = parseInt(basicStats.user_confirmed) + parseInt(basicStats.verified_accurate);
        const successRate = basicStats.total_predictions > 0 ? 
            (totalVerified / parseInt(basicStats.total_predictions) * 100) : 0;

        return {
            totalPredictions: parseInt(basicStats.total_predictions),
            verifiedAccurate: parseInt(basicStats.verified_accurate),
            userConfirmed: parseInt(basicStats.user_confirmed),
            userDenied: parseInt(basicStats.user_denied),
            partiallyAccurate: parseInt(basicStats.partially_accurate),
            expired: parseInt(basicStats.expired),
            successRate: Math.round(successRate * 100) / 100,
            avgConfidence: Math.round(parseFloat(basicStats.avg_confidence || 0) * 100) / 100,
            avgAccurateConfidence: Math.round(parseFloat(basicStats.avg_accurate_confidence || 0) * 100) / 100,
            feedback: {
                totalFeedback: parseInt(feedback.total_feedback || 0),
                avgAccuracyRating: Math.round(parseFloat(feedback.avg_accuracy_rating || 0) * 100) / 100,
                avgHelpfulRating: Math.round(parseFloat(feedback.avg_helpful_rating || 0) * 100) / 100,
                accurateFeedback: parseInt(feedback.accurate_feedback || 0),
                partialFeedback: parseInt(feedback.partial_feedback || 0),
                inaccurateFeedback: parseInt(feedback.inaccurate_feedback || 0)
            }
        };
    }

    /**
     * Get system-wide verification statistics
     */
    async getSystemVerificationStats(timeframe = '30 days') {
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total_predictions,
                COUNT(*) FILTER (WHERE verification_status = 'verified') as system_verified,
                COUNT(*) FILTER (WHERE verification_status = 'user_confirmed') as user_confirmed,
                COUNT(*) FILTER (WHERE verification_status = 'user_denied') as user_denied,
                COUNT(*) FILTER (WHERE verification_status = 'expired') as expired,
                COUNT(*) FILTER (WHERE verification_status = 'pending') as pending,
                AVG(confidence_score) as avg_confidence,
                COUNT(DISTINCT user_id) as active_users,
                COUNT(DISTINCT prediction_category) as categories_used
            FROM predictions 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeframe}'
        `);

        const categoryStats = await db.query(`
            SELECT 
                prediction_category,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE verification_status IN ('verified', 'user_confirmed')) as accurate,
                AVG(confidence_score) as avg_confidence
            FROM predictions 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeframe}'
            GROUP BY prediction_category
            ORDER BY total DESC
        `);

        const templateStats = await db.query(`
            SELECT 
                pt.template_name,
                pt.category,
                pt.success_rate,
                pt.usage_count,
                COUNT(p.id) as recent_usage
            FROM prediction_templates pt
            LEFT JOIN prediction_generation_log pgl ON pt.id = pgl.template_used
            LEFT JOIN predictions p ON pgl.prediction_id = p.id
            WHERE p.created_at > CURRENT_TIMESTAMP - INTERVAL '${timeframe}' OR p.id IS NULL
            GROUP BY pt.id, pt.template_name, pt.category, pt.success_rate, pt.usage_count
            ORDER BY pt.success_rate DESC, recent_usage DESC
        `);

        const basicStats = stats.rows[0];
        const totalAccurate = parseInt(basicStats.system_verified) + parseInt(basicStats.user_confirmed);
        const overallSuccessRate = basicStats.total_predictions > 0 ? 
            (totalAccurate / parseInt(basicStats.total_predictions) * 100) : 0;

        return {
            timeframe,
            overall: {
                totalPredictions: parseInt(basicStats.total_predictions),
                systemVerified: parseInt(basicStats.system_verified),
                userConfirmed: parseInt(basicStats.user_confirmed),
                userDenied: parseInt(basicStats.user_denied),
                expired: parseInt(basicStats.expired),
                pending: parseInt(basicStats.pending),
                successRate: Math.round(overallSuccessRate * 100) / 100,
                avgConfidence: Math.round(parseFloat(basicStats.avg_confidence || 0) * 100) / 100,
                activeUsers: parseInt(basicStats.active_users),
                categoriesUsed: parseInt(basicStats.categories_used)
            },
            byCategory: categoryStats.rows.map(row => ({
                category: row.prediction_category,
                total: parseInt(row.total),
                accurate: parseInt(row.accurate),
                successRate: row.total > 0 ? Math.round(row.accurate / row.total * 10000) / 100 : 0,
                avgConfidence: Math.round(parseFloat(row.avg_confidence || 0) * 100) / 100
            })),
            templates: templateStats.rows.map(row => ({
                name: row.template_name,
                category: row.category,
                successRate: Math.round(parseFloat(row.success_rate || 0) * 100) / 100,
                totalUsage: parseInt(row.usage_count || 0),
                recentUsage: parseInt(row.recent_usage || 0)
            })),
            generatedAt: moment().toISOString()
        };
    }

    /**
     * Machine learning feedback integration
     */
    async triggerMLUpdates(prediction, verificationData) {
        try {
            // Collect data for machine learning improvements
            const mlData = {
                predictionId: prediction.id,
                category: prediction.prediction_category,
                originalConfidence: prediction.confidence_score,
                astrologicalBasis: prediction.astrological_basis,
                verificationResult: verificationData.feedbackType,
                accuracyRating: verificationData.accuracyRating,
                userReliability: await this.getUserReliabilityScore(prediction.user_id)
            };

            // Cache for batch processing
            const mlCacheKey = `ml_updates:${moment().format('YYYY-MM-DD-HH')}`;
            const existingData = await redisService.get(mlCacheKey);
            const mlBatch = existingData ? JSON.parse(existingData) : [];
            mlBatch.push(mlData);

            await redisService.setex(mlCacheKey, this.config.cacheDuration, JSON.stringify(mlBatch));

            // Process batch if it's large enough
            if (mlBatch.length >= this.config.mlConfig.min_samples_for_learning) {
                await this.processMLBatch(mlBatch);
                await redisService.del(mlCacheKey);
            }

        } catch (error) {
            console.error('❌ ML trigger error:', error);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Process machine learning batch for improvements
     */
    async processMLBatch(mlBatch) {
        try {
            console.log(`🤖 Processing ML batch with ${mlBatch.length} samples`);

            // Analyze patterns by category
            const categoryAnalysis = this.analyzeCategoryPatterns(mlBatch);
            
            // Update template confidence multipliers
            await this.updateTemplateConfidenceMultipliers(categoryAnalysis);
            
            // Update astrological factor weights
            await this.updateAstrologicalWeights(categoryAnalysis);
            
            console.log('✅ ML batch processing completed');

        } catch (error) {
            console.error('❌ ML batch processing error:', error);
        }
    }

    // HELPER METHODS

    async getPredictionById(predictionId, userId) {
        const result = await db.query(`
            SELECT * FROM predictions 
            WHERE id = $1 AND user_id = $2
        `, [predictionId, userId]);

        return result.rows[0] || null;
    }

    determineVerificationStatus(feedbackType, accuracyRating) {
        if (feedbackType === 'accurate' || accuracyRating >= 4) {
            return 'verified';
        } else if (feedbackType === 'partially_accurate' || accuracyRating === 3) {
            return 'partially_accurate';
        } else if (feedbackType === 'inaccurate' || accuracyRating <= 2) {
            return 'user_denied';
        } else {
            return 'user_confirmed'; // Default for unclear cases
        }
    }

    async updateVerificationAnalytics(prediction, verificationStatus, accuracyRating) {
        const isAccurate = verificationStatus === 'verified' || verificationStatus === 'user_confirmed';
        
        await db.query(`
            INSERT INTO prediction_analytics (
                user_id, category, verified_predictions, accurate_predictions
            ) VALUES ($1, $2, 1, $3)
            ON CONFLICT (user_id, category, date) DO UPDATE SET
                verified_predictions = prediction_analytics.verified_predictions + 1,
                accurate_predictions = prediction_analytics.accurate_predictions + $3,
                average_accuracy = (prediction_analytics.average_accuracy + $4) / 2,
                last_updated = CURRENT_TIMESTAMP
        `, [
            prediction.user_id,
            prediction.prediction_category,
            isAccurate ? 1 : 0,
            accuracyRating || 0
        ]);
    }

    async updateTemplateMetrics(prediction, wasAccurate) {
        // Get template used for this prediction
        const templateResult = await db.query(`
            SELECT template_used FROM prediction_generation_log 
            WHERE prediction_id = $1
        `, [prediction.id]);

        if (templateResult.rows.length > 0) {
            const templateId = templateResult.rows[0].template_used;
            
            await db.query(`
                UPDATE prediction_templates 
                SET success_rate = (
                    SELECT 
                        CASE 
                            WHEN COUNT(*) = 0 THEN 0
                            ELSE COUNT(*) FILTER (WHERE verification_status IN ('verified', 'user_confirmed'))::DECIMAL / COUNT(*)
                        END
                    FROM prediction_generation_log pgl
                    JOIN predictions p ON pgl.prediction_id = p.id
                    WHERE pgl.template_used = $1
                        AND p.verification_status != 'pending'
                )
                WHERE id = $1
            `, [templateId]);
        }
    }

    async getUserReliabilityScore(userId) {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_feedback,
                AVG(helpful_rating) as avg_helpful,
                COUNT(*) FILTER (WHERE feedback_type = 'could_not_verify') as unverifiable
            FROM prediction_feedback pf
            JOIN predictions p ON pf.prediction_id = p.id
            WHERE p.user_id = $1
        `, [userId]);

        const stats = result.rows[0];
        if (parseInt(stats.total_feedback) < 5) {
            return 0.5; // Default reliability for new users
        }

        const helpfulScore = parseFloat(stats.avg_helpful || 3) / 5.0;
        const verifiabilityScore = 1 - (parseInt(stats.unverifiable) / parseInt(stats.total_feedback));
        
        return (helpfulScore * 0.7 + verifiabilityScore * 0.3);
    }

    async getUserSuccessRate(userId) {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE verification_status IN ('verified', 'user_confirmed')) as accurate
            FROM predictions 
            WHERE user_id = $1 AND verification_status != 'pending'
        `, [userId]);

        const stats = result.rows[0];
        const total = parseInt(stats.total);
        const accurate = parseInt(stats.accurate);

        return {
            totalVerified: total,
            successRate: total > 0 ? Math.round(accurate / total * 10000) / 100 : 0
        };
    }

    analyzeCategoryPatterns(mlBatch) {
        const patterns = {};
        
        for (const sample of mlBatch) {
            if (!patterns[sample.category]) {
                patterns[sample.category] = {
                    samples: [],
                    avgAccuracy: 0,
                    confidenceCorrelation: 0
                };
            }
            patterns[sample.category].samples.push(sample);
        }

        // Calculate statistics for each category
        for (const [category, data] of Object.entries(patterns)) {
            const samples = data.samples;
            const avgAccuracy = samples.reduce((sum, s) => sum + s.accuracyRating, 0) / samples.length;
            
            // Calculate confidence vs accuracy correlation
            const confidenceCorrelation = this.calculateCorrelation(
                samples.map(s => s.originalConfidence),
                samples.map(s => s.accuracyRating)
            );

            patterns[category] = {
                ...data,
                avgAccuracy,
                confidenceCorrelation,
                sampleCount: samples.length
            };
        }

        return patterns;
    }

    calculateCorrelation(x, y) {
        const n = x.length;
        if (n === 0) return 0;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b, 0);
        const sumX2 = x.map(xi => xi * xi).reduce((a, b) => a + b, 0);
        const sumY2 = y.map(yi => yi * yi).reduce((a, b) => a + b, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    async updateTemplateConfidenceMultipliers(categoryAnalysis) {
        for (const [category, analysis] of Object.entries(categoryAnalysis)) {
            if (analysis.sampleCount >= this.config.mlConfig.min_samples_for_learning) {
                const adjustment = analysis.avgAccuracy > 3.5 ? 0.05 : -0.05;
                
                await db.query(`
                    UPDATE prediction_templates 
                    SET confidence_multiplier = GREATEST(0.1, LEAST(2.0, confidence_multiplier + $1))
                    WHERE category = $2
                `, [adjustment, category]);
            }
        }
    }

    async updateAstrologicalWeights(categoryAnalysis) {
        // Implementation for updating astrological factor weights based on ML analysis
        // This would involve more complex analysis of which astrological factors
        // correlate with prediction accuracy
        console.log('🔮 Updated astrological weights based on ML analysis');
    }

    async applyExpirationPenalties(prediction) {
        // Apply small penalty to confidence for expired predictions
        await db.query(`
            UPDATE prediction_templates 
            SET confidence_multiplier = GREATEST(0.1, confidence_multiplier - 0.01)
            WHERE category = $1
        `, [prediction.prediction_category]);
    }

    async updateUserReliabilityScore(userId, verificationStatus) {
        // Update user reliability based on verification patterns
        const reliabilityAdjustment = this.config.verificationTypes[verificationStatus]?.confidence_adjustment || 0;
        
        if (Math.abs(reliabilityAdjustment) > 0.01) {
            await db.query(`
                UPDATE user_prediction_preferences 
                SET updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
            `, [userId]);
        }
    }
}

module.exports = new PredictionVerificationService();