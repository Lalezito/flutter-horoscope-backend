const winston = require('winston');

/**
 * 📊 COMPREHENSIVE LOGGING SERVICE - PRODUCTION READY
 * Winston-based logging with multiple transports and structured logging
 */

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'zodiac-backend',
    version: '2.0.0'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    }),
    
    // File transports for production
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Ensure logs directory exists
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Enhanced logging methods with context
 */
class LoggingService {
  /**
   * Log API request
   */
  static logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      logger.warn('API Request Failed', logData);
    } else {
      logger.info('API Request', logData);
    }
  }

  /**
   * Log API error
   */
  static logError(error, context = {}) {
    logger.error('API Error', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log database operations
   */
  static logDatabase(operation, details = {}) {
    logger.info('Database Operation', {
      operation,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log external API calls
   */
  static logExternalAPI(service, operation, details = {}) {
    logger.info('External API Call', {
      service,
      operation,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log cron job execution
   */
  static logCronJob(jobName, status, details = {}) {
    logger.info('Cron Job Execution', {
      jobName,
      status,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log authentication events
   */
  static logAuth(event, details = {}) {
    logger.info('Authentication Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log rate limiting events
   */
  static logRateLimit(ip, endpoint, details = {}) {
    logger.warn('Rate Limit Exceeded', {
      ip,
      endpoint,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log security events
   */
  static logSecurity(event, details = {}) {
    logger.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log performance metrics
   */
  static logPerformance(metric, value, context = {}) {
    logger.info('Performance Metric', {
      metric,
      value,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get logger instance for custom logging
   */
  static getLogger() {
    return logger;
  }

  /**
   * Create child logger with additional context
   */
  static createChildLogger(context) {
    return logger.child(context);
  }
}

// Export both the service and direct logger access
module.exports = LoggingService;
module.exports.logger = logger;