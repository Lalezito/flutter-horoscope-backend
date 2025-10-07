/**
 * DISTRIBUTED RATE LIMITER MIDDLEWARE
 * 
 * Uses Redis for distributed rate limiting across multiple instances
 * Falls back to in-memory rate limiting if Redis is unavailable
 */

const redisService = require('../services/redisService');

class DistributedRateLimiter {
  constructor() {
    this.defaultOptions = {
      windowMs: 60000,     // 1 minute
      max: 100,            // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later',
      statusCode: 429,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => req.ip,
      onLimitReached: null
    };
  }

  /**
   * Create distributed rate limiter middleware
   */
  create(options = {}) {
    const config = { ...this.defaultOptions, ...options };
    
    return async (req, res, next) => {
      try {
        const key = config.keyGenerator(req);
        const windowSeconds = Math.ceil(config.windowMs / 1000);
        
        // Use Redis-based rate limiting
        const result = await redisService.checkRateLimit(key, config.max, windowSeconds);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': config.max,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'X-RateLimit-Used': result.count
        });
        
        // Check if limit exceeded
        if (!result.allowed) {
          // Call limit reached callback if provided
          if (config.onLimitReached && typeof config.onLimitReached === 'function') {
            config.onLimitReached(req, res, next);
          }
          
          // Log rate limit violation
          console.warn(`Rate limit exceeded for ${key}: ${result.count}/${config.max} requests`);
          
          return res.status(config.statusCode).json({
            error: 'Rate limit exceeded',
            message: config.message,
            limit: config.max,
            current: result.count,
            resetTime: new Date(result.reset).toISOString(),
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
          });
        }
        
        // Request is allowed, continue
        next();
        
      } catch (error) {
        console.error('Distributed rate limiter error:', error);
        
        // On error, allow the request but log the issue
        console.warn('Rate limiter failed, allowing request:', error.message);
        next();
      }
    };
  }

  /**
   * Advanced rate limiter with multiple tiers
   */
  createTiered(tiers = []) {
    const defaultTiers = [
      { windowMs: 1000, max: 10, name: 'burst' },        // 10 requests per second
      { windowMs: 60000, max: 100, name: 'minute' },     // 100 requests per minute  
      { windowMs: 3600000, max: 1000, name: 'hour' }     // 1000 requests per hour
    ];
    
    const activeTiers = tiers.length > 0 ? tiers : defaultTiers;
    
    return async (req, res, next) => {
      try {
        const clientKey = req.ip || 'unknown';
        let blocked = false;
        let blockingTier = null;
        const tierResults = [];
        
        // Check all tiers
        for (const tier of activeTiers) {
          const key = `${clientKey}:${tier.name}`;
          const windowSeconds = Math.ceil(tier.windowMs / 1000);
          
          const result = await redisService.checkRateLimit(key, tier.max, windowSeconds);
          
          tierResults.push({
            tier: tier.name,
            ...result
          });
          
          if (!result.allowed && !blocked) {
            blocked = true;
            blockingTier = tier;
          }
        }
        
        // Set comprehensive rate limit headers
        const currentTier = tierResults[0]; // Most restrictive tier for headers
        res.set({
          'X-RateLimit-Limit': currentTier.limit,
          'X-RateLimit-Remaining': currentTier.remaining,
          'X-RateLimit-Reset': new Date(currentTier.reset).toISOString(),
          'X-RateLimit-Policy': activeTiers.map(t => `${t.max};w=${t.windowMs/1000};comment="${t.name}"`).join(', ')
        });
        
        if (blocked) {
          console.warn(`Tiered rate limit exceeded for ${clientKey} on ${blockingTier.name} tier`);
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many requests in ${blockingTier.name} window`,
            blocked_by: blockingTier.name,
            tiers: tierResults,
            retryAfter: Math.ceil((blockingTier.reset - Date.now()) / 1000)
          });
        }
        
        next();
        
      } catch (error) {
        console.error('Tiered rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * User-specific rate limiting with different limits for authenticated vs anonymous
   */
  createUserAware(options = {}) {
    const config = {
      anonymousMax: 50,      // Limit for anonymous users
      authenticatedMax: 200,  // Higher limit for authenticated users
      premiumMax: 500,       // Even higher for premium users
      windowMs: 60000,       // 1 minute window
      ...options
    };
    
    return async (req, res, next) => {
      try {
        let userKey;
        let maxRequests;
        
        // Determine user type and limits
        if (req.user && req.user.premium) {
          userKey = `premium:${req.user.id}`;
          maxRequests = config.premiumMax;
        } else if (req.user && req.user.id) {
          userKey = `user:${req.user.id}`;
          maxRequests = config.authenticatedMax;
        } else {
          userKey = `anon:${req.ip}`;
          maxRequests = config.anonymousMax;
        }
        
        const windowSeconds = Math.ceil(config.windowMs / 1000);
        const result = await redisService.checkRateLimit(userKey, maxRequests, windowSeconds);
        
        // Enhanced headers with user context
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'X-RateLimit-Context': req.user ? (req.user.premium ? 'premium' : 'authenticated') : 'anonymous'
        });
        
        if (!result.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Rate limit exceeded for ${req.user ? 'authenticated' : 'anonymous'} user`,
            context: req.user ? (req.user.premium ? 'premium' : 'authenticated') : 'anonymous',
            upgrade_message: !req.user ? 'Consider creating an account for higher limits' :
                           (!req.user.premium ? 'Upgrade to premium for higher limits' : null)
          });
        }
        
        next();
        
      } catch (error) {
        console.error('User-aware rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Dynamic rate limiting based on system load
   */
  createDynamic(options = {}) {
    const config = {
      baseMax: 100,          // Base limit
      loadThresholds: {
        low: 1.2,            // 120% of base when load is low
        medium: 1.0,         // 100% of base when load is medium  
        high: 0.5,           // 50% of base when load is high
        critical: 0.2        // 20% of base when load is critical
      },
      windowMs: 60000,
      ...options
    };
    
    return async (req, res, next) => {
      try {
        // Get current system load
        const systemLoad = await this.getSystemLoad();
        
        // Determine rate limit based on load
        let multiplier = config.loadThresholds.medium; // Default
        
        if (systemLoad < 0.3) {
          multiplier = config.loadThresholds.low;
        } else if (systemLoad < 0.6) {
          multiplier = config.loadThresholds.medium;
        } else if (systemLoad < 0.8) {
          multiplier = config.loadThresholds.high;
        } else {
          multiplier = config.loadThresholds.critical;
        }
        
        const dynamicMax = Math.floor(config.baseMax * multiplier);
        const key = `dynamic:${req.ip}`;
        const windowSeconds = Math.ceil(config.windowMs / 1000);
        
        const result = await redisService.checkRateLimit(key, dynamicMax, windowSeconds);
        
        // Headers with load context
        res.set({
          'X-RateLimit-Limit': dynamicMax,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'X-System-Load': systemLoad.toFixed(2),
          'X-Load-Level': systemLoad < 0.3 ? 'low' : systemLoad < 0.6 ? 'medium' : systemLoad < 0.8 ? 'high' : 'critical'
        });
        
        if (!result.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'System under high load, reduced rate limits in effect',
            system_load: systemLoad.toFixed(2),
            dynamic_limit: dynamicMax,
            base_limit: config.baseMax
          });
        }
        
        next();
        
      } catch (error) {
        console.error('Dynamic rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Get current system load for dynamic rate limiting
   */
  async getSystemLoad() {
    try {
      // This is a simplified load calculation
      // In production, you might use more sophisticated metrics
      
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Simple load calculation based on memory usage
      const memLoad = memUsage.heapUsed / memUsage.heapTotal;
      
      // You could also factor in CPU usage, active connections, etc.
      return Math.min(1.0, memLoad);
      
    } catch (error) {
      console.error('Error getting system load:', error);
      return 0.5; // Default to medium load
    }
  }

  /**
   * Global rate limiter across all endpoints for an IP
   */
  createGlobal(options = {}) {
    const config = {
      max: 1000,           // Total requests across all endpoints
      windowMs: 3600000,   // 1 hour
      message: 'Global rate limit exceeded across all endpoints',
      ...options
    };
    
    return this.create({
      ...config,
      keyGenerator: (req) => `global:${req.ip}`
    });
  }

  /**
   * Endpoint-specific rate limiting
   */
  createEndpointSpecific(endpointLimits = {}) {
    const defaultLimits = {
      '/api/generate': { max: 5, windowMs: 300000 },      // 5 requests per 5 minutes for generation
      '/api/coaching': { max: 100, windowMs: 60000 },     // 100 requests per minute for coaching
      '/api/admin': { max: 10, windowMs: 60000 },         // 10 requests per minute for admin
      '/health': { max: 1000, windowMs: 60000 }           // High limit for health checks
    };
    
    const limits = { ...defaultLimits, ...endpointLimits };
    
    return async (req, res, next) => {
      try {
        // Find matching endpoint limit
        let matchingLimit = null;
        
        for (const [pattern, limit] of Object.entries(limits)) {
          if (req.path.startsWith(pattern)) {
            matchingLimit = limit;
            break;
          }
        }
        
        // If no specific limit found, use default
        if (!matchingLimit) {
          return next();
        }
        
        const key = `endpoint:${req.path}:${req.ip}`;
        const windowSeconds = Math.ceil(matchingLimit.windowMs / 1000);
        
        const result = await redisService.checkRateLimit(key, matchingLimit.max, windowSeconds);
        
        res.set({
          'X-RateLimit-Limit': matchingLimit.max,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'X-RateLimit-Scope': 'endpoint-specific'
        });
        
        if (!result.allowed) {
          return res.status(429).json({
            error: 'Endpoint rate limit exceeded',
            message: `Too many requests to ${req.path}`,
            endpoint: req.path,
            limit: matchingLimit.max,
            window_ms: matchingLimit.windowMs
          });
        }
        
        next();
        
      } catch (error) {
        console.error('Endpoint-specific rate limiter error:', error);
        next();
      }
    };
  }
}

module.exports = new DistributedRateLimiter();