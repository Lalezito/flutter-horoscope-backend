/**
 * 🔐 AUTHENTICATION MIDDLEWARE
 * 
 * JWT-based authentication middleware with optional authentication support
 * for astrological timing and other API endpoints.
 */

const jwt = require('jsonwebtoken');
const authenticationService = require('../services/authenticationService');
const logger = require('../utils/logger');

class AuthMiddleware {
    /**
     * Verify JWT token and extract user information
     */
    authenticate(req, res, next) {
        try {
            const token = this.extractToken(req);
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Access token required',
                    code: 'MISSING_TOKEN',
                    timestamp: new Date().toISOString()
                });
            }

            // Verify JWT token
            const secret = process.env.JWT_SECRET || 'fallback-secret-key';
            const decoded = jwt.verify(token, secret);

            if (!decoded || !decoded.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token format',
                    code: 'INVALID_TOKEN',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if token is blacklisted (if using token invalidation)
            if (this.isTokenBlacklisted(token)) {
                return res.status(401).json({
                    success: false,
                    message: 'Token has been invalidated',
                    code: 'INVALIDATED_TOKEN',
                    timestamp: new Date().toISOString()
                });
            }

            // Add user information to request
            req.user = {
                id: decoded.userId,
                role: decoded.role || 'user',
                permissions: decoded.permissions || [],
                sessionId: decoded.sessionId,
                iat: decoded.iat,
                exp: decoded.exp
            };

            // Log authentication success
            logger.info('Authentication successful', {
                userId: req.user.id,
                role: req.user.role,
                endpoint: req.path,
                ip: req.ip
            });

            next();

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token has expired',
                    code: 'TOKEN_EXPIRED',
                    timestamp: new Date().toISOString()
                });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token',
                    code: 'INVALID_TOKEN',
                    timestamp: new Date().toISOString()
                });
            }

            logger.error('Authentication error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authentication service error',
                code: 'AUTH_SERVICE_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Optional authentication - allows both authenticated and anonymous access
     * Useful for features that can be enhanced with user data but don't require it
     */
    authenticateOptional(req, res, next) {
        try {
            const token = this.extractToken(req);
            
            if (!token) {
                // No token provided - continue as anonymous user
                req.user = null;
                logger.info('Anonymous access', {
                    endpoint: req.path,
                    ip: req.ip
                });
                return next();
            }

            // Token provided - try to authenticate
            const secret = process.env.JWT_SECRET || 'fallback-secret-key';
            const decoded = jwt.verify(token, secret);

            if (decoded && decoded.userId && !this.isTokenBlacklisted(token)) {
                // Valid token - add user information
                req.user = {
                    id: decoded.userId,
                    role: decoded.role || 'user',
                    permissions: decoded.permissions || [],
                    sessionId: decoded.sessionId,
                    iat: decoded.iat,
                    exp: decoded.exp
                };

                logger.info('Authenticated access', {
                    userId: req.user.id,
                    role: req.user.role,
                    endpoint: req.path,
                    ip: req.ip
                });
            } else {
                // Invalid token - continue as anonymous
                req.user = null;
                logger.warn('Invalid token provided, continuing as anonymous', {
                    endpoint: req.path,
                    ip: req.ip
                });
            }

            next();

        } catch (error) {
            // Token validation failed - continue as anonymous user
            req.user = null;
            
            if (error.name === 'TokenExpiredError') {
                logger.info('Expired token provided, continuing as anonymous', {
                    endpoint: req.path,
                    ip: req.ip
                });
            } else {
                logger.warn('Token validation failed, continuing as anonymous', {
                    error: error.message,
                    endpoint: req.path,
                    ip: req.ip
                });
            }
            
            next();
        }
    }

    /**
     * Role-based access control middleware
     */
    requireRole(requiredRole) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED',
                    timestamp: new Date().toISOString()
                });
            }

            const userRole = req.user.role;
            const hasPermission = this.checkRolePermission(userRole, requiredRole);

            if (!hasPermission) {
                logger.warn('Access denied - insufficient role', {
                    userId: req.user.id,
                    userRole,
                    requiredRole,
                    endpoint: req.path
                });

                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required role: ${requiredRole}`,
                    code: 'INSUFFICIENT_ROLE',
                    userRole,
                    requiredRole,
                    timestamp: new Date().toISOString()
                });
            }

            next();
        };
    }

    /**
     * Permission-based access control middleware
     */
    requirePermission(requiredPermission) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED',
                    timestamp: new Date().toISOString()
                });
            }

            const userPermissions = req.user.permissions || [];
            const hasPermission = userPermissions.includes(requiredPermission);

            if (!hasPermission) {
                logger.warn('Access denied - insufficient permission', {
                    userId: req.user.id,
                    userPermissions,
                    requiredPermission,
                    endpoint: req.path
                });

                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required permission: ${requiredPermission}`,
                    code: 'INSUFFICIENT_PERMISSION',
                    userPermissions,
                    requiredPermission,
                    timestamp: new Date().toISOString()
                });
            }

            next();
        };
    }

    /**
     * Premium user access middleware
     */
    requirePremium(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required for premium features',
                code: 'AUTH_REQUIRED',
                timestamp: new Date().toISOString()
            });
        }

        const isPremium = req.user.role === 'premium_user' || 
                         req.user.role === 'admin' || 
                         req.user.role === 'super_admin' ||
                         req.user.permissions.includes('api:premium');

        if (!isPremium) {
            logger.warn('Premium access denied', {
                userId: req.user.id,
                role: req.user.role,
                endpoint: req.path
            });

            return res.status(403).json({
                success: false,
                message: 'Premium subscription required',
                code: 'PREMIUM_REQUIRED',
                upgradeUrl: '/api/subscription/upgrade',
                timestamp: new Date().toISOString()
            });
        }

        next();
    }

    /**
     * Extract token from request headers
     */
    extractToken(req) {
        // Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check x-auth-token header
        const authTokenHeader = req.headers['x-auth-token'];
        if (authTokenHeader) {
            return authTokenHeader;
        }

        // Check query parameter (less secure, for special cases)
        const tokenQuery = req.query.token;
        if (tokenQuery) {
            return tokenQuery;
        }

        return null;
    }

    /**
     * Check if token is blacklisted (simple in-memory check)
     * In production, this should check Redis or database
     */
    isTokenBlacklisted(token) {
        // Placeholder for token blacklist check
        // In production, implement proper token invalidation
        return false;
    }

    /**
     * Check if user role has sufficient permissions
     */
    checkRolePermission(userRole, requiredRole) {
        const roleHierarchy = {
            'super_admin': 100,
            'admin': 80,
            'premium_user': 50,
            'user': 20,
            'guest': 10
        };

        const userLevel = roleHierarchy[userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        return userLevel >= requiredLevel;
    }

    /**
     * Generate user context for logging and analytics
     */
    getUserContext(req) {
        if (!req.user) {
            return {
                type: 'anonymous',
                ip: req.ip,
                userAgent: req.get('User-Agent')
            };
        }

        return {
            type: 'authenticated',
            userId: req.user.id,
            role: req.user.role,
            permissions: req.user.permissions,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };
    }
}

const authMiddleware = new AuthMiddleware();

module.exports = {
    authenticate: authMiddleware.authenticate.bind(authMiddleware),
    authenticateOptional: authMiddleware.authenticateOptional.bind(authMiddleware),
    requireRole: authMiddleware.requireRole.bind(authMiddleware),
    requirePermission: authMiddleware.requirePermission.bind(authMiddleware),
    requirePremium: authMiddleware.requirePremium.bind(authMiddleware),
    getUserContext: authMiddleware.getUserContext.bind(authMiddleware)
};