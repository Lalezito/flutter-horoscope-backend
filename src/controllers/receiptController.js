const receiptValidationService = require('../services/receiptValidationService');
const logger = require('../services/loggingService');
const { validationResult } = require('express-validator');

/**
 * 🏪 RECEIPT VALIDATION CONTROLLER
 * Handles App Store receipt validation for in-app purchases
 */

/**
 * 🔍 VALIDATE RECEIPT
 * POST /api/receipts/validate
 */
async function validateReceipt(req, res) {
  try {
    // Input validation
    const { receiptData, userId } = req.body;
    
    if (!receiptData) {
      return res.status(400).json({
        success: false,
        error: 'Receipt data is required',
        code: 'MISSING_RECEIPT_DATA'
      });
    }

    // Validate receipt with Apple
    const validation = await receiptValidationService.validateReceipt(receiptData, {
      userIP: req.ip,
      userId: userId || 'anonymous'
    });

    // Log validation attempt
    logger.getLogger().info('Receipt validation request', {
      userId: userId || 'anonymous',
      ip: req.ip,
      isValid: validation.isValid,
      status: validation.status
    });

    // Return validation result
    res.json({
      success: true,
      validation: {
        isValid: validation.isValid,
        status: validation.status,
        message: validation.message,
        environment: validation.environment
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'validateReceipt',
      userId: req.body.userId || 'anonymous',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Receipt validation failed',
      code: 'VALIDATION_ERROR',
      message: 'Unable to validate receipt at this time'
    });
  }
}

/**
 * 📱 GET SUBSCRIPTION STATUS
 * POST /api/receipts/subscription/status
 */
async function getSubscriptionStatus(req, res) {
  try {
    const { receiptData, productId, userId } = req.body;
    
    if (!receiptData || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Receipt data and product ID are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Validate subscription
    const subscriptionStatus = await receiptValidationService.validateSubscription(
      receiptData, 
      productId,
      {
        userIP: req.ip,
        userId: userId || 'anonymous'
      }
    );

    // Log subscription check
    logger.getLogger().info('Subscription status check', {
      userId: userId || 'anonymous',
      productId,
      isActive: subscriptionStatus.isActive,
      ip: req.ip
    });

    res.json({
      success: true,
      subscription: {
        productId,
        isActive: subscriptionStatus.isActive,
        reason: subscriptionStatus.reason,
        expiresDate: subscriptionStatus.expiresDate
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'getSubscriptionStatus',
      productId: req.body.productId,
      userId: req.body.userId || 'anonymous',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Subscription status check failed',
      code: 'STATUS_CHECK_ERROR'
    });
  }
}

/**
 * 👤 GET USER STATUS
 * POST /api/receipts/user/status
 */
async function getUserStatus(req, res) {
  try {
    const { receiptData, userId } = req.body;
    
    if (!receiptData || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Receipt data and user ID are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Get comprehensive user status
    const userStatus = await receiptValidationService.getUserSubscriptionStatus(
      receiptData,
      userId,
      {
        userIP: req.ip
      }
    );

    // Log user status check
    logger.getLogger().info('User status check', {
      userId,
      isPremium: userStatus.isPremium,
      activeSubscriptions: userStatus.activeSubscriptions,
      ip: req.ip
    });

    res.json({
      success: true,
      user: {
        userId: userStatus.userId,
        isPremium: userStatus.isPremium,
        activeSubscriptions: userStatus.activeSubscriptions,
        expiresDate: userStatus.expiresDate,
        subscriptions: userStatus.subscriptions.map(sub => ({
          productId: sub.productId,
          isActive: sub.isActive,
          expiresDate: sub.expiresDate
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'getUserStatus',
      userId: req.body.userId || 'anonymous',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'User status check failed',
      code: 'USER_STATUS_ERROR'
    });
  }
}

/**
 * 🔄 REFRESH RECEIPT
 * POST /api/receipts/refresh
 */
async function refreshReceipt(req, res) {
  try {
    const { receiptData, userId } = req.body;
    
    if (!receiptData) {
      return res.status(400).json({
        success: false,
        error: 'Receipt data is required',
        code: 'MISSING_RECEIPT_DATA'
      });
    }

    // Refresh receipt status
    const refreshResult = await receiptValidationService.refreshReceiptStatus(
      receiptData,
      {
        userIP: req.ip,
        userId: userId || 'anonymous'
      }
    );

    // Log refresh attempt
    logger.getLogger().info('Receipt refresh', {
      userId: userId || 'anonymous',
      success: refreshResult.success,
      latestReceipts: refreshResult.latestReceipts?.length || 0,
      ip: req.ip
    });

    if (!refreshResult.success) {
      return res.status(400).json({
        success: false,
        error: refreshResult.error,
        code: 'REFRESH_FAILED'
      });
    }

    res.json({
      success: true,
      refresh: {
        refreshDate: refreshResult.refreshDate,
        latestReceiptsCount: refreshResult.latestReceipts?.length || 0,
        pendingRenewalsCount: refreshResult.pendingRenewals?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'refreshReceipt',
      userId: req.body.userId || 'anonymous',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Receipt refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
}

/**
 * 🧪 TEST CONFIGURATION
 * GET /api/receipts/test?admin_key=YOUR_ADMIN_KEY
 */
async function testConfiguration(req, res) {
  try {
    // Admin authentication
    const adminKey = req.query.admin_key || req.headers['x-admin-key'];
    const expectedAdminKey = process.env.ADMIN_KEY;

    if (!adminKey || !expectedAdminKey || adminKey !== expectedAdminKey) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Test service configuration
    const testResult = await receiptValidationService.testConfiguration();
    const serviceStatus = receiptValidationService.getStatus();

    // Log admin test
    logger.getLogger().info('Receipt validation test', {
      adminIP: req.ip,
      configured: testResult.success,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      test: testResult,
      service: serviceStatus,
      endpoints: {
        validate: '/api/receipts/validate',
        subscriptionStatus: '/api/receipts/subscription/status',
        userStatus: '/api/receipts/user/status',
        refresh: '/api/receipts/refresh'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'testConfiguration',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Configuration test failed',
      code: 'TEST_ERROR'
    });
  }
}

/**
 * 📊 GET RECEIPT VALIDATION STATS (Admin only)
 * GET /api/receipts/stats?admin_key=YOUR_ADMIN_KEY
 */
async function getValidationStats(req, res) {
  try {
    // Admin authentication
    const adminKey = req.query.admin_key || req.headers['x-admin-key'];
    const expectedAdminKey = process.env.ADMIN_KEY;

    if (!adminKey || !expectedAdminKey || adminKey !== expectedAdminKey) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Return basic stats (can be enhanced with actual database queries)
    const stats = {
      service: 'Receipt Validation Service',
      status: 'operational',
      configured: !!process.env.APPLE_SHARED_SECRET,
      bundleId: process.env.APPLE_BUNDLE_ID || 'com.zodiac.lifecoach',
      supportedProducts: {
        monthly: process.env.MONTHLY_SUBSCRIPTION_ID || 'zodiac_monthly_premium',
        yearly: process.env.YEARLY_SUBSCRIPTION_ID || 'zodiac_yearly_premium'
      },
      endpoints: 4,
      lastCheck: new Date().toISOString()
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, {
      endpoint: 'getValidationStats',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Stats retrieval failed',
      code: 'STATS_ERROR'
    });
  }
}

module.exports = {
  validateReceipt,
  getSubscriptionStatus,
  getUserStatus,
  refreshReceipt,
  testConfiguration,
  getValidationStats
};