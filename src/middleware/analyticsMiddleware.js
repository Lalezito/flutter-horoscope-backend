/**
 * ================================================================================
 * ANALYTICS MIDDLEWARE - AUTOMATIC EVENT TRACKING
 * ================================================================================
 *
 * Automatically track analytics events for all API requests
 * Captures user behavior, performance metrics, and conversion events
 */

const analyticsEngine = require('../services/analyticsEngine');
const logger = require('../services/loggingService');

/**
 * Track API requests automatically
 */
const trackAPIRequest = async (req, res, next) => {
  const startTime = Date.now();

  // Extract user ID from various possible sources
  const userId = req.user?.uid ||
                 req.body?.userId ||
                 req.query?.userId ||
                 req.headers['x-user-id'] ||
                 'anonymous';

  // Store original end function
  const originalEnd = res.end;

  // Override res.end to capture response
  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Track after response is sent (non-blocking)
    setImmediate(async () => {
      try {
        const responseTime = Date.now() - startTime;
        const path = req.path;

        // Determine event type based on endpoint
        const eventMapping = getEventMapping(req.method, path, res.statusCode);

        if (eventMapping) {
          await analyticsEngine.trackEvent(
            userId,
            eventMapping.eventType,
            eventMapping.category,
            {
              path,
              method: req.method,
              statusCode: res.statusCode,
              responseTime,
              ...extractEventProperties(req, res)
            },
            {
              deviceInfo: {
                userAgent: req.headers['user-agent'],
                platform: req.headers['x-platform'],
                appVersion: req.headers['x-app-version']
              },
              locationData: {
                ip: req.ip,
                country: req.headers['x-country'],
                language: req.headers['accept-language']
              },
              sessionId: req.headers['x-session-id']
            }
          );
        }
      } catch (error) {
        // Don't let analytics errors affect the response
        logger.getLogger().error('Analytics tracking error', {
          error: error.message,
          path: req.path
        });
      }
    });
  };

  next();
};

/**
 * Map endpoints to event types
 */
function getEventMapping(method, path, statusCode) {
  // Only track successful requests (2xx status codes)
  if (statusCode < 200 || statusCode >= 300) {
    return null;
  }

  // Map common endpoints to event types
  const mappings = {
    // App engagement
    'GET /api/horoscope': {
      eventType: 'daily_horoscope_viewed',
      category: 'engagement'
    },
    'GET /api/compatibility': {
      eventType: 'compatibility_checked',
      category: 'engagement'
    },
    'POST /api/cosmic-coach/chat': {
      eventType: 'chat_message_sent',
      category: 'engagement'
    },

    // Premium conversion
    'POST /api/subscriptions/subscribe': {
      eventType: 'premium_purchase',
      category: 'revenue'
    },
    'POST /api/subscriptions/cancel': {
      eventType: 'subscription_cancelled',
      category: 'revenue'
    },

    // User retention
    'POST /api/auth/login': {
      eventType: 'user_login',
      category: 'retention'
    },
    'POST /api/auth/register': {
      eventType: 'user_signup',
      category: 'acquisition'
    },

    // Feature usage
    'POST /api/goals': {
      eventType: 'goal_created',
      category: 'engagement'
    },
    'GET /api/biorhythms': {
      eventType: 'biorhythm_viewed',
      category: 'engagement'
    }
  };

  const key = `${method} ${path}`;

  // Check for exact match
  if (mappings[key]) {
    return mappings[key];
  }

  // Check for pattern matches
  for (const [pattern, mapping] of Object.entries(mappings)) {
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
    if (regex.test(key)) {
      return mapping;
    }
  }

  // Default for uncategorized but successful requests
  if (method === 'GET') {
    return {
      eventType: 'page_viewed',
      category: 'engagement'
    };
  }

  return null;
}

/**
 * Extract relevant properties from request/response
 */
function extractEventProperties(req, res) {
  const properties = {};

  // Extract specific data based on endpoint
  if (req.path.includes('/subscriptions/subscribe')) {
    properties.tier = req.body?.tier || req.query?.tier;
    properties.amount = req.body?.amount || req.body?.price;
    properties.duration = req.body?.duration || 'monthly';
  }

  if (req.path.includes('/cosmic-coach/chat')) {
    properties.messageLength = req.body?.message?.length || 0;
    properties.category = req.body?.category;
  }

  if (req.path.includes('/compatibility')) {
    properties.sign1 = req.query?.sign1;
    properties.sign2 = req.query?.sign2;
  }

  return properties;
}

/**
 * Track custom event (manual tracking)
 * Use this in controllers for specific events
 */
const trackCustomEvent = async (userId, eventType, category, properties = {}) => {
  try {
    await analyticsEngine.trackEvent(userId, eventType, category, properties);
  } catch (error) {
    logger.getLogger().error('Custom event tracking error', {
      error: error.message,
      userId,
      eventType
    });
  }
};

module.exports = {
  trackAPIRequest,
  trackCustomEvent
};
