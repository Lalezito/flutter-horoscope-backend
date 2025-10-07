/**
 * AUTHENTICATION ROUTES
 * 
 * Enterprise-grade authentication endpoints with comprehensive security
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authenticationService');
const { validateInput } = require('../middleware/security');
const { endpointLimits } = require('../middleware/rateLimiter');

// Apply strict rate limiting to auth endpoints
router.use(endpointLimits.auth);

/**
 * @route POST /api/auth/login
 * @description User login with JWT token generation
 * @access Public
 * @body {string} username - Username or email
 * @body {string} password - User password
 */
router.post('/login', validateInput, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['username', 'password']
      });
    }

    // Authenticate user
    const authResult = await authService.authenticate(username, password, ip, userAgent);

    res.json({
      success: true,
      message: 'Authentication successful',
      ...authResult
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/auth/refresh
 * @description Refresh access token using refresh token
 * @access Public
 * @body {string} refresh_token - Valid refresh token
 */
router.post('/refresh', validateInput, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Missing refresh token'
      });
    }

    const refreshResult = await authService.refreshToken(refresh_token, ip, userAgent);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      ...refreshResult
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @description Logout user and invalidate session
 * @access Private
 * @headers {string} Authorization - Bearer token
 */
router.post('/logout', async (req, res) => {
  try {
    const token = authService.extractTokenFromRequest(req);
    const sessionId = req.user?.session_id;

    if (token && sessionId) {
      await authService.logout(token, sessionId);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/me
 * @description Get current user information
 * @access Private
 * @headers {string} Authorization - Bearer token
 */
router.get('/me', authService.requireRole('user'), async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      message: error.message
    });
  }
});

/**
 * @route POST /api/auth/validate
 * @description Validate token and get user info
 * @access Public
 * @body {string} token - JWT token to validate
 */
router.post('/validate', validateInput, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Missing token'
      });
    }

    const validation = await authService.validateToken(token);

    if (validation.valid) {
      res.json({
        valid: true,
        user: validation.user
      });
    } else {
      res.status(401).json({
        valid: false,
        error: validation.error
      });
    }

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Token validation failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/permissions
 * @description Get user permissions
 * @access Private
 * @headers {string} Authorization - Bearer token
 */
router.get('/permissions', authService.requireRole('user'), async (req, res) => {
  try {
    res.json({
      success: true,
      permissions: req.user.permissions,
      role: req.user.role,
      role_level: authService.roles[req.user.role]?.level || 0
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      error: 'Failed to get permissions',
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/sessions
 * @description Get user active sessions
 * @access Private
 * @headers {string} Authorization - Bearer token
 */
router.get('/sessions', authService.requireRole('user'), async (req, res) => {
  try {
    const userSessions = [];
    
    for (const [sessionId, sessionData] of authService.activeSessions.entries()) {
      if (sessionData.user_id === req.user.id) {
        userSessions.push({
          id: sessionId,
          ip: sessionData.ip,
          user_agent: sessionData.user_agent,
          created_at: sessionData.created_at,
          last_activity: sessionData.last_activity,
          current: sessionId === req.user.session_id
        });
      }
    }

    res.json({
      success: true,
      sessions: userSessions,
      total: userSessions.length
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/auth/sessions/:sessionId
 * @description Terminate a specific session
 * @access Private
 * @headers {string} Authorization - Bearer token
 * @param {string} sessionId - Session ID to terminate
 */
router.delete('/sessions/:sessionId', authService.requireRole('user'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Verify session belongs to current user
    const sessionData = authService.activeSessions.get(sessionId);
    if (!sessionData || sessionData.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    await authService.invalidateSession(sessionId);

    res.json({
      success: true,
      message: 'Session terminated successfully'
    });

  } catch (error) {
    console.error('Terminate session error:', error);
    res.status(500).json({
      error: 'Failed to terminate session',
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/status
 * @description Get authentication service status
 * @access Private (Admin)
 * @headers {string} Authorization - Bearer token with admin role
 */
router.get('/status', authService.requireRole('admin'), async (req, res) => {
  try {
    const status = authService.getStatus();
    
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get auth status error:', error);
    res.status(500).json({
      error: 'Failed to get authentication status',
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/roles
 * @description Get available roles and permissions
 * @access Private (Admin)
 * @headers {string} Authorization - Bearer token with admin role
 */
router.get('/roles', authService.requireRole('admin'), async (req, res) => {
  try {
    res.json({
      success: true,
      roles: authService.roles
    });

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      error: 'Failed to get roles',
      message: error.message
    });
  }
});

module.exports = router;