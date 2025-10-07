/**
 * 🤖 AI COACH API ROUTES
 * 
 * REST API endpoints for AI Coach chat functionality
 * Features:
 * - Start new chat sessions
 * - Send messages and receive AI responses
 * - Get chat history
 * - Premium subscription validation
 * - Rate limiting and authentication
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const aiCoachService = require('../services/aiCoachService');
const receiptValidationService = require('../services/receiptValidationService');
const authenticationService = require('../services/authenticationService');
const logger = require('../services/loggingService');
const rateLimit = require('express-rate-limit');

// Rate limiting configurations for AI Coach endpoints
const aiCoachRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    error: 'Too many AI Coach requests',
    message: 'Please wait before making more requests',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const chatRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 chat messages per minute
  message: {
    error: 'Chat rate limit exceeded',
    message: 'Please slow down your message frequency',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => {
    // Use session ID + IP for more granular rate limiting
    return `${req.body.sessionId || 'anonymous'}-${req.ip}`;
  }
});

// Authentication middleware for AI Coach routes
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'authentication_required',
        message: 'Valid authorization token required'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token (simplified for this implementation)
    // In a real implementation, you'd use your authentication service
    if (!token || token.length < 10) {
      return res.status(401).json({
        success: false,
        error: 'invalid_token',
        message: 'Invalid authentication token'
      });
    }

    // Extract user ID from token or request
    req.userId = req.headers['x-user-id'] || token.substring(0, 8);
    next();

  } catch (error) {
    logger.logError(error, { context: 'ai_coach_authentication', ip: req.ip });
    
    res.status(500).json({
      success: false,
      error: 'authentication_error',
      message: 'Authentication system error'
    });
  }
};

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'Request validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * 🚀 START NEW CHAT SESSION
 * POST /api/ai-coach/chat/start
 */
router.post('/chat/start',
  aiCoachRateLimit,
  authenticateUser,
  [
    body('persona').optional().isIn(['general', 'spiritual', 'career', 'relationship', 'wellness', 'motivational'])
      .withMessage('Invalid persona type'),
    body('languageCode').optional().isLength({ min: 2, max: 5 })
      .withMessage('Invalid language code'),
    body('receiptData').optional().isString()
      .withMessage('Receipt data must be a string'),
    body('preferences').optional().isObject()
      .withMessage('Preferences must be an object'),
    body('platform').optional().isIn(['ios', 'android', 'web'])
      .withMessage('Invalid platform'),
    body('appVersion').optional().isString()
      .withMessage('App version must be a string')
  ],
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { persona, languageCode, receiptData, preferences, platform, appVersion } = req.body;
      
      logger.getLogger().info('AI Coach session start request', {
        userId: req.userId,
        persona: persona || 'general',
        platform,
        ip: req.ip
      });

      const options = {
        persona,
        languageCode,
        receiptData,
        preferences,
        platform,
        appVersion,
        userAgent: req.get('User-Agent'),
      };

      const result = await aiCoachService.startChatSession(req.userId, options);

      const responseTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(result.error === 'premium_required' ? 402 : 400).json({
          ...result,
          responseTime,
          timestamp: new Date().toISOString()
        });
      }

      res.status(201).json({
        ...result,
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_start_session_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to start chat session',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 💬 SEND MESSAGE AND GET AI RESPONSE
 * POST /api/ai-coach/chat/message
 */
router.post('/chat/message',
  chatRateLimit,
  authenticateUser,
  [
    body('sessionId').isUUID().withMessage('Valid session ID required'),
    body('message').isString().isLength({ min: 1, max: 2000 })
      .withMessage('Message must be 1-2000 characters'),
    body('receiptData').optional().isString()
      .withMessage('Receipt data must be a string')
  ],
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { sessionId, message, receiptData } = req.body;
      
      logger.getLogger().info('AI Coach message request', {
        userId: req.userId,
        sessionId,
        messageLength: message.length,
        ip: req.ip
      });

      const options = {
        receiptData,
        userAgent: req.get('User-Agent'),
      };

      const result = await aiCoachService.sendMessage(sessionId, message, req.userId, options);

      const responseTime = Date.now() - startTime;

      if (!result.success) {
        const statusCode = result.error === 'premium_required' ? 402 :
                          result.error === 'limit_exceeded' ? 429 :
                          result.error === 'session_not_found' ? 404 : 400;

        return res.status(statusCode).json({
          ...result,
          responseTime,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        ...result,
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_send_message_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to process message',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 📜 GET CHAT HISTORY
 * GET /api/ai-coach/chat/history/:sessionId
 */
router.get('/chat/history/:sessionId',
  aiCoachRateLimit,
  authenticateUser,
  [
    param('sessionId').isUUID().withMessage('Valid session ID required'),
    query('limit').optional().isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 })
      .withMessage('Offset must be 0 or greater')
  ],
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { sessionId } = req.params;
      const { limit, offset } = req.query;
      
      logger.getLogger().info('AI Coach history request', {
        userId: req.userId,
        sessionId,
        limit,
        offset,
        ip: req.ip
      });

      const options = {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const result = await aiCoachService.getChatHistory(sessionId, req.userId, options);

      const responseTime = Date.now() - startTime;

      if (!result.success) {
        const statusCode = result.error === 'session_not_found' ? 404 : 400;

        return res.status(statusCode).json({
          ...result,
          responseTime,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        ...result,
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_get_history_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to retrieve chat history',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 👤 GET USER SESSIONS
 * GET /api/ai-coach/sessions
 */
router.get('/sessions',
  aiCoachRateLimit,
  authenticateUser,
  [
    query('active').optional().isBoolean()
      .withMessage('Active filter must be boolean'),
    query('limit').optional().isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('offset').optional().isInt({ min: 0 })
      .withMessage('Offset must be 0 or greater')
  ],
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { active, limit = 10, offset = 0 } = req.query;
      
      logger.getLogger().info('AI Coach sessions request', {
        userId: req.userId,
        active,
        limit,
        offset,
        ip: req.ip
      });

      // Query user's chat sessions from database
      const db = require('../config/db');
      
      let query = `
        SELECT 
          session_id,
          ai_coach_persona,
          created_at,
          last_activity,
          total_messages,
          is_active,
          language_code
        FROM chat_sessions 
        WHERE user_id = $1
      `;
      
      const params = [req.userId];
      
      if (active !== undefined) {
        query += ` AND is_active = $${params.length + 1}`;
        params.push(active === 'true');
      }
      
      query += ` ORDER BY last_activity DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      const sessions = result.rows.map(session => ({
        sessionId: session.session_id,
        persona: session.ai_coach_persona,
        personaName: aiCoachService.personas[session.ai_coach_persona]?.name || 'AI Coach',
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        totalMessages: session.total_messages,
        isActive: session.is_active,
        languageCode: session.language_code
      }));

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        sessions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.rows.length === parseInt(limit)
        },
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_get_sessions_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to retrieve sessions',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * ❌ END CHAT SESSION
 * DELETE /api/ai-coach/chat/:sessionId
 */
router.delete('/chat/:sessionId',
  aiCoachRateLimit,
  authenticateUser,
  [
    param('sessionId').isUUID().withMessage('Valid session ID required')
  ],
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { sessionId } = req.params;
      
      logger.getLogger().info('AI Coach end session request', {
        userId: req.userId,
        sessionId,
        ip: req.ip
      });

      // Update session to inactive
      const db = require('../config/db');
      const redisService = require('../services/redisService');
      
      const query = `
        UPDATE chat_sessions 
        SET is_active = false, last_activity = CURRENT_TIMESTAMP
        WHERE session_id = $1 AND user_id = $2 AND is_active = true
        RETURNING session_id
      `;

      const result = await db.query(query, [sessionId, req.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'session_not_found',
          message: 'Active session not found',
          timestamp: new Date().toISOString()
        });
      }

      // Clear session cache
      const cacheKey = `ai_coach_session:${sessionId}`;
      await redisService.del(cacheKey);

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        message: 'Session ended successfully',
        sessionId,
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_end_session_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to end session',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 📊 GET AI COACH SERVICE STATUS
 * GET /api/ai-coach/status
 */
router.get('/status',
  aiCoachRateLimit,
  async (req, res) => {
    try {
      const status = aiCoachService.getStatus();
      const healthCheck = await aiCoachService.healthCheck();

      res.json({
        success: true,
        service: {
          ...status,
          health: healthCheck
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { context: 'ai_coach_status_route', ip: req.ip });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to get service status',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 🔍 VALIDATE PREMIUM ACCESS
 * POST /api/ai-coach/validate-premium
 */
router.post('/validate-premium',
  aiCoachRateLimit,
  authenticateUser,
  [
    body('receiptData').isString().withMessage('Receipt data is required')
  ],
  validateRequest,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { receiptData } = req.body;
      
      logger.getLogger().info('AI Coach premium validation request', {
        userId: req.userId,
        ip: req.ip
      });

      const subscriptionStatus = await receiptValidationService.getUserSubscriptionStatus(
        receiptData, 
        req.userId, 
        { userIP: req.ip }
      );

      const isPremium = subscriptionStatus.isPremium;
      const aiStatus = aiCoachService.getStatus();
      const allowedFeatures = isPremium ? aiStatus.limits.premium : aiStatus.limits.free;

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        premium: {
          isPremium,
          hasAccess: true,
          allowedFeatures,
          subscriptionStatus: {
            userId: subscriptionStatus.userId,
            activeSubscriptions: subscriptionStatus.activeSubscriptions,
            expiresDate: subscriptionStatus.expiresDate
          }
        },
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_validate_premium_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to validate premium access',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 📈 GET USAGE STATISTICS
 * GET /api/ai-coach/usage
 */
router.get('/usage',
  aiCoachRateLimit,
  authenticateUser,
  async (req, res) => {
    const startTime = Date.now();

    try {
      logger.getLogger().info('AI Coach usage stats request', {
        userId: req.userId,
        ip: req.ip
      });

      const redisService = require('../services/redisService');
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `ai_coach_usage:${req.userId}:${today}`;
      
      const cachedUsage = await redisService.get(cacheKey);
      const usage = cachedUsage ? JSON.parse(cachedUsage) : { used: 0, date: today };

      // Get total sessions and messages for user
      const db = require('../config/db');
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT cs.session_id) as total_sessions,
          COUNT(DISTINCT CASE WHEN cs.is_active THEN cs.session_id END) as active_sessions,
          COALESCE(SUM(cs.total_messages), 0) as total_messages,
          MAX(cs.last_activity) as last_activity
        FROM chat_sessions cs
        WHERE cs.user_id = $1
      `;

      const statsResult = await db.query(statsQuery, [req.userId]);
      const stats = statsResult.rows[0];

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        usage: {
          today: {
            used: usage.used,
            limit: 100, // Default, would check premium status
            date: usage.date,
            lastUsed: usage.lastUsed
          },
          overall: {
            totalSessions: parseInt(stats.total_sessions),
            activeSessions: parseInt(stats.active_sessions),
            totalMessages: parseInt(stats.total_messages),
            lastActivity: stats.last_activity
          }
        },
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_usage_stats_route', 
        userId: req.userId,
        responseTime,
        ip: req.ip 
      });

      res.status(500).json({
        success: false,
        error: 'internal_server_error',
        message: 'Failed to get usage statistics',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  logger.logError(error, {
    context: 'ai_coach_routes_error',
    url: req.url,
    method: req.method,
    userId: req.userId,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: 'internal_server_error',
    message: 'An unexpected error occurred in AI Coach service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;