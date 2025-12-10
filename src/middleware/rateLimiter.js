const rateLimit = require('express-rate-limit');

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 900
  },
});

// Premium endpoints limiting
const premiumLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // higher limit for premium users
  message: 'Premium API limit exceeded',
});

// Admin endpoints limiting
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit admin requests
  message: {
    error: 'Too many admin requests, please try again later.',
    retryAfter: 900
  },
});

// Webhook endpoints limiting
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit webhook requests
  message: {
    error: 'Too many webhook requests',
    retryAfter: 60
  },
});

// Endpoint-specific rate limiters
const endpointLimits = {
  api: apiLimiter,
  auth: authLimiter,
  premium: premiumLimiter,
  admin: adminLimiter,
  webhook: webhookLimiter,
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

// Request validation middleware
const requestValidation = (req, res, next) => {
  // Basic request validation
  const contentType = req.headers['content-type'];
  if (req.method === 'POST' && contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }
  next();
};

// Adaptive rate limiting (placeholder for more sophisticated implementation)
const adaptiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  premiumLimiter,
  adminLimiter,
  webhookLimiter,
  endpointLimits,
  securityHeaders,
  requestValidation,
  adaptiveRateLimit,
  rateLimit,
};