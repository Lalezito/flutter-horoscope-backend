/**
 * 🎯 UNIFIED API RESPONSE FORMATTER MIDDLEWARE
 * Standardizes all API responses across the Zodiac Backend
 * Version: 2.0.0
 */

const logger = require('../services/loggingService');

/**
 * 📋 STANDARD API RESPONSE FORMAT
 * {
 *   success: boolean,
 *   data?: any,
 *   error?: string,
 *   code?: string,
 *   message?: string,
 *   timestamp: string,
 *   version: string,
 *   requestId: string,
 *   meta?: {
 *     pagination?: object,
 *     performance?: object,
 *     cacheInfo?: object
 *   }
 * }
 */

class ResponseFormatter {
  
  /**
   * 🚀 SUCCESS RESPONSE FORMATTER
   */
  static success(data = null, message = null, meta = {}) {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };

    // Add data if provided
    if (data !== null) {
      response.data = data;
    }

    // Add message if provided
    if (message) {
      response.message = message;
    }

    // Add meta information if provided
    if (Object.keys(meta).length > 0) {
      response.meta = meta;
    }

    return response;
  }

  /**
   * ❌ ERROR RESPONSE FORMATTER
   */
  static error(error, code = 'INTERNAL_ERROR', statusCode = 500, meta = {}) {
    const response = {
      success: false,
      error: typeof error === 'string' ? error : error.message,
      code,
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };

    // Add meta information if provided
    if (Object.keys(meta).length > 0) {
      response.meta = meta;
    }

    return { response, statusCode };
  }

  /**
   * 📊 PAGINATED RESPONSE FORMATTER
   */
  static paginated(data, pagination, message = null) {
    return this.success(data, message, {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        total: pagination.total || 0,
        totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 20)),
        hasMore: pagination.hasMore || false
      }
    });
  }

  /**
   * ⚡ PERFORMANCE RESPONSE FORMATTER
   */
  static withPerformance(data, performance, message = null) {
    return this.success(data, message, {
      performance: {
        responseTime: performance.responseTime || 0,
        cacheHit: performance.cacheHit || false,
        source: performance.source || 'database',
        confidence: performance.confidence || null
      }
    });
  }

  /**
   * 💾 CACHED RESPONSE FORMATTER
   */
  static withCache(data, cacheInfo, message = null) {
    return this.success(data, message, {
      cacheInfo: {
        cached: cacheInfo.cached || false,
        ttl: cacheInfo.ttl || null,
        key: cacheInfo.key || null,
        source: cacheInfo.source || 'fresh'
      }
    });
  }
}

/**
 * 🔗 EXPRESS MIDDLEWARE FOR RESPONSE FORMATTING
 */
const responseFormatterMiddleware = (req, res, next) => {
  // Add helper methods to response object
  
  /**
   * Send success response
   */
  res.success = function(data, message, meta) {
    const response = ResponseFormatter.success(data, message, meta);
    response.requestId = `${req.ip}_${Date.now()}`;
    return this.json(response);
  };

  /**
   * Send error response
   */
  res.error = function(error, code = 'INTERNAL_ERROR', statusCode = 500, meta = {}) {
    const { response, statusCode: code_status } = ResponseFormatter.error(error, code, statusCode, meta);
    response.requestId = `${req.ip}_${Date.now()}`;
    return this.status(code_status).json(response);
  };

  /**
   * Send paginated response
   */
  res.paginated = function(data, pagination, message) {
    const response = ResponseFormatter.paginated(data, pagination, message);
    response.requestId = `${req.ip}_${Date.now()}`;
    return this.json(response);
  };

  /**
   * Send performance-tracked response
   */
  res.withPerformance = function(data, performance, message) {
    const response = ResponseFormatter.withPerformance(data, performance, message);
    response.requestId = `${req.ip}_${Date.now()}`;
    return this.json(response);
  };

  /**
   * Send cached response
   */
  res.withCache = function(data, cacheInfo, message) {
    const response = ResponseFormatter.withCache(data, cacheInfo, message);
    response.requestId = `${req.ip}_${Date.now()}`;
    return this.json(response);
  };

  next();
};

/**
 * 🛡️ GLOBAL ERROR HANDLER MIDDLEWARE
 */
const globalErrorHandler = (error, req, res, next) => {
  // Log the error
  logger.logError(error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Determine error type and response
  let statusCode = error.status || error.statusCode || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    code = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    code = 'NOT_FOUND';
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    code = 'RATE_LIMITED';
  }

  // Send formatted error response
  return res.error(message, code, statusCode, {
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

/**
 * 📈 SUCCESS RESPONSE CODES
 */
const SUCCESS_CODES = {
  OK: { code: 'SUCCESS', message: 'Request completed successfully' },
  CREATED: { code: 'CREATED', message: 'Resource created successfully' },
  UPDATED: { code: 'UPDATED', message: 'Resource updated successfully' },
  DELETED: { code: 'DELETED', message: 'Resource deleted successfully' },
  CACHED: { code: 'CACHED', message: 'Response served from cache' },
  GENERATED: { code: 'GENERATED', message: 'Content generated successfully' }
};

/**
 * ❌ ERROR RESPONSE CODES
 */
const ERROR_CODES = {
  VALIDATION_ERROR: { statusCode: 400, message: 'Request validation failed' },
  UNAUTHORIZED: { statusCode: 401, message: 'Authentication required' },
  FORBIDDEN: { statusCode: 403, message: 'Access denied' },
  NOT_FOUND: { statusCode: 404, message: 'Resource not found' },
  CONFLICT: { statusCode: 409, message: 'Resource conflict' },
  RATE_LIMITED: { statusCode: 429, message: 'Rate limit exceeded' },
  INTERNAL_ERROR: { statusCode: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { statusCode: 503, message: 'Service temporarily unavailable' }
};

module.exports = {
  ResponseFormatter,
  responseFormatterMiddleware,
  globalErrorHandler,
  SUCCESS_CODES,
  ERROR_CODES
};