/**
 * ========================================================
 * SMART NOTIFICATIONS API ROUTES
 * ========================================================
 *
 * RESTful API for intelligent notification system
 *
 * Endpoints:
 * - POST /send - Send smart notification
 * - GET /user/:userId - Get user notification history
 * - GET /preferences/:userId - Get user preferences
 * - PUT /preferences/:userId - Update preferences
 * - POST /track-event - Track notification engagement
 * - GET /analytics - Get notification analytics
 * - POST /test - Test notification
 *
 * Created: 2025-01-23
 * ========================================================
 */

const express = require('express');
const router = express.Router();
const smartNotificationEngine = require('../services/smartNotificationEngine');
const userBehaviorAnalyzer = require('../services/userBehaviorAnalyzer');
const logger = require('../services/loggingService');
const db = require('../config/db');

/**
 * ========================================================
 * SEND SMART NOTIFICATION
 * ========================================================
 * POST /api/notifications/send
 *
 * Body: {
 *   userId: string,
 *   notificationType: string,
 *   context: object,
 *   options: { sendImmediately?: boolean }
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const { userId, notificationType, context = {}, options = {} } = req.body;

    // Validation
    if (!userId || !notificationType) {
      return res.status(400).json({
        success: false,
        error: 'userId and notificationType are required'
      });
    }

    // Send notification
    const result = await smartNotificationEngine.sendSmartNotification(
      userId,
      notificationType,
      context,
      options
    );

    if (result.success) {
      res.json({
        success: true,
        notificationId: result.notificationId,
        scheduledFor: result.scheduledFor,
        optimalTime: result.optimalTime,
        message: 'Smart notification sent successfully'
      });
    } else {
      res.status(result.blocked ? 429 : 500).json({
        success: false,
        error: result.error || 'Failed to send notification',
        reason: result.reason || 'unknown',
        blocked: result.blocked || false
      });
    }

  } catch (error) {
    logger.logError(error, {
      endpoint: 'POST /api/notifications/send',
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * ========================================================
 * GET USER NOTIFICATION HISTORY
 * ========================================================
 * GET /api/notifications/user/:userId
 *
 * Query params:
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 * - type: string (optional filter)
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, type } = req.query;

    let query = `
      SELECT *
      FROM smart_notifications
      WHERE user_id = $1
    `;

    const params = [userId];

    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }

    query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM smart_notifications WHERE user_id = $1';
    const countParams = [userId];

    if (type) {
      countQuery += ' AND type = $2';
      countParams.push(type);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      notifications: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + result.rows.length < total
      }
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'GET /api/notifications/user/:userId',
      userId: req.params.userId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications'
    });
  }
});

/**
 * ========================================================
 * GET USER NOTIFICATION PREFERENCES
 * ========================================================
 * GET /api/notifications/preferences/:userId
 */
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      'SELECT * FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return res.json({
        success: true,
        preferences: {
          userId,
          enabled: true,
          timezone: 'America/New_York',
          language: 'en',
          max_per_day: 3,
          min_hours_between: 4,
          quiet_hours_start: 23,
          quiet_hours_end: 7,
          daily_horoscope_enabled: true,
          streak_protection_enabled: true,
          prediction_alerts_enabled: true,
          ai_personalization_enabled: true,
          optimal_timing_enabled: true
        },
        isDefault: true
      });
    }

    res.json({
      success: true,
      preferences: result.rows[0],
      isDefault: false
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'GET /api/notifications/preferences/:userId',
      userId: req.params.userId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve preferences'
    });
  }
});

/**
 * ========================================================
 * UPDATE USER NOTIFICATION PREFERENCES
 * ========================================================
 * PUT /api/notifications/preferences/:userId
 */
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    // Build update query dynamically
    const allowedFields = [
      'enabled',
      'timezone',
      'language',
      'max_per_day',
      'min_hours_between',
      'quiet_hours_start',
      'quiet_hours_end',
      'custom_quiet_hours',
      'disabled_types',
      'daily_horoscope_enabled',
      'daily_horoscope_time',
      'streak_protection_enabled',
      'streak_protection_time',
      'prediction_alerts_enabled',
      'compatibility_updates_enabled',
      'moon_phase_enabled',
      're_engagement_enabled',
      'premium_offers_enabled',
      'ai_personalization_enabled',
      'optimal_timing_enabled'
    ];

    const updates = [];
    const values = [userId];
    let paramCount = 2;

    for (const [key, value] of Object.entries(preferences)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    const query = `
      INSERT INTO user_notification_preferences (user_id, ${updates.map((_, i) => allowedFields[i]).join(', ')})
      VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
      ON CONFLICT (user_id) DO UPDATE SET
        ${updates.join(', ')},
        updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(query, values);

    logger.getLogger().info('Notification preferences updated', {
      userId,
      updatedFields: Object.keys(preferences)
    });

    res.json({
      success: true,
      preferences: result.rows[0],
      message: 'Preferences updated successfully'
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'PUT /api/notifications/preferences/:userId',
      userId: req.params.userId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * ========================================================
 * TRACK NOTIFICATION EVENT
 * ========================================================
 * POST /api/notifications/track-event
 *
 * Body: {
 *   notificationId: number,
 *   eventType: 'delivered' | 'opened' | 'clicked' | 'dismissed',
 *   metadata: object
 * }
 */
router.post('/track-event', async (req, res) => {
  try {
    const { notificationId, eventType, metadata = {} } = req.body;

    if (!notificationId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'notificationId and eventType are required'
      });
    }

    const validEvents = ['delivered', 'opened', 'clicked', 'dismissed'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid eventType. Must be one of: ${validEvents.join(', ')}`
      });
    }

    // Update notification engagement
    await db.query(
      'SELECT update_notification_engagement($1, $2, NOW())',
      [notificationId, eventType]
    );

    // Log analytics event
    const notif = await db.query(
      'SELECT user_id, type FROM smart_notifications WHERE id = $1',
      [notificationId]
    );

    if (notif.rows.length > 0) {
      await db.query(
        `INSERT INTO notification_analytics (user_id, notification_id, notification_type, event, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          notif.rows[0].user_id,
          notificationId,
          notif.rows[0].type,
          eventType,
          JSON.stringify(metadata)
        ]
      );
    }

    logger.getLogger().info('Notification event tracked', {
      notificationId,
      eventType
    });

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'POST /api/notifications/track-event',
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
});

/**
 * ========================================================
 * GET NOTIFICATION ANALYTICS
 * ========================================================
 * GET /api/notifications/analytics
 *
 * Query params:
 * - days: number (default: 7)
 * - type: string (optional)
 */
router.get('/analytics', async (req, res) => {
  try {
    const { days = 7, type } = req.query;

    // Overall performance
    let perfQuery = `
      SELECT
        COUNT(*) as total_sent,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
        ROUND(
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100, 2
        ) as open_rate,
        ROUND(
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100, 2
        ) as click_rate,
        ROUND(AVG(time_to_open_seconds), 0) as avg_time_to_open
      FROM smart_notifications
      WHERE sent_at > NOW() - INTERVAL '${parseInt(days)} days'
    `;

    if (type) {
      perfQuery += ` AND type = '${type}'`;
    }

    const perfResult = await db.query(perfQuery);

    // Performance by type
    const byTypeResult = await db.query(`
      SELECT
        type,
        COUNT(*) as sent,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        ROUND(
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100, 2
        ) as open_rate
      FROM smart_notifications
      WHERE sent_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY type
      ORDER BY sent DESC
    `);

    // Daily trend
    const trendResult = await db.query(`
      SELECT
        DATE(sent_at) as date,
        COUNT(*) as sent,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened
      FROM smart_notifications
      WHERE sent_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      analytics: {
        overall: perfResult.rows[0],
        byType: byTypeResult.rows,
        dailyTrend: trendResult.rows,
        period: {
          days: parseInt(days),
          from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'GET /api/notifications/analytics'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics'
    });
  }
});

/**
 * ========================================================
 * GET USER BEHAVIOR PROFILE
 * ========================================================
 * GET /api/notifications/behavior/:userId
 */
router.get('/behavior/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await userBehaviorAnalyzer.getUserBehaviorProfile(userId);

    res.json({
      success: true,
      profile
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'GET /api/notifications/behavior/:userId',
      userId: req.params.userId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve behavior profile'
    });
  }
});

/**
 * ========================================================
 * SEND TEST NOTIFICATION
 * ========================================================
 * POST /api/notifications/test
 *
 * Body: {
 *   userId: string,
 *   notificationType: string
 * }
 */
router.post('/test', async (req, res) => {
  try {
    const { userId, notificationType = 'PERSONALIZED_INSIGHT' } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Send test notification immediately
    const result = await smartNotificationEngine.sendSmartNotification(
      userId,
      notificationType,
      {
        insight: 'most creative in the evenings',
        category: 'test'
      },
      { sendImmediately: true }
    );

    res.json({
      success: result.success,
      ...result,
      message: result.success
        ? 'Test notification sent successfully'
        : 'Failed to send test notification'
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'POST /api/notifications/test',
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

/**
 * ========================================================
 * LOG USER ACTIVITY
 * ========================================================
 * POST /api/notifications/log-activity
 *
 * Body: {
 *   userId: string,
 *   activityType: string,
 *   metadata: object
 * }
 */
router.post('/log-activity', async (req, res) => {
  try {
    const {
      userId,
      activityType,
      screenName,
      actionName,
      sessionId,
      metadata = {},
      deviceType,
      appVersion,
      platform
    } = req.body;

    if (!userId || !activityType) {
      return res.status(400).json({
        success: false,
        error: 'userId and activityType are required'
      });
    }

    await db.query(
      `INSERT INTO user_activity_logs (
        user_id, activity_type, screen_name, action_name, session_id,
        metadata, device_type, app_version, platform
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        activityType,
        screenName,
        actionName,
        sessionId,
        JSON.stringify(metadata),
        deviceType,
        appVersion,
        platform
      ]
    );

    res.json({
      success: true,
      message: 'Activity logged successfully'
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'POST /api/notifications/log-activity',
      body: req.body
    });

    // Don't fail the request for logging errors
    res.json({
      success: true,
      warning: 'Activity logging failed but request processed'
    });
  }
});

/**
 * ========================================================
 * GET SERVICE STATUS
 * ========================================================
 * GET /api/notifications/status
 */
router.get('/status', async (req, res) => {
  try {
    const engineStatus = smartNotificationEngine.getStatus();
    const analyzerStatus = userBehaviorAnalyzer.getStatus();

    res.json({
      success: true,
      services: {
        notificationEngine: engineStatus,
        behaviorAnalyzer: analyzerStatus
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: 'GET /api/notifications/status' });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve status'
    });
  }
});

module.exports = router;
