/**
 * PREDICTION ALERT SERVICE
 * 
 * Manages 48-hour alert system for verifiable predictions
 * Integrates with Firebase Cloud Messaging for push notifications
 */

const db = require('../config/db');
const firebaseService = require('./firebaseService');
const redisService = require('./redisService');
const moment = require('moment');
const cron = require('node-cron');

class PredictionAlertService {
    constructor() {
        this.config = {
            alertTypes: {
                '48hr_warning': {
                    title: '🔮 Prediction Alert: 48 Hours',
                    template: 'Your {category} prediction is approaching! Get ready for the next 48 hours.',
                    urgency: 'low',
                    sound: 'default'
                },
                '24hr_warning': {
                    title: '🌟 Prediction Alert: 24 Hours',
                    template: 'Your {category} prediction window opens in 24 hours. Stay aware!',
                    urgency: 'medium',
                    sound: 'default'
                },
                '2hr_warning': {
                    title: '⚡ Prediction Alert: 2 Hours',
                    template: 'Your {category} prediction is imminent! Pay close attention.',
                    urgency: 'high',
                    sound: 'default'
                },
                'verification_reminder': {
                    title: '📝 Verify Your Prediction',
                    template: 'Did your {category} prediction come true? Help us improve by sharing feedback.',
                    urgency: 'low',
                    sound: 'default'
                },
                'follow_up': {
                    title: '💫 Prediction Follow-up',
                    template: 'How accurate was your recent {category} prediction? Rate your experience.',
                    urgency: 'low',
                    sound: 'default'
                }
            },
            
            retryConfig: {
                maxRetries: 3,
                retryDelays: [5, 15, 60], // minutes
                exponentialBackoff: true
            },
            
            cacheDuration: 3600, // 1 hour cache for user tokens
            batchSize: 100, // Process alerts in batches
            rateLimitPerMinute: 200 // Firebase FCM rate limit
        };

        // Initialize cron jobs for alert processing
        this.initializeCronJobs();
        
        console.log('🚨 Prediction Alert Service initialized with Firebase integration');
    }

    /**
     * Initialize cron jobs for automated alert processing
     */
    initializeCronJobs() {
        // Process pending alerts every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            await this.processPendingAlerts();
        });

        // Cleanup old alerts daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            await this.cleanupOldAlerts();
        });

        // Generate follow-up alerts for unverified predictions
        cron.schedule('0 12 * * *', async () => {
            await this.generateFollowUpAlerts();
        });

        console.log('✅ Prediction alert cron jobs initialized');
    }

    /**
     * Schedule alert for a specific prediction
     */
    async scheduleAlert(predictionId, alertDate, alertType, customMessage = null) {
        try {
            // Validate alert type
            if (!this.config.alertTypes[alertType]) {
                throw new Error(`Invalid alert type: ${alertType}`);
            }

            // Get prediction details for context
            const prediction = await this.getPredictionDetails(predictionId);
            if (!prediction) {
                throw new Error('Prediction not found');
            }

            // Get user Firebase token
            const userToken = await this.getUserFirebaseToken(prediction.user_id);

            // Store alert in database
            const alertId = await db.query(`
                INSERT INTO prediction_alerts (
                    prediction_id, alert_type, alert_date, firebase_token
                ) VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [predictionId, alertType, alertDate, userToken]);

            console.log(`📅 Scheduled ${alertType} alert for prediction ${predictionId} at ${alertDate}`);
            
            return alertId.rows[0].id;

        } catch (error) {
            console.error(`❌ Error scheduling alert:`, error);
            throw error;
        }
    }

    /**
     * Process all pending alerts that are due
     */
    async processPendingAlerts() {
        try {
            console.log('🔄 Processing pending prediction alerts...');

            // Get alerts due for delivery
            const pendingAlerts = await db.query(`
                SELECT pa.*, p.prediction_content, p.prediction_category, p.user_id
                FROM prediction_alerts pa
                JOIN predictions p ON pa.prediction_id = p.id
                WHERE pa.sent = FALSE 
                    AND pa.alert_date <= CURRENT_TIMESTAMP
                    AND pa.retry_count < $1
                ORDER BY pa.alert_date ASC
                LIMIT $2
            `, [this.config.retryConfig.maxRetries, this.config.batchSize]);

            if (pendingAlerts.rows.length === 0) {
                return;
            }

            console.log(`📨 Processing ${pendingAlerts.rows.length} pending alerts`);

            // Process alerts in parallel with rate limiting
            const alertPromises = pendingAlerts.rows.map(alert => 
                this.deliverAlert(alert).catch(error => {
                    console.error(`❌ Alert delivery failed for alert ${alert.id}:`, error);
                    return this.handleAlertFailure(alert.id, error.message);
                })
            );

            await Promise.allSettled(alertPromises);
            
            console.log('✅ Pending alerts processing completed');

        } catch (error) {
            console.error('❌ Error processing pending alerts:', error);
        }
    }

    /**
     * Deliver individual alert
     */
    async deliverAlert(alert) {
        try {
            const alertConfig = this.config.alertTypes[alert.alert_type];
            
            // Prepare notification content
            const notification = {
                title: alertConfig.title,
                body: this.formatAlertMessage(alertConfig.template, {
                    category: this.formatCategory(alert.prediction_category),
                    prediction: this.truncateText(alert.prediction_content, 50)
                }),
                data: {
                    type: 'prediction_alert',
                    alertType: alert.alert_type,
                    predictionId: alert.prediction_id.toString(),
                    category: alert.prediction_category,
                    urgency: alertConfig.urgency
                },
                android: {
                    priority: alertConfig.urgency === 'high' ? 'high' : 'normal',
                    notification: {
                        sound: alertConfig.sound,
                        channelId: 'prediction_alerts'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: alertConfig.sound,
                            badge: await this.getUserBadgeCount(alert.user_id)
                        }
                    }
                }
            };

            // Send via Firebase
            const result = await this.sendFirebaseNotification(
                alert.firebase_token || await this.getUserFirebaseToken(alert.user_id),
                notification
            );

            if (result.success) {
                // Mark alert as sent
                await db.query(`
                    UPDATE prediction_alerts 
                    SET sent = TRUE, sent_at = CURRENT_TIMESTAMP 
                    WHERE id = $1
                `, [alert.id]);

                console.log(`✅ Alert ${alert.id} delivered successfully`);
                
                // Cache user engagement
                await this.trackAlertDelivery(alert.user_id, alert.alert_type);

            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error(`❌ Alert delivery failed for alert ${alert.id}:`, error);
            await this.handleAlertFailure(alert.id, error.message);
            throw error;
        }
    }

    /**
     * Send Firebase Cloud Messaging notification
     */
    async sendFirebaseNotification(token, notification) {
        try {
            if (!token) {
                throw new Error('No Firebase token available');
            }

            // Check if Firebase service is available
            if (!firebaseService.isInitialized()) {
                console.warn('⚠️ Firebase not initialized, using mock delivery');
                return { success: true, messageId: 'mock_' + Date.now() };
            }

            // Send notification via Firebase Admin SDK
            const message = {
                token: token,
                ...notification
            };

            const response = await firebaseService.sendMessage(message);
            
            return {
                success: true,
                messageId: response.messageId || response,
                token: token
            };

        } catch (error) {
            console.error('❌ Firebase notification error:', error);
            
            // Handle token errors
            if (error.code === 'messaging/invalid-registration-token' || 
                error.code === 'messaging/registration-token-not-registered') {
                await this.handleInvalidToken(token);
            }

            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Handle alert delivery failure
     */
    async handleAlertFailure(alertId, errorMessage) {
        try {
            // Get current retry count
            const alertData = await db.query(`
                SELECT retry_count, alert_type FROM prediction_alerts 
                WHERE id = $1
            `, [alertId]);

            if (alertData.rows.length === 0) return;

            const currentRetries = alertData.rows[0].retry_count;
            const alertType = alertData.rows[0].alert_type;

            if (currentRetries < this.config.retryConfig.maxRetries) {
                // Schedule retry
                const retryDelay = this.config.retryConfig.retryDelays[currentRetries] || 60;
                const nextRetryDate = moment().add(retryDelay, 'minutes').toISOString();

                await db.query(`
                    UPDATE prediction_alerts 
                    SET retry_count = retry_count + 1,
                        alert_date = $1,
                        error_message = $2
                    WHERE id = $3
                `, [nextRetryDate, errorMessage, alertId]);

                console.log(`🔄 Scheduled retry ${currentRetries + 1} for alert ${alertId} in ${retryDelay} minutes`);

            } else {
                // Max retries reached, mark as failed
                await db.query(`
                    UPDATE prediction_alerts 
                    SET error_message = $1
                    WHERE id = $2
                `, [`Max retries reached: ${errorMessage}`, alertId]);

                console.error(`❌ Alert ${alertId} failed permanently after ${currentRetries} retries`);
            }

        } catch (error) {
            console.error('❌ Error handling alert failure:', error);
        }
    }

    /**
     * Get user's Firebase token
     */
    async getUserFirebaseToken(userId) {
        try {
            // Try cache first
            const cacheKey = `firebase_token:${userId}`;
            const cachedToken = await redisService.get(cacheKey);
            
            if (cachedToken) {
                return cachedToken;
            }

            // Get from database
            const result = await db.query(`
                SELECT firebase_token FROM user_prediction_preferences
                WHERE user_id = $1
            `, [userId]);

            const token = result.rows[0]?.firebase_token;
            
            if (token) {
                // Cache for future use
                await redisService.setex(cacheKey, this.config.cacheDuration, token);
            }

            return token;

        } catch (error) {
            console.error('❌ Error getting Firebase token:', error);
            return null;
        }
    }

    /**
     * Update user's Firebase token
     */
    async updateUserFirebaseToken(userId, token) {
        try {
            // Update in database
            await db.query(`
                INSERT INTO user_prediction_preferences (user_id, firebase_token)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET
                    firebase_token = $2,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, token]);

            // Update cache
            const cacheKey = `firebase_token:${userId}`;
            await redisService.setex(cacheKey, this.config.cacheDuration, token);

            console.log(`✅ Firebase token updated for user ${userId}`);

        } catch (error) {
            console.error('❌ Error updating Firebase token:', error);
            throw error;
        }
    }

    /**
     * Get user's alert preferences
     */
    async getUserAlertPreferences(userId) {
        const result = await db.query(`
            SELECT alert_48hr, alert_24hr, alert_2hr, verification_reminders, 
                   feedback_reminders, notification_frequency, timezone
            FROM user_prediction_preferences
            WHERE user_id = $1
        `, [userId]);

        return result.rows[0] || {
            alert_48hr: true,
            alert_24hr: true,
            alert_2hr: false,
            verification_reminders: true,
            feedback_reminders: true,
            notification_frequency: 'normal',
            timezone: 'UTC'
        };
    }

    /**
     * Generate follow-up alerts for unverified predictions
     */
    async generateFollowUpAlerts() {
        try {
            console.log('🔄 Generating follow-up alerts for unverified predictions...');

            // Find predictions that expired 24-72 hours ago without verification
            const unverifiedPredictions = await db.query(`
                SELECT p.*, upp.feedback_reminders
                FROM predictions p
                LEFT JOIN user_prediction_preferences upp ON p.user_id = upp.user_id
                WHERE p.verification_status = 'pending'
                    AND p.expires_at BETWEEN CURRENT_TIMESTAMP - INTERVAL '72 hours' 
                    AND CURRENT_TIMESTAMP - INTERVAL '24 hours'
                    AND (upp.feedback_reminders IS NULL OR upp.feedback_reminders = TRUE)
                    AND NOT EXISTS (
                        SELECT 1 FROM prediction_alerts pa 
                        WHERE pa.prediction_id = p.id 
                        AND pa.alert_type = 'follow_up'
                    )
            `);

            console.log(`📋 Found ${unverifiedPredictions.rows.length} unverified predictions for follow-up`);

            for (const prediction of unverifiedPredictions.rows) {
                const followUpDate = moment().add(1, 'hour').toISOString();
                
                await this.scheduleAlert(
                    prediction.id,
                    followUpDate,
                    'follow_up'
                );
            }

            console.log('✅ Follow-up alerts generation completed');

        } catch (error) {
            console.error('❌ Error generating follow-up alerts:', error);
        }
    }

    /**
     * Cleanup old alerts
     */
    async cleanupOldAlerts() {
        try {
            console.log('🧹 Cleaning up old prediction alerts...');

            // Delete alerts older than 30 days
            const result = await db.query(`
                DELETE FROM prediction_alerts 
                WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
            `);

            console.log(`🗑️ Cleaned up ${result.rowCount} old alerts`);

        } catch (error) {
            console.error('❌ Error cleaning up old alerts:', error);
        }
    }

    /**
     * Get alert statistics
     */
    async getAlertStatistics(timeRange = '7 days') {
        try {
            const stats = await db.query(`
                SELECT 
                    alert_type,
                    COUNT(*) as total_scheduled,
                    COUNT(*) FILTER (WHERE sent = TRUE) as delivered,
                    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as failed,
                    AVG(retry_count) as avg_retries
                FROM prediction_alerts 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
                GROUP BY alert_type
                ORDER BY total_scheduled DESC
            `);

            const overall = await db.query(`
                SELECT 
                    COUNT(*) as total_alerts,
                    COUNT(*) FILTER (WHERE sent = TRUE) as delivered_alerts,
                    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as failed_alerts,
                    ROUND(AVG(retry_count), 2) as avg_retries
                FROM prediction_alerts 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            `);

            return {
                overall: overall.rows[0],
                byType: stats.rows,
                timeRange,
                generatedAt: moment().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting alert statistics:', error);
            throw error;
        }
    }

    // HELPER METHODS

    async getPredictionDetails(predictionId) {
        const result = await db.query(`
            SELECT * FROM predictions WHERE id = $1
        `, [predictionId]);

        return result.rows[0] || null;
    }

    formatAlertMessage(template, variables) {
        let message = template;
        for (const [key, value] of Object.entries(variables)) {
            message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return message;
    }

    formatCategory(category) {
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    async getUserBadgeCount(userId) {
        const result = await db.query(`
            SELECT COUNT(*) FROM predictions 
            WHERE user_id = $1 AND verification_status = 'pending'
        `, [userId]);

        return parseInt(result.rows[0].count);
    }

    async trackAlertDelivery(userId, alertType) {
        const cacheKey = `alert_delivery:${userId}:${alertType}`;
        await redisService.incr(cacheKey);
        await redisService.expire(cacheKey, 86400); // 24 hours
    }

    async handleInvalidToken(token) {
        // Remove invalid Firebase token from database
        await db.query(`
            UPDATE user_prediction_preferences 
            SET firebase_token = NULL 
            WHERE firebase_token = $1
        `, [token]);

        console.log(`🧹 Removed invalid Firebase token: ${token}`);
    }
}

module.exports = new PredictionAlertService();