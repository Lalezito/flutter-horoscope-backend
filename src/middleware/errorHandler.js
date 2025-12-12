const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 🔧 TEMP DEBUG: Show error in production for debugging
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    errorType: err.name || 'UnknownError',
    errorCode: err.code || 'UNKNOWN',
    path: req.path,
    ...(isDevelopment && { stack: err.stack })
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  logger.warn('404 - Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  logger
};