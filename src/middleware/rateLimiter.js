/**
 * Simple in-memory rate limiter middleware
 * For production, consider using Redis for distributed rate limiting
 */

const rateLimitMap = new Map();
const ipFailureMap = new Map(); // Track failed attempts per IP

/**
 * Rate limiting middleware
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} maxRequests - Maximum requests per window
 * @param {object} options - Additional options
 */
function rateLimit(windowMs = 60000, maxRequests = 100, options = {}) {
  const {
    message = 'Too many requests from this IP, please try again later',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Get or create rate limit data for this IP
    if (!rateLimitMap.has(clientIP)) {
      rateLimitMap.set(clientIP, {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now
      });
    }
    
    const clientData = rateLimitMap.get(clientIP);
    
    // Reset window if expired
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
      clientData.firstRequest = now;
    }
    
    // Check if limit exceeded
    if (clientData.count >= maxRequests) {
      // Log rate limit violation
      console.warn(`Rate limit exceeded for IP ${clientIP}: ${clientData.count} requests`);
      
      // Add to failure tracking
      const failures = ipFailureMap.get(clientIP) || 0;
      ipFailureMap.set(clientIP, failures + 1);
      
      return res.status(statusCode).json({
        error: 'Rate limit exceeded',
        message: message,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        limit: maxRequests,
        windowMs: windowMs,
        current: clientData.count
      });
    }
    
    // Increment counter (conditionally based on options)
    let shouldCount = true;
    if (skipSuccessfulRequests || skipFailedRequests) {
      // For these options, we need to count after the response
      const originalSend = res.send;
      res.send = function(data) {
        const isError = res.statusCode >= 400;
        const shouldSkip = (skipSuccessfulRequests && !isError) || 
                          (skipFailedRequests && isError);
        
        if (!shouldSkip) {
          clientData.count++;
        }
        
        originalSend.call(this, data);
      };
    } else {
      clientData.count++;
    }
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.count),
      'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
    });
    
    next();
  };
}

/**
 * Adaptive rate limiter that increases restrictions for suspicious IPs
 */
function adaptiveRateLimit(baseLimit = 100, suspiciousThreshold = 5) {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const failures = ipFailureMap.get(clientIP) || 0;
    
    // Reduce limit for suspicious IPs
    let adjustedLimit = baseLimit;
    if (failures > suspiciousThreshold) {
      adjustedLimit = Math.max(10, baseLimit - (failures * 10));
      console.warn(`Suspicious IP ${clientIP} detected, reduced limit to ${adjustedLimit}`);
    }
    
    // Apply rate limiting with adjusted limit
    return rateLimit(60000, adjustedLimit, {
      message: failures > suspiciousThreshold ? 
        'IP flagged as suspicious due to repeated violations' :
        'Too many requests, please slow down'
    })(req, res, next);
  };
}

/**
 * Endpoint-specific rate limiting
 */
const endpointLimits = {
  // Strict limits for admin endpoints
  admin: rateLimit(60000, 10, {
    message: 'Admin endpoint rate limit exceeded'
  }),
  
  // Moderate limits for API endpoints
  api: rateLimit(60000, 200, {
    message: 'API rate limit exceeded',
    skipSuccessfulRequests: false
  }),
  
  // Relaxed limits for health checks
  health: rateLimit(60000, 500, {
    message: 'Health check rate limit exceeded'
  }),
  
  // Very strict limits for webhook endpoints
  webhook: rateLimit(300000, 20, { // 5 minute window, 20 requests max
    message: 'Webhook rate limit exceeded'
  })
};

/**
 * Clean up old rate limit data periodically
 */
function cleanupRateLimitData() {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Clean up rate limit map
  for (const [ip, data] of rateLimitMap.entries()) {
    if (data.resetTime < now && data.firstRequest < oneHourAgo) {
      rateLimitMap.delete(ip);
    }
  }
  
  // Clean up failure tracking (keep only last 24 hours)
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  for (const [ip, lastFailure] of ipFailureMap.entries()) {
    if (lastFailure < oneDayAgo) {
      ipFailureMap.delete(ip);
    }
  }
  
  console.log(`Rate limit cleanup: ${rateLimitMap.size} active IPs, ${ipFailureMap.size} flagged IPs`);
}

// Run cleanup every hour
setInterval(cleanupRateLimitData, 60 * 60 * 1000);

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  // Basic security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
}

/**
 * Basic request validation middleware
 */
function requestValidation(req, res, next) {
  // Check for overly long URLs
  if (req.url.length > 1000) {
    return res.status(414).json({ error: 'URL too long' });
  }
  
  // Check for suspicious patterns in URL
  const suspiciousPatterns = [
    /\.\./,           // Path traversal
    /<script/i,       // XSS attempt
    /union.*select/i, // SQL injection
    /exec\(/i,        // Code execution
    /eval\(/i         // Code evaluation
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(req.url) || pattern.test(JSON.stringify(req.body))) {
      console.warn(`Suspicious request blocked from ${req.ip}: ${req.url}`);
      
      // Track this as a failure
      const failures = ipFailureMap.get(req.ip) || 0;
      ipFailureMap.set(req.ip, failures + 1);
      
      return res.status(400).json({ error: 'Malicious request detected' });
    }
  }
  
  next();
}

/**
 * IP whitelist/blacklist middleware
 */
function ipFilter(options = {}) {
  const { whitelist = [], blacklist = [] } = options;
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check blacklist first
    if (blacklist.includes(clientIP)) {
      console.warn(`Blacklisted IP blocked: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check whitelist (if defined)
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      console.warn(`Non-whitelisted IP blocked: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
}

module.exports = {
  rateLimit,
  adaptiveRateLimit,
  endpointLimits,
  securityHeaders,
  requestValidation,
  ipFilter,
  cleanupRateLimitData,
  
  // Utility functions for monitoring
  getRateLimitStats: () => ({
    activeIPs: rateLimitMap.size,
    flaggedIPs: ipFailureMap.size,
    topOffenders: Array.from(ipFailureMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  })
};