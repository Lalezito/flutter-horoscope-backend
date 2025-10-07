const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const validator = require('validator');

// 🛡️ COMPREHENSIVE SECURITY MIDDLEWARE
// ====================================
// Production-grade security for the Zodiac backend API
// Protects against common attacks and vulnerabilities

/**
 * Security Headers Middleware
 * Implements comprehensive security headers using Helmet
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * Rate Limiting Configuration
 * Implements tiered rate limiting for different endpoint types
 */
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Rate limit exceeded',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  });
};

// Different rate limits for different endpoints
const rateLimits = {
  // General API endpoints
  api: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // max 100 requests per window
    'Too many API requests. Please try again in 15 minutes.'
  ),
  
  // Authentication endpoints (stricter)
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // max 5 requests per window
    'Too many authentication attempts. Please try again in 15 minutes.'
  ),
  
  // Admin endpoints (very strict)
  admin: createRateLimit(
    5 * 60 * 1000, // 5 minutes
    10, // max 10 requests per window
    'Too many admin requests. Please try again in 5 minutes.'
  ),
  
  // Webhook endpoints (moderate)
  webhook: createRateLimit(
    1 * 60 * 1000, // 1 minute
    30, // max 30 requests per window
    'Too many webhook requests. Please try again in 1 minute.'
  ),
  
  // Health check endpoints (lenient)
  health: createRateLimit(
    1 * 60 * 1000, // 1 minute
    60, // max 60 requests per window
    'Too many health check requests.'
  )
};

/**
 * Request Slowdown Middleware
 * Implements progressive delays for repeated requests
 */
const requestSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 5000, // maximum delay of 5 seconds
  validate: { delayMs: false } // disable deprecation warning
});

/**
 * Endpoint-specific rate limits
 */
const endpointLimits = {
  premium: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs for premium endpoints
    message: 'Too many premium requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  coaching: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit coaching requests
    message: 'Too many coaching requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  })
};

/**
 * Input Validation Middleware
 * Validates and sanitizes all incoming request data
 */
const validateInput = (req, res, next) => {
  try {
    // Validate query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          // Check for basic injection patterns
          if (containsInjectionPatterns(value)) {
            return res.status(400).json({
              error: 'Invalid input detected',
              field: key,
              message: 'Input contains potentially malicious content',
              timestamp: new Date().toISOString()
            });
          }
          
          // Sanitize the value
          req.query[key] = sanitizeInput(value);
        }
      }
    }
    
    // Validate request body
    if (req.body && typeof req.body === 'object') {
      const validatedBody = validateAndSanitizeObject(req.body);
      if (validatedBody.hasErrors) {
        return res.status(400).json({
          error: 'Invalid input detected',
          errors: validatedBody.errors,
          timestamp: new Date().toISOString()
        });
      }
      req.body = validatedBody.data;
    }
    
    next();
  } catch (error) {
    console.error('Input validation error:', error);
    res.status(500).json({
      error: 'Input validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Admin Authentication Middleware
 * Validates admin access for protected endpoints
 */
const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  const expectedAdminKey = process.env.ADMIN_KEY;
  
  if (!expectedAdminKey) {
    console.error('ADMIN_KEY not configured in environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!adminKey || adminKey !== expectedAdminKey) {
    // Log the failed attempt
    console.warn('Unauthorized admin access attempt:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({
      error: 'Admin access required',
      message: 'Valid admin key required for this endpoint',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Request Logging Middleware
 * Logs all requests with security information
 */
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request details
  const requestInfo = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    contentLength: req.get('Content-Length') || 0
  };
  
  console.log('Request:', requestInfo);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log('Response:', {
      ...requestInfo,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

// =================
// HELPER FUNCTIONS
// =================

/**
 * Check if input contains potential injection patterns
 */
function containsInjectionPatterns(input) {
  if (typeof input !== 'string') return false;
  
  const dangerousPatterns = [
    // SQL Injection
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /insert\s+into/i,
    /select\s+.*\s+from/i,
    
    // Command Injection
    /&&\s*rm/i,
    /;\s*rm/i,
    /curl\s+/i,
    /wget\s+/i,
    /bash\s+/i,
    
    // XSS
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /alert\s*\(/i,
    
    // Path Traversal
    /\.\.\//,
    /%2e%2e%2f/i,
    
    // AI Prompt Injection
    /ignore\s+previous/i,
    /forget\s+instructions/i,
    /system\s*:/i,
    /admin\s*:/i
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize input string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove dangerous characters
    .replace(/[<>{}[\]\\|`~^]/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate and sanitize object recursively
 */
function validateAndSanitizeObject(obj) {
  const errors = [];
  const sanitizedObj = {};
  
  try {
    for (const [key, value] of Object.entries(obj)) {
      // Validate key name
      if (!validator.isAlphanumeric(key.replace(/[_-]/g, ''))) {
        errors.push(`Invalid key name: ${key}`);
        continue;
      }
      
      if (typeof value === 'string') {
        // Check for injection patterns
        if (containsInjectionPatterns(value)) {
          errors.push(`Invalid content in field: ${key}`);
          continue;
        }
        
        // Sanitize string
        sanitizedObj[key] = sanitizeInput(value);
        
        // Validate length
        if (sanitizedObj[key].length > 10000) {
          errors.push(`Field '${key}' exceeds maximum length`);
          continue;
        }
      } else if (typeof value === 'number') {
        // Validate number ranges
        if (!isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
          errors.push(`Invalid number in field: ${key}`);
          continue;
        }
        sanitizedObj[key] = value;
      } else if (typeof value === 'boolean') {
        sanitizedObj[key] = value;
      } else if (Array.isArray(value)) {
        // Validate array length
        if (value.length > 100) {
          errors.push(`Array '${key}' exceeds maximum length`);
          continue;
        }
        
        // Recursively validate array items
        const sanitizedArray = [];
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'string') {
            if (containsInjectionPatterns(value[i])) {
              errors.push(`Invalid content in array '${key}' at index ${i}`);
              continue;
            }
            sanitizedArray.push(sanitizeInput(value[i]));
          } else {
            sanitizedArray.push(value[i]);
          }
        }
        sanitizedObj[key] = sanitizedArray;
      } else if (value && typeof value === 'object') {
        // Recursively validate nested objects
        const nestedResult = validateAndSanitizeObject(value);
        if (nestedResult.hasErrors) {
          errors.push(...nestedResult.errors.map(err => `${key}.${err}`));
        } else {
          sanitizedObj[key] = nestedResult.data;
        }
      } else {
        sanitizedObj[key] = value;
      }
    }
  } catch (error) {
    errors.push('Object validation failed');
  }
  
  return {
    data: sanitizedObj,
    errors,
    hasErrors: errors.length > 0
  };
}

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

module.exports = {
  securityHeaders,
  rateLimits,
  endpointLimits,
  requestSlowDown,
  validateInput,
  requireAdmin,
  securityLogger,
  corsOptions
};