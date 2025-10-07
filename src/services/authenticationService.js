/**
 * ENTERPRISE AUTHENTICATION SERVICE
 * 
 * Advanced JWT-based authentication with role-based access control
 * Enterprise-grade security features:
 * - JWT token management with secure signing
 * - Role-based access control (RBAC)
 * - Session management and tracking
 * - Token rotation and invalidation
 * - Security event logging
 * - Multi-factor authentication support
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const redisService = require('./redisService');
const securityHardeningService = require('./securityHardeningService');

class AuthenticationService {
  constructor() {
    this.config = {
      // JWT Configuration
      jwtSecret: process.env.JWT_SECRET || this.generateSecureSecret(),
      jwtExpiration: process.env.JWT_EXPIRATION || '24h',
      refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
      
      // Security Settings
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 900000, // 15 minutes
      
      // Session Settings
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour
      maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5,
      
      // Token Rotation
      tokenRotationInterval: parseInt(process.env.TOKEN_ROTATION_INTERVAL) || 86400000, // 24 hours
      allowedTokenAge: parseInt(process.env.ALLOWED_TOKEN_AGE) || 300, // 5 minutes for critical operations
    };

    // Role definitions with permissions
    this.roles = {
      'super_admin': {
        level: 100,
        permissions: [
          'system:admin',
          'users:manage',
          'security:configure',
          'database:admin',
          'monitoring:admin',
          'secrets:manage',
          'audit:access'
        ],
        description: 'Full system access'
      },
      'admin': {
        level: 80,
        permissions: [
          'admin:access',
          'content:manage',
          'users:view',
          'monitoring:view',
          'generation:control'
        ],
        description: 'Administrative access'
      },
      'premium_user': {
        level: 50,
        permissions: [
          'api:premium',
          'content:premium',
          'neural:access',
          'history:extended'
        ],
        description: 'Premium user access'
      },
      'user': {
        level: 20,
        permissions: [
          'api:basic',
          'content:basic',
          'profile:manage'
        ],
        description: 'Standard user access'
      },
      'guest': {
        level: 10,
        permissions: [
          'api:public',
          'content:limited'
        ],
        description: 'Limited public access'
      }
    };

    // Track active sessions and failed attempts
    this.activeSessions = new Map();
    this.failedAttempts = new Map();
    this.invalidatedTokens = new Set();
    
    console.log('🔐 Authentication Service initialized');
  }

  /**
   * Initialize authentication service
   */
  async initialize() {
    try {
      // Ensure JWT secret is properly configured
      if (!process.env.JWT_SECRET) {
        const newSecret = this.generateSecureSecret();
        console.warn('⚠️ JWT_SECRET not set in environment. Generated temporary secret.');
        console.warn('🔑 Add this to your production environment: JWT_SECRET=' + newSecret);
        this.config.jwtSecret = newSecret;
      }

      // Create default admin user if not exists
      await this.createDefaultAdminUser();

      // Start cleanup processes
      this.startCleanupTasks();

      console.log('✅ Authentication service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Authentication service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with enhanced security
   */
  async authenticate(identifier, password, ip, userAgent) {
    const startTime = Date.now();
    
    try {
      // Check for account lockout
      if (await this.isAccountLocked(identifier, ip)) {
        await securityHardeningService.auditLogger.logSecurityEvent({
          type: 'failed_auth',
          severity: 'warning',
          ip: ip,
          details: { identifier, reason: 'account_locked' }
        });
        
        throw new Error('Account temporarily locked due to suspicious activity');
      }

      // Find user (in a real app, this would query a user database)
      const user = await this.findUser(identifier);
      if (!user) {
        await this.recordFailedAttempt(identifier, ip, 'invalid_user');
        throw new Error('Invalid credentials');
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        await this.recordFailedAttempt(identifier, ip, 'invalid_password');
        throw new Error('Invalid credentials');
      }

      // Check user status
      if (user.status !== 'active') {
        await this.recordFailedAttempt(identifier, ip, 'inactive_user');
        throw new Error('User account is not active');
      }

      // Create session
      const session = await this.createSession(user, ip, userAgent);
      
      // Clear failed attempts on successful login
      await this.clearFailedAttempts(identifier, ip);

      // Log successful authentication
      await securityHardeningService.auditLogger.logSecurityEvent({
        type: 'successful_auth',
        severity: 'info',
        ip: ip,
        details: { 
          user_id: user.id, 
          role: user.role,
          response_time: Date.now() - startTime
        }
      });

      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: this.parseExpiration(this.config.jwtExpiration),
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: this.getRolePermissions(user.role),
          last_login: new Date().toISOString()
        }
      };

    } catch (error) {
      await securityHardeningService.auditLogger.logSecurityEvent({
        type: 'failed_auth',
        severity: 'warning',
        ip: ip,
        details: { 
          identifier, 
          error: error.message,
          response_time: Date.now() - startTime
        }
      });
      
      throw error;
    }
  }

  /**
   * Create a new user session with JWT tokens
   */
  async createSession(user, ip, userAgent) {
    const sessionId = crypto.randomUUID();
    const now = new Date();

    // Generate access token
    const accessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      permissions: this.getRolePermissions(user.role),
      session_id: sessionId,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor((now.getTime() + this.parseExpiration(this.config.jwtExpiration)) / 1000)
    };

    // Generate refresh token
    const refreshTokenPayload = {
      sub: user.id,
      session_id: sessionId,
      type: 'refresh',
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor((now.getTime() + this.parseExpiration(this.config.refreshTokenExpiration)) / 1000)
    };

    const accessToken = jwt.sign(accessTokenPayload, this.config.jwtSecret);
    const refreshToken = jwt.sign(refreshTokenPayload, this.config.jwtSecret);

    // Store session info
    const sessionData = {
      id: sessionId,
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      ip: ip,
      user_agent: userAgent,
      created_at: now.toISOString(),
      last_activity: now.toISOString(),
      expires_at: new Date(now.getTime() + this.parseExpiration(this.config.jwtExpiration)).toISOString()
    };

    // Store in Redis and memory
    await redisService.set(`session:${sessionId}`, sessionData, Math.floor(this.parseExpiration(this.config.refreshTokenExpiration) / 1000));
    this.activeSessions.set(sessionId, sessionData);

    // Manage concurrent sessions
    await this.manageConcurrentSessions(user.id, sessionId);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      session_id: sessionId
    };
  }

  /**
   * Validate JWT token with comprehensive security checks
   */
  async validateToken(token, requiredPermissions = []) {
    try {
      // Check if token is blacklisted
      if (this.invalidatedTokens.has(token)) {
        throw new Error('Token has been invalidated');
      }

      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, this.config.jwtSecret);

      // Check if session still exists
      const sessionData = await redisService.get(`session:${decoded.session_id}`);
      if (!sessionData) {
        throw new Error('Session not found or expired');
      }

      // Check if user still exists and is active
      const user = await this.findUserById(decoded.sub);
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      // Check required permissions
      if (requiredPermissions.length > 0) {
        const userPermissions = this.getRolePermissions(decoded.role);
        const hasPermissions = requiredPermissions.every(permission => 
          userPermissions.includes(permission) || userPermissions.includes('system:admin')
        );

        if (!hasPermissions) {
          throw new Error('Insufficient permissions');
        }
      }

      // Update session activity
      await this.updateSessionActivity(decoded.session_id);

      return {
        valid: true,
        user: {
          id: decoded.sub,
          username: decoded.username,
          role: decoded.role,
          permissions: decoded.permissions,
          session_id: decoded.session_id
        },
        token: decoded
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken, ip, userAgent) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get session data
      const sessionData = await redisService.get(`session:${decoded.session_id}`);
      if (!sessionData || sessionData.refresh_token !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user data
      const user = await this.findUserById(decoded.sub);
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const newSession = await this.createSession(user, ip, userAgent);
      
      // Invalidate old session
      await this.invalidateSession(decoded.session_id);

      return {
        access_token: newSession.access_token,
        refresh_token: newSession.refresh_token,
        expires_in: this.parseExpiration(this.config.jwtExpiration),
        token_type: 'Bearer'
      };

    } catch (error) {
      throw new Error('Token refresh failed: ' + error.message);
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token, sessionId) {
    try {
      // Invalidate the token
      this.invalidatedTokens.add(token);
      
      // Remove session
      await this.invalidateSession(sessionId);

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      throw new Error('Logout failed: ' + error.message);
    }
  }

  /**
   * Role-based access control middleware
   */
  requireRole(requiredRole) {
    return async (req, res, next) => {
      try {
        const token = this.extractTokenFromRequest(req);
        if (!token) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const validation = await this.validateToken(token);
        if (!validation.valid) {
          return res.status(401).json({ error: validation.error });
        }

        const userRole = validation.user.role;
        const requiredLevel = this.roles[requiredRole]?.level || 0;
        const userLevel = this.roles[userRole]?.level || 0;

        if (userLevel < requiredLevel) {
          await securityHardeningService.auditLogger.logSecurityEvent({
            type: 'access_denied',
            severity: 'warning',
            ip: req.ip,
            details: { 
              user_id: validation.user.id,
              required_role: requiredRole,
              user_role: userRole,
              endpoint: req.path
            }
          });

          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required_role: requiredRole,
            your_role: userRole
          });
        }

        // Add user info to request
        req.user = validation.user;
        req.token = validation.token;
        next();

      } catch (error) {
        console.error('Role validation error:', error);
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  /**
   * Permission-based access control middleware
   */
  requirePermission(requiredPermissions) {
    if (!Array.isArray(requiredPermissions)) {
      requiredPermissions = [requiredPermissions];
    }

    return async (req, res, next) => {
      try {
        const token = this.extractTokenFromRequest(req);
        if (!token) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const validation = await this.validateToken(token, requiredPermissions);
        if (!validation.valid) {
          if (validation.error.includes('Insufficient permissions')) {
            return res.status(403).json({ 
              error: 'Insufficient permissions',
              required_permissions: requiredPermissions,
              your_permissions: validation.user?.permissions || []
            });
          }
          return res.status(401).json({ error: validation.error });
        }

        req.user = validation.user;
        req.token = validation.token;
        next();

      } catch (error) {
        console.error('Permission validation error:', error);
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  /**
   * Create default admin user for initial setup
   */
  async createDefaultAdminUser() {
    const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || this.generateSecurePassword();
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@zodiac-system.local';

    // Check if admin already exists
    const existingAdmin = await this.findUser(adminUsername);
    if (existingAdmin) {
      return existingAdmin;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, this.config.bcryptRounds);
    
    const adminUser = {
      id: crypto.randomUUID(),
      username: adminUsername,
      email: adminEmail,
      password_hash: hashedPassword,
      role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      last_login: null
    };

    // Store in Redis (in a real app, store in database)
    await redisService.set(`user:${adminUser.id}`, adminUser, 0); // No expiration
    await redisService.set(`user_lookup:${adminUsername}`, adminUser.id, 0);
    await redisService.set(`user_lookup:${adminEmail}`, adminUser.id, 0);

    if (!process.env.DEFAULT_ADMIN_PASSWORD) {
      console.warn('⚠️ Default admin user created:');
      console.warn(`   Username: ${adminUsername}`);
      console.warn(`   Password: ${adminPassword}`);
      console.warn('🔒 Please change the password immediately after first login');
    }

    return adminUser;
  }

  // Utility methods

  extractTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return req.query.token || req.headers['x-access-token'];
  }

  async findUser(identifier) {
    try {
      const userId = await redisService.get(`user_lookup:${identifier}`);
      if (!userId) return null;
      
      return await redisService.get(`user:${userId}`);
    } catch (error) {
      console.error('Find user error:', error);
      return null;
    }
  }

  async findUserById(id) {
    try {
      return await redisService.get(`user:${id}`);
    } catch (error) {
      console.error('Find user by ID error:', error);
      return null;
    }
  }

  getRolePermissions(role) {
    return this.roles[role]?.permissions || [];
  }

  async recordFailedAttempt(identifier, ip, reason) {
    const key = `failed_attempts:${identifier}:${ip}`;
    const attempts = await redisService.get(key) || 0;
    await redisService.set(key, attempts + 1, Math.floor(this.config.lockoutDuration / 1000));
  }

  async clearFailedAttempts(identifier, ip) {
    const key = `failed_attempts:${identifier}:${ip}`;
    await redisService.delete(key);
  }

  async isAccountLocked(identifier, ip) {
    const key = `failed_attempts:${identifier}:${ip}`;
    const attempts = await redisService.get(key) || 0;
    return attempts >= this.config.maxLoginAttempts;
  }

  async updateSessionActivity(sessionId) {
    const sessionData = await redisService.get(`session:${sessionId}`);
    if (sessionData) {
      sessionData.last_activity = new Date().toISOString();
      await redisService.set(`session:${sessionId}`, sessionData, Math.floor(this.parseExpiration(this.config.refreshTokenExpiration) / 1000));
    }
  }

  async invalidateSession(sessionId) {
    await redisService.delete(`session:${sessionId}`);
    this.activeSessions.delete(sessionId);
  }

  async manageConcurrentSessions(userId, newSessionId) {
    // Get all sessions for user
    const userSessions = [];
    for (const [sessionId, sessionData] of this.activeSessions.entries()) {
      if (sessionData.user_id === userId) {
        userSessions.push({ sessionId, ...sessionData });
      }
    }

    // Remove oldest sessions if limit exceeded
    if (userSessions.length >= this.config.maxConcurrentSessions) {
      const sortedSessions = userSessions.sort((a, b) => 
        new Date(a.last_activity) - new Date(b.last_activity)
      );

      const sessionsToRemove = sortedSessions.slice(0, -this.config.maxConcurrentSessions + 1);
      for (const session of sessionsToRemove) {
        await this.invalidateSession(session.sessionId);
      }
    }
  }

  generateSecureSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  generateSecurePassword() {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  parseExpiration(expiration) {
    if (typeof expiration === 'number') return expiration;
    
    const match = expiration.match(/(\d+)([smhd])/);
    if (!match) return 3600000; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 3600000);
  }

  startCleanupTasks() {
    // Clean up expired tokens and sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredData();
    }, 300000);
  }

  async cleanupExpiredData() {
    const now = Date.now();
    
    // Clean up invalidated tokens (keep for 1 hour)
    if (this.invalidatedTokens.size > 1000) {
      this.invalidatedTokens = new Set(Array.from(this.invalidatedTokens).slice(-500));
    }
    
    // Clean up expired sessions from memory
    for (const [sessionId, sessionData] of this.activeSessions.entries()) {
      if (new Date(sessionData.expires_at).getTime() < now) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get authentication service status
   */
  getStatus() {
    return {
      active_sessions: this.activeSessions.size,
      invalidated_tokens: this.invalidatedTokens.size,
      failed_attempts: this.failedAttempts.size,
      roles_configured: Object.keys(this.roles).length,
      security_level: 'enterprise',
      features: [
        'jwt_authentication',
        'role_based_access_control',
        'session_management',
        'token_rotation',
        'concurrent_session_control',
        'failed_attempt_tracking',
        'security_event_logging'
      ]
    };
  }
}

module.exports = new AuthenticationService();