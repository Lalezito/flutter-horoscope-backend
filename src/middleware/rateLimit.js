/**
 * 🛡️ RATE LIMITING MIDDLEWARE
 * 
 * Specialized rate limiting for astrological timing requests
 * with different limits for authenticated vs anonymous users.
 */

const rateLimitMap = new Map();
const logger = require('../utils/logger');

class RateLimitMiddleware {
    /**
     * Create timing-specific rate limiter
     */
    static timingRequests(req, res, next) {
        const isAuthenticated = !!req.user;
        const isPremium = req.user?.role === 'premium_user' || 
                         req.user?.role === 'admin' || 
                         req.user?.role === 'super_admin';

        // Different limits based on user type
        let windowMs, maxRequests, identifier;

        if (isPremium) {
            // Premium users: 100 requests per hour
            windowMs = 60 * 60 * 1000; // 1 hour
            maxRequests = 100;
            identifier = `premium_${req.user.id}`;
        } else if (isAuthenticated) {
            // Regular authenticated users: 30 requests per hour
            windowMs = 60 * 60 * 1000; // 1 hour
            maxRequests = 30;
            identifier = `user_${req.user.id}`;
        } else {
            // Anonymous users: 10 requests per hour
            windowMs = 60 * 60 * 1000; // 1 hour
            maxRequests = 10;
            identifier = `ip_${req.ip}`;
        }

        return RateLimitMiddleware.applyRateLimit(
            req, 
            res, 
            next, 
            identifier, 
            windowMs, 
            maxRequests,
            'timing_requests'
        );
    }

    /**
     * Rate limiter for urgent timing requests (stricter limits)
     */
    static urgentTimingRequests(req, res, next) {
        const isAuthenticated = !!req.user;
        const isPremium = req.user?.role === 'premium_user' || 
                         req.user?.role === 'admin' || 
                         req.user?.role === 'super_admin';

        // Stricter limits for urgent requests
        let windowMs, maxRequests, identifier;

        if (isPremium) {
            // Premium users: 20 urgent requests per hour
            windowMs = 60 * 60 * 1000;
            maxRequests = 20;
            identifier = `urgent_premium_${req.user.id}`;
        } else if (isAuthenticated) {
            // Regular users: 5 urgent requests per hour
            windowMs = 60 * 60 * 1000;
            maxRequests = 5;
            identifier = `urgent_user_${req.user.id}`;
        } else {
            // Anonymous users: 2 urgent requests per hour
            windowMs = 60 * 60 * 1000;
            maxRequests = 2;
            identifier = `urgent_ip_${req.ip}`;
        }

        return RateLimitMiddleware.applyRateLimit(
            req, 
            res, 
            next, 
            identifier, 
            windowMs, 
            maxRequests,
            'urgent_timing_requests'
        );
    }

    /**
     * General API rate limiter
     */
    static apiRequests(req, res, next) {
        const isAuthenticated = !!req.user;
        const isPremium = req.user?.role === 'premium_user' || 
                         req.user?.role === 'admin' || 
                         req.user?.role === 'super_admin';

        let windowMs, maxRequests, identifier;

        if (isPremium) {
            // Premium users: 1000 requests per hour
            windowMs = 60 * 60 * 1000;
            maxRequests = 1000;
            identifier = `api_premium_${req.user.id}`;
        } else if (isAuthenticated) {
            // Regular users: 300 requests per hour
            windowMs = 60 * 60 * 1000;
            maxRequests = 300;
            identifier = `api_user_${req.user.id}`;
        } else {
            // Anonymous users: 100 requests per hour
            windowMs = 60 * 60 * 1000;
            maxRequests = 100;
            identifier = `api_ip_${req.ip}`;
        }

        return RateLimitMiddleware.applyRateLimit(
            req, 
            res, 
            next, 
            identifier, 
            windowMs, 
            maxRequests,
            'api_requests'
        );
    }

    /**
     * Core rate limiting logic
     */
    static applyRateLimit(req, res, next, identifier, windowMs, maxRequests, category) {
        const now = Date.now();
        
        // Get or create rate limit data
        if (!rateLimitMap.has(identifier)) {
            rateLimitMap.set(identifier, {
                count: 0,
                resetTime: now + windowMs,
                firstRequest: now,
                category
            });
        }
        
        const clientData = rateLimitMap.get(identifier);
        
        // Reset window if expired
        if (now > clientData.resetTime) {
            clientData.count = 0;
            clientData.resetTime = now + windowMs;
            clientData.firstRequest = now;
        }
        
        // Check if limit exceeded
        if (clientData.count >= maxRequests) {
            const timeRemaining = Math.ceil((clientData.resetTime - now) / 1000);
            
            logger.warn('Rate limit exceeded', {
                identifier,
                category,
                count: clientData.count,
                maxRequests,
                timeRemaining,
                endpoint: req.path,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(429).json({
                success: false,
                message: 'Rate limit exceeded',
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    category,
                    limit: maxRequests,
                    windowMs,
                    current: clientData.count,
                    timeRemaining,
                    retryAfter: timeRemaining
                },
                timestamp: new Date().toISOString()
            });
        }
        
        // Increment counter
        clientData.count++;
        
        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.count),
            'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
            'X-RateLimit-Category': category
        });
        
        // Log request for monitoring
        if (clientData.count % 10 === 0) { // Log every 10th request
            logger.info('Rate limit status', {
                identifier,
                category,
                count: clientData.count,
                maxRequests,
                remaining: maxRequests - clientData.count,
                endpoint: req.path
            });
        }
        
        next();
    }

    /**
     * Get rate limit status for a specific identifier
     */
    static getStatus(identifier) {
        const data = rateLimitMap.get(identifier);
        if (!data) {
            return null;
        }

        const now = Date.now();
        const isExpired = now > data.resetTime;
        
        return {
            identifier,
            category: data.category,
            count: isExpired ? 0 : data.count,
            resetTime: data.resetTime,
            isExpired,
            timeRemaining: Math.max(0, data.resetTime - now)
        };
    }

    /**
     * Clear rate limit data for testing or emergency reset
     */
    static clearLimits(identifier = null) {
        if (identifier) {
            rateLimitMap.delete(identifier);
            logger.info('Rate limit cleared for identifier', { identifier });
        } else {
            rateLimitMap.clear();
            logger.info('All rate limits cleared');
        }
    }

    /**
     * Get current rate limit statistics
     */
    static getStatistics() {
        const now = Date.now();
        const stats = {
            totalTracked: rateLimitMap.size,
            categories: {},
            activeClients: 0,
            expiredClients: 0
        };

        for (const [identifier, data] of rateLimitMap.entries()) {
            const isExpired = now > data.resetTime;
            
            if (isExpired) {
                stats.expiredClients++;
            } else {
                stats.activeClients++;
            }

            if (!stats.categories[data.category]) {
                stats.categories[data.category] = {
                    count: 0,
                    totalRequests: 0,
                    active: 0,
                    expired: 0
                };
            }

            stats.categories[data.category].count++;
            stats.categories[data.category].totalRequests += data.count;
            
            if (isExpired) {
                stats.categories[data.category].expired++;
            } else {
                stats.categories[data.category].active++;
            }
        }

        return stats;
    }

    /**
     * Cleanup expired entries (should be run periodically)
     */
    static cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [identifier, data] of rateLimitMap.entries()) {
            if (now > data.resetTime + 60000) { // 1 minute grace period
                rateLimitMap.delete(identifier);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info('Rate limit cleanup completed', { 
                cleaned,
                remaining: rateLimitMap.size 
            });
        }

        return cleaned;
    }
}

// Periodic cleanup every 5 minutes
setInterval(() => {
    RateLimitMiddleware.cleanup();
}, 5 * 60 * 1000);

module.exports = RateLimitMiddleware;