const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers configuration
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

// Input validation middleware
const validateInput = (req, res, next) => {
  // Basic input validation
  if (req.body && typeof req.body === 'object') {
    // Sanitize string inputs
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
};

// Premium endpoints rate limiting
const premiumLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000,
  message: 'Premium API limit exceeded',
});

// API endpoints rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests' },
});

// Endpoint-specific rate limiters
const endpointLimits = {
  premium: premiumLimiter,
  api: apiLimiter,
};

module.exports = securityMiddleware;
module.exports.validateInput = validateInput;
module.exports.endpointLimits = endpointLimits;
module.exports.securityMiddleware = securityMiddleware;