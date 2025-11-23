/**
 * A/B Testing Middleware
 * Automatically assigns users to test variants and injects config
 */

const abTestingService = require('../services/abTestingService');
const { loggingService } = require('../services/loggingService');

/**
 * Middleware to automatically assign user to active tests
 */
async function autoAssignTests(req, res, next) {
  try {
    // Get user ID from request (adjust based on your auth setup)
    const userId = req.user?.firebaseUid || req.headers['x-user-id'];

    if (!userId) {
      return next(); // Skip if no user ID
    }

    // Get all active tests
    const activeTests = await abTestingService.getActiveTests();

    if (activeTests.length === 0) {
      return next();
    }

    // Assign user to all active tests they're eligible for
    const assignments = {};

    for (const test of activeTests) {
      const assignment = await abTestingService.assignUserToVariant(userId, test.id);

      if (assignment) {
        assignments[test.id] = {
          variantId: assignment.variantId,
          config: assignment.config
        };
      }
    }

    // Attach to request for downstream use
    req.abTests = assignments;

    next();
  } catch (error) {
    loggingService.log('error', `Error in A/B testing middleware: ${error.message}`);
    // Don't block request on A/B testing errors
    next();
  }
}

/**
 * Middleware to get variant config for specific test
 */
function getVariantConfig(testId) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.firebaseUid || req.headers['x-user-id'];

      if (!userId) {
        return next();
      }

      const config = await abTestingService.getVariantConfig(userId, testId);

      // Attach to request
      req.abTestConfig = config;

      next();
    } catch (error) {
      loggingService.log('error', `Error getting variant config: ${error.message}`);
      next();
    }
  };
}

/**
 * Middleware to track conversion events automatically
 */
function trackConversion(testId, eventType = 'conversion') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.firebaseUid || req.headers['x-user-id'];

      if (!userId) {
        return next();
      }

      // Extract amount from request body if available
      const amount = req.body?.amount || req.body?.price || 0;

      await abTestingService.trackEvent(userId, testId, eventType, { amount });

      next();
    } catch (error) {
      loggingService.log('error', `Error tracking conversion: ${error.message}`);
      next();
    }
  };
}

/**
 * Response interceptor to apply variant configurations
 */
function applyVariantConfig(configPath = 'config') {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // If we have A/B test configs, merge them into response
      if (req.abTests && Object.keys(req.abTests).length > 0) {
        data.abTests = req.abTests;
      }

      // If we have specific test config, merge it
      if (req.abTestConfig) {
        if (!data[configPath]) {
          data[configPath] = {};
        }
        Object.assign(data[configPath], req.abTestConfig);
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware to enable/disable features based on A/B test
 */
function featureFlag(testId, featureName) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.firebaseUid || req.headers['x-user-id'];

      if (!userId) {
        req.featureEnabled = false;
        return next();
      }

      const config = await abTestingService.getVariantConfig(userId, testId);

      if (!config) {
        req.featureEnabled = false;
        return next();
      }

      // Check if feature is enabled in variant config
      req.featureEnabled = config[featureName] === true;

      next();
    } catch (error) {
      loggingService.log('error', `Error checking feature flag: ${error.message}`);
      req.featureEnabled = false;
      next();
    }
  };
}

/**
 * Middleware to apply dynamic pricing from A/B test
 */
function dynamicPricing(testId) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.firebaseUid || req.headers['x-user-id'];

      if (!userId) {
        return next();
      }

      const config = await abTestingService.getVariantConfig(userId, testId);

      if (config && config.price) {
        req.dynamicPrice = config.price;
      }

      next();
    } catch (error) {
      loggingService.log('error', `Error applying dynamic pricing: ${error.message}`);
      next();
    }
  };
}

/**
 * Middleware to customize paywall messaging
 */
function paywallMessaging(testId) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.firebaseUid || req.headers['x-user-id'];

      if (!userId) {
        return next();
      }

      const config = await abTestingService.getVariantConfig(userId, testId);

      if (config) {
        req.paywallConfig = {
          message: config.paywallMessage,
          cta: config.cta,
          subtext: config.subtext
        };
      }

      next();
    } catch (error) {
      loggingService.log('error', `Error customizing paywall: ${error.message}`);
      next();
    }
  };
}

/**
 * Middleware to track page views for A/B tests
 */
function trackPageView(testId, pageName) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.firebaseUid || req.headers['x-user-id'];

      if (!userId) {
        return next();
      }

      await abTestingService.trackEvent(userId, testId, 'page_view', { page: pageName });

      next();
    } catch (error) {
      loggingService.log('error', `Error tracking page view: ${error.message}`);
      next();
    }
  };
}

module.exports = {
  autoAssignTests,
  getVariantConfig,
  trackConversion,
  applyVariantConfig,
  featureFlag,
  dynamicPricing,
  paywallMessaging,
  trackPageView
};
