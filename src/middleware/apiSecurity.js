const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Advanced API Security Manager
 * Implements JWT validation, request signing, and enhanced security measures
 */
class APISecurityManager {
  constructor() {
    this.rateLimitStore = new Map();
    this.invalidTokens = new Set();
    this.suspiciousIPs = new Map();
    this.requestHistory = new Map();
  }

  /**
   * JWT token validation with enhanced security
   */
  validateJWT(token) {
    try {
      if (this.invalidTokens.has(token)) {
        throw new Error('Token is blacklisted');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check token age
      const tokenAge = Date.now() / 1000 - decoded.iat;
      const maxAge = 24 * 60 * 60; // 24 hours
      
      if (tokenAge > maxAge) {
        throw new Error('Token expired');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Request signature validation for high-security endpoints
   */
  validateSignature(request, signature) {
    try {
      const payload = JSON.stringify({
        method: request.method,
        url: request.url,
        body: request.body || {},
        timestamp: request.headers['x-timestamp']
      });

      const expectedSignature = crypto
        .createHmac('sha256', process.env.API_SECRET || 'default-secret')
        .update(payload)
        .digest('hex');
      
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  /**
   * Enhanced input sanitization
   */
  sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .replace(/[<>]/g, '') // Remove potential XSS vectors
        .replace(/['"]/g, '') // Remove quotes to prevent SQL injection
        .replace(/[{}]/g, '') // Remove braces to prevent template injection
        .replace(/[\\]/g, '') // Remove backslashes
        .trim()
        .substring(0, 1000); // Limit input length
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item)).slice(0, 100);
    }
    
    if (input && typeof input === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        if (this.isValidKey(key)) {
          sanitized[key] = this.sanitizeInput(value);
        }
      }
      return sanitized;
    }
    
    return input;
  }

  /**
   * Advanced SQL injection prevention
   */
  sanitizeQuery(query) {
    if (typeof query !== 'string') return query;

    const dangerousPatterns = [
      // SQL keywords
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare)\b)/gi,
      // SQL operators and conditions
      /(\b(or|and)\s+\d+\s*[=<>]+\s*\d+)/gi,
      // SQL comments
      /(\/\*|\*\/|--|#)/g,
      // SQL string terminators
      /('|")/g,
      // SQL functions
      /(\b(count|sum|avg|min|max|concat|substring|ascii|char)\s*\()/gi,
      // Boolean conditions
      /(\b\d+\s*[=<>]+\s*\d+\b)/gi
    ];
    
    let sanitized = query;
    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized.trim();
  }

  /**
   * Rate limiting with intelligent threat detection
   */
  checkRateLimit(ip, endpoint, maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    
    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remainingRequests: maxRequests - 1 };
    }
    
    const rateLimitData = this.rateLimitStore.get(key);
    
    if (now > rateLimitData.resetTime) {
      // Reset the window
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remainingRequests: maxRequests - 1 };
    }
    
    rateLimitData.count++;
    
    if (rateLimitData.count > maxRequests) {
      this.markSuspiciousIP(ip);
      return { 
        allowed: false, 
        remainingRequests: 0,
        resetTime: rateLimitData.resetTime 
      };
    }
    
    return { 
      allowed: true, 
      remainingRequests: maxRequests - rateLimitData.count 
    };
  }

  /**
   * Mark IP as suspicious for enhanced monitoring
   */
  markSuspiciousIP(ip) {
    const suspicionData = this.suspiciousIPs.get(ip) || { count: 0, firstSeen: Date.now() };
    suspicionData.count++;
    suspicionData.lastSeen = Date.now();
    
    this.suspiciousIPs.set(ip, suspicionData);
    
    // Log suspicious activity
    console.warn('Suspicious IP activity detected:', {
      ip,
      suspicionCount: suspicionData.count,
      firstSeen: new Date(suspicionData.firstSeen).toISOString(),
      lastSeen: new Date(suspicionData.lastSeen).toISOString()
    });
  }

  /**
   * Check if IP is currently suspicious
   */
  isSuspiciousIP(ip) {
    const suspicionData = this.suspiciousIPs.get(ip);
    if (!suspicionData) return false;
    
    // Consider IP suspicious if it has more than 5 violations in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return suspicionData.count > 5 && suspicionData.lastSeen > oneHourAgo;
  }

  /**
   * Validate request timing to prevent replay attacks
   */
  validateRequestTiming(timestamp, maxAgeSeconds = 300) {
    const requestTime = parseInt(timestamp);
    const now = Date.now() / 1000;
    const age = now - requestTime;
    
    return age >= 0 && age <= maxAgeSeconds;
  }

  /**
   * Generate secure request signature
   */
  generateSignature(payload) {
    return crypto
      .createHmac('sha256', process.env.API_SECRET || 'default-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Blacklist a JWT token
   */
  blacklistToken(token) {
    this.invalidTokens.add(token);
    
    // Clean up old tokens periodically (keep last 1000)
    if (this.invalidTokens.size > 1000) {
      const tokensArray = Array.from(this.invalidTokens);
      this.invalidTokens = new Set(tokensArray.slice(-500));
    }
  }

  /**
   * Validate API key format and strength
   */
  isValidKey(key) {
    if (typeof key !== 'string') return false;
    if (key.length < 3 || key.length > 50) return false;
    
    // Only allow alphanumeric characters and common separators
    const validKeyPattern = /^[a-zA-Z0-9_\-\.]+$/;
    return validKeyPattern.test(key);
  }

  /**
   * Clean up expired data
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean up rate limit store
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
    
    // Clean up suspicious IPs (keep data for 24 hours)
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.lastSeen < oneDayAgo) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  /**
   * Get security metrics for monitoring
   */
  getSecurityMetrics() {
    return {
      rateLimitEntries: this.rateLimitStore.size,
      blacklistedTokens: this.invalidTokens.size,
      suspiciousIPs: this.suspiciousIPs.size,
      topSuspiciousIPs: Array.from(this.suspiciousIPs.entries())
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([ip, data]) => ({ ip, ...data }))
    };
  }
}

// Export singleton instance
module.exports = new APISecurityManager();