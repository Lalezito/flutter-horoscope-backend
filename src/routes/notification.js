const express = require('express');
const router = express.Router();
const db = require('../config/db');
const firebaseService = require('../services/firebaseService');
const logger = require('../services/loggingService');

/**
 * 📱 PUSH NOTIFICATIONS API
 * Handles FCM token registration and notification sending
 */

// Register FCM token
router.post('/register-token', async (req, res) => {
  try {
    const { user_id, fcm_token, device_type, device_id } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    await db.query(
      `INSERT INTO fcm_tokens (user_id, fcm_token, device_type, device_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (device_id)
       DO UPDATE SET fcm_token = $2, updated_at = NOW()`,
      [user_id || null, fcm_token, device_type || 'unknown', device_id || fcm_token]
    );

    logger.getLogger().info(`FCM token registered: ${fcm_token.substring(0, 20)}...`);

    res.json({
      success: true,
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'register-token' });
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Send test notification
router.post('/send-test', async (req, res) => {
  try {
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    const notification = {
      title: '🌟 Zodiac Life Coach',
      body: 'Tu horóscopo diario está listo!'
    };

    const data = {
      type: 'daily_horoscope',
      timestamp: new Date().toISOString()
    };

    const result = await firebaseService.sendNotification(fcm_token, notification, data);

    res.json({
      success: result.success,
      message: result.success ? 'Test notification sent' : 'Failed to send notification',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'send-test' });
    res.status(500).json({ error: error.message });
  }
});

// Get user tokens
router.get('/tokens/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      'SELECT * FROM fcm_tokens WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    res.json({
      success: true,
      tokens: result.rows
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'get-tokens' });
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

// Delete token (logout/unregister)
router.delete('/token/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const result = await db.query(
      'DELETE FROM fcm_tokens WHERE device_id = $1 RETURNING *',
      [deviceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    logger.getLogger().info(`FCM token deleted: ${deviceId}`);

    res.json({
      success: true,
      message: 'Token deleted successfully'
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'delete-token' });
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

// Send notification to all users of a zodiac sign
router.post('/send-by-sign', async (req, res) => {
  try {
    const { sign, notification, data } = req.body;

    if (!sign || !notification) {
      return res.status(400).json({ error: 'Sign and notification required' });
    }

    // Get all tokens for users with this zodiac sign
    // Note: This assumes you have a users table with zodiac_sign field
    const result = await db.query(
      `SELECT DISTINCT fcm_token
       FROM fcm_tokens
       WHERE user_id IN (
         SELECT id FROM users WHERE zodiac_sign = $1
       )`,
      [sign]
    );

    const tokens = result.rows.map(row => row.fcm_token);

    if (tokens.length === 0) {
      return res.json({
        success: true,
        message: 'No tokens found for this sign',
        sent: 0
      });
    }

    // Send multicast notification
    const sendResult = await firebaseService.sendMulticastNotification(
      tokens,
      notification,
      data || {}
    );

    res.json({
      success: true,
      totalTokens: tokens.length,
      successCount: sendResult.successCount,
      failureCount: sendResult.failureCount
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'send-by-sign' });
    res.status(500).json({ error: error.message });
  }
});

// Send notification to topic
router.post('/send-to-topic', async (req, res) => {
  try {
    const { topic, notification, data } = req.body;

    if (!topic || !notification) {
      return res.status(400).json({ error: 'Topic and notification required' });
    }

    const result = await firebaseService.sendTopicNotification(
      topic,
      notification,
      data || {}
    );

    res.json({
      success: result.success,
      message: result.success ? 'Topic notification sent' : 'Failed to send notification',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'send-to-topic' });
    res.status(500).json({ error: error.message });
  }
});

// Get notification statistics
router.get('/stats', async (req, res) => {
  try {
    const totalTokens = await db.query('SELECT COUNT(*) FROM fcm_tokens');
    const activeTokens = await db.query(
      'SELECT COUNT(*) FROM fcm_tokens WHERE updated_at > NOW() - INTERVAL \'30 days\''
    );
    const tokensByType = await db.query(
      'SELECT device_type, COUNT(*) as count FROM fcm_tokens GROUP BY device_type'
    );

    res.json({
      success: true,
      stats: {
        totalTokens: parseInt(totalTokens.rows[0].count),
        activeTokens: parseInt(activeTokens.rows[0].count),
        byDeviceType: tokensByType.rows
      }
    });
  } catch (error) {
    logger.logError(error, { endpoint: 'notification-stats' });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
