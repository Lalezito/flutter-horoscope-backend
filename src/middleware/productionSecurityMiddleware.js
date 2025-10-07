/**
 * PRODUCTION SECURITY MIDDLEWARE STACK
 * 
 * Comprehensive security middleware for production deployment
 */

const securityHardeningService = require('../services/securityHardeningService');
const redisService = require('../services/redisService');
const crypto = require('crypto');

class ProductionSecurityMiddleware {
  constructor() {
    this.requestTracker = new Map();
    this.sessionStore = new Map();
  }

  /**
   * Initialize security middleware stack
   */
  async initialize() {
    console.log('🛡️ Initializing production security middleware...');
    
    await securityHardeningService.initialize();
    
    console.log('✅ Production security middleware ready');
  }

  /**
   * Create complete security middleware stack
   */
  createSecurityStack() {
    const stack = securityHardeningService.createSecurityMiddleware();
    
    // Add additional production-specific middleware
    stack.push(...[
      this.createRequestTrackingMiddleware(),
      this.createSessionSecurityMiddleware(),
      this.createAntiCSRFMiddleware(),
      this.createResponseSecurityMiddleware(),
      this.createAuditMiddleware()
    ]);
    
    return stack;
  }

  /**
   * Request tracking and fingerprinting
   */
  createRequestTrackingMiddleware() {
    return (req, res, next) => {
      // Generate unique request ID
      req.requestId = crypto.randomUUID();
      
      // Create request fingerprint
      const fingerprint = this.generateRequestFingerprint(req);
      req.fingerprint = fingerprint;
      
      // Track request timing
      req.startTime = Date.now();
      
      // Add request ID to response headers
      res.set('X-Request-ID', req.requestId);
      
      // Store request info for monitoring
      this.requestTracker.set(req.requestId, {
        fingerprint,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        startTime: req.startTime,
        path: req.path,
        method: req.method
      });
      
      // Cleanup old requests
      setTimeout(() => {
        this.requestTracker.delete(req.requestId);
      }, 300000); // 5 minutes
      
      next();
    };
  }

  /**
   * Session security middleware
   */
  createSessionSecurityMiddleware() {
    return async (req, res, next) => {
      const sessionToken = req.headers['x-session-token'] || req.query.session_token;
      
      if (sessionToken) {
        try {
          // Validate session token
          const session = await this.validateSession(sessionToken);
          
          if (session) {
            req.session = session;
            
            // Update session activity
            await this.updateSessionActivity(sessionToken, req.ip, req.get('User-Agent'));
            
            // Check for session hijacking
            if (await this.detectSessionHijacking(session, req)) {
              await securityHardeningService.auditLogger.logSecurityEvent({
                type: 'session_hijacking',
                severity: 'critical',
                ip: req.ip,
                details: { session_token: this.maskToken(sessionToken) }
              });
              
              return res.status(403).json({ error: 'Session security violation' });
            }
          } else {
            // Invalid session
            await securityHardeningService.auditLogger.logSecurityEvent({
              type: 'invalid_session',
              severity: 'warning',
              ip: req.ip,
              details: { session_token: this.maskToken(sessionToken) }
            });
          }
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }
      
      next();
    };
  }

  /**
   * Anti-CSRF middleware
   */
  createAntiCSRFMiddleware() {
    return (req, res, next) => {
      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionToken = req.headers['x-session-token'];
      
      // Skip CSRF for API endpoints with proper authentication
      if (req.path.startsWith('/api/') && sessionToken) {
        return next();
      }
      
      if (!csrfToken) {
        return res.status(403).json({ error: 'CSRF token required' });
      }
      
      // Validate CSRF token
      if (!this.validateCSRFToken(csrfToken, sessionToken)) {
        securityHardeningService.auditLogger.logSecurityEvent({
          type: 'csrf_violation',
          severity: 'high',
          ip: req.ip,
          details: { endpoint: req.path, method: req.method }
        });
        
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      
      next();
    };
  }

  /**
   * Response security middleware
   */
  createResponseSecurityMiddleware() {
    return (req, res, next) => {
      // Override res.json to add security headers and sanitization
      const originalJson = res.json;
      
      res.json = function(data) {
        // Add security headers
        res.set({
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        
        // Remove sensitive headers
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');
        
        // Sanitize response data
        const sanitizedData = this.sanitizeResponseData(data);
        
        return originalJson.call(this, sanitizedData);
      };
      
      next();
    };
  }

  /**
   * Audit middleware for logging all requests
   */
  createAuditMiddleware() {
    return async (req, res, next) => {
      // Capture response details
      const originalSend = res.send;
      
      res.send = async function(data) {
        const requestInfo = {
          request_id: req.requestId,
          ip: req.ip,
          method: req.method,
          path: req.path,
          user_agent: req.get('User-Agent'),
          status_code: res.statusCode,
          response_time: Date.now() - req.startTime,
          timestamp: new Date().toISOString(),
          fingerprint: req.fingerprint
        };
        
        // Store request metrics
        await redisService.recordMetric('api_requests', requestInfo);
        
        // Log security-relevant requests
        if (this.isSecurityRelevant(req, res)) {
          await securityHardeningService.auditLogger.logSecurityEvent({
            type: 'security_relevant_request',
            severity: 'info',
            ip: req.ip,
            endpoint: req.path,
            details: {
              method: req.method,
              status_code: res.statusCode,
              response_time: requestInfo.response_time
            }
          });
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Generate request fingerprint for tracking
   */
  generateRequestFingerprint(req) {
    const components = [
      req.ip,
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.method,
      req.path
    ];
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Validate session token
   */
  async validateSession(token) {
    try {
      const sessionKey = `session:${token}`;
      const session = await redisService.get(sessionKey);
      
      if (!session) return null;
      
      // Check if session is expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        await redisService.delete(sessionKey);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(token, ip, userAgent) {
    try {
      const sessionKey = `session:${token}`;
      const session = await redisService.get(sessionKey);
      
      if (session) {
        session.last_activity = new Date().toISOString();
        session.last_ip = ip;
        session.last_user_agent = userAgent;
        
        await redisService.set(sessionKey, session, 3600); // 1 hour TTL
      }
    } catch (error) {
      console.error('Session activity update error:', error);
    }
  }

  /**
   * Detect session hijacking attempts
   */
  async detectSessionHijacking(session, req) {
    // Check for IP address changes
    if (session.original_ip && session.original_ip !== req.ip) {
      // Allow some flexibility for mobile users, but log suspicious changes
      const ipChange = this.calculateIPSimilarity(session.original_ip, req.ip);
      if (ipChange < 0.5) { // Significant IP change
        return true;
      }
    }
    
    // Check for User-Agent changes
    if (session.original_user_agent && session.original_user_agent !== req.get('User-Agent')) {
      return true;
    }
    
    // Check for unusual access patterns
    const recentActivity = await this.getRecentSessionActivity(session.id);
    if (this.detectUnusualActivity(recentActivity)) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(csrfToken, sessionToken) {
    if (!sessionToken) return false;
    
    // Simple CSRF token validation (in production, use more sophisticated method)
    const expectedToken = crypto
      .createHash('sha256')
      .update(sessionToken + process.env.CSRF_SECRET || 'default_secret')
      .digest('hex')
      .substring(0, 32);
    
    return csrfToken === expectedToken;
  }

  /**
   * Sanitize response data
   */
  sanitizeResponseData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    // Clone the data to avoid mutations
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'private'];
    
    const removeSensitiveFields = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removeSensitiveFields(obj[key]);
        }
      }
    };
    
    removeSensitiveFields(sanitized);
    
    return sanitized;
  }

  /**
   * Check if request is security-relevant
   */
  isSecurityRelevant(req, res) {
    // Log admin endpoints
    if (req.path.includes('/admin')) return true;
    
    // Log authentication attempts
    if (req.path.includes('/auth') || req.path.includes('/login')) return true;
    
    // Log errors
    if (res.statusCode >= 400) return true;
    
    // Log generation endpoints
    if (req.path.includes('/generate')) return true;
    
    return false;
  }

  /**
   * Calculate IP similarity (simple implementation)
   */
  calculateIPSimilarity(ip1, ip2) {
    // Simple IP similarity based on common octets
    const parts1 = ip1.split('.');
    const parts2 = ip2.split('.');
    
    let matches = 0;
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) matches++;
    }
    
    return matches / 4; // Normalize to 0-1
  }

  /**
   * Get recent session activity
   */
  async getRecentSessionActivity(sessionId) {
    const key = `session_activity:${sessionId}`;
    return await redisService.get(key) || [];
  }

  /**
   * Detect unusual activity patterns
   */
  detectUnusualActivity(activityLog) {
    if (!activityLog || activityLog.length < 2) return false;
    
    // Check for rapid successive requests from different locations
    let locationChanges = 0;
    for (let i = 1; i < activityLog.length; i++) {
      if (activityLog[i].ip !== activityLog[i-1].ip) {
        locationChanges++;
      }
    }
    
    return locationChanges > activityLog.length / 2;
  }

  /**
   * Mask sensitive tokens for logging
   */
  maskToken(token) {
    if (!token || token.length < 8) return '***';
    return token.substring(0, 4) + '***' + token.substring(token.length - 4);
  }

  /**
   * Get security middleware status
   */
  getMiddlewareStatus() {
    return {
      active_requests: this.requestTracker.size,
      active_sessions: this.sessionStore.size,
      security_level: 'production',
      features: [
        'request_tracking',
        'session_security',
        'anti_csrf',
        'response_sanitization',
        'audit_logging'
      ]
    };
  }
}

module.exports = new ProductionSecurityMiddleware();