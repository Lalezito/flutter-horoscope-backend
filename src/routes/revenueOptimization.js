/**
 * REVENUE OPTIMIZATION API ROUTES
 *
 * Endpoints for:
 * - Dynamic pricing
 * - Personalized offers
 * - Churn prediction
 * - LTV optimization
 * - Revenue forecasting
 * - Pricing experiments
 */

const express = require('express');
const router = express.Router();
const revenueEngine = require('../services/revenueOptimizationEngine');
const logger = require('../services/loggingService');
const { endpointLimits } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/revenue/pricing/calculate
 * @desc    Calculate optimal price for a user and tier
 * @access  Public (user-specific)
 */
router.post('/pricing/calculate', endpointLimits.api, async (req, res) => {
  try {
    const { userId, tier } = req.body;

    if (!userId || !tier) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'tier']
      });
    }

    if (!['cosmic', 'universe'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        validTiers: ['cosmic', 'universe']
      });
    }

    const pricing = await revenueEngine.calculateOptimalPrice(userId, tier);

    res.json({
      success: true,
      pricing,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/pricing/calculate', body: req.body });
    res.status(500).json({
      error: 'Failed to calculate pricing',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/offers/generate
 * @desc    Generate personalized upgrade offer for user
 * @access  Public (user-specific)
 */
router.post('/offers/generate', endpointLimits.api, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId'
      });
    }

    const offer = await revenueEngine.generateUpgradeOffer(userId);

    if (!offer) {
      return res.json({
        success: true,
        hasOffer: false,
        message: 'No personalized offer available at this time'
      });
    }

    res.json({
      success: true,
      hasOffer: true,
      offer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/offers/generate', body: req.body });
    res.status(500).json({
      error: 'Failed to generate offer',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/discount/check
 * @desc    Check if user should receive a discount offer
 * @access  Public (user-specific)
 */
router.post('/discount/check', endpointLimits.api, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId'
      });
    }

    const discountCheck = await revenueEngine.shouldOfferDiscount(userId);

    res.json({
      success: true,
      shouldOffer: discountCheck.offer,
      discount: discountCheck.offer ? discountCheck : null,
      reason: discountCheck.reason,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/discount/check', body: req.body });
    res.status(500).json({
      error: 'Failed to check discount eligibility',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/churn/predict
 * @desc    Predict churn probability for a user
 * @access  Public (user-specific)
 */
router.post('/churn/predict', endpointLimits.api, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId'
      });
    }

    const churnPrediction = await revenueEngine.predictChurnProbability(userId);

    res.json({
      success: true,
      churnPrediction,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/churn/predict', body: req.body });
    res.status(500).json({
      error: 'Failed to predict churn',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/churn/prevent
 * @desc    Execute churn prevention intervention
 * @access  Public (user-specific)
 */
router.post('/churn/prevent', endpointLimits.api, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId'
      });
    }

    // First predict churn
    const churnPrediction = await revenueEngine.predictChurnProbability(userId);

    // Then execute prevention if needed
    if (churnPrediction.riskLevel !== 'low') {
      const intervention = await revenueEngine.preventChurn(userId, churnPrediction);

      res.json({
        success: true,
        churnRisk: churnPrediction.riskLevel,
        interventionExecuted: true,
        intervention,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        churnRisk: 'low',
        interventionExecuted: false,
        message: 'No intervention needed - user has low churn risk',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.logError(error, { endpoint: '/churn/prevent', body: req.body });
    res.status(500).json({
      error: 'Failed to execute churn prevention',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/ltv/optimize
 * @desc    Get LTV optimization strategy for user
 * @access  Public (user-specific)
 */
router.post('/ltv/optimize', endpointLimits.api, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId'
      });
    }

    const ltvStrategy = await revenueEngine.maximizeLifetimeValue(userId);

    res.json({
      success: true,
      ltvStrategy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/ltv/optimize', body: req.body });
    res.status(500).json({
      error: 'Failed to optimize LTV',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/revenue/forecast
 * @desc    Get revenue forecast (admin only)
 * @access  Admin
 */
router.get('/forecast', async (req, res) => {
  try {
    // Check admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        error: 'Unauthorized - Admin key required'
      });
    }

    const months = parseInt(req.query.months) || 12;

    if (months < 1 || months > 36) {
      return res.status(400).json({
        error: 'Invalid months parameter',
        validRange: '1-36'
      });
    }

    const forecast = await revenueEngine.forecastRevenue(months);

    res.json({
      success: true,
      forecast,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/forecast' });
    res.status(500).json({
      error: 'Failed to generate forecast',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/experiment/create
 * @desc    Create a pricing experiment (admin only)
 * @access  Admin
 */
router.post('/experiment/create', async (req, res) => {
  try {
    // Check admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        error: 'Unauthorized - Admin key required'
      });
    }

    const { tier, duration } = req.body;

    if (!tier) {
      return res.status(400).json({
        error: 'Missing tier parameter',
        validTiers: ['cosmic', 'universe']
      });
    }

    if (!['cosmic', 'universe'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        validTiers: ['cosmic', 'universe']
      });
    }

    const experiment = await revenueEngine.runPricingExperiment(tier, duration || 14);

    res.json({
      success: true,
      experiment,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/experiment/create', body: req.body });
    res.status(500).json({
      error: 'Failed to create experiment',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/revenue/experiment/:experimentId/results
 * @desc    Get experiment results (admin only)
 * @access  Admin
 */
router.get('/experiment/:experimentId/results', async (req, res) => {
  try {
    // Check admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        error: 'Unauthorized - Admin key required'
      });
    }

    const { experimentId } = req.params;

    if (!experimentId) {
      return res.status(400).json({
        error: 'Missing experimentId'
      });
    }

    const results = await revenueEngine.analyzeExperiment(parseInt(experimentId));

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/experiment/results', params: req.params });
    res.status(500).json({
      error: 'Failed to analyze experiment',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/revenue/experiment/price
 * @desc    Get experimental price for user (internal use)
 * @access  Public
 */
router.post('/experiment/price', endpointLimits.api, async (req, res) => {
  try {
    const { userId, tier } = req.body;

    if (!userId || !tier) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'tier']
      });
    }

    const experimentPrice = await revenueEngine.getExperimentPrice(userId, tier);

    res.json({
      success: true,
      pricing: experimentPrice,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logError(error, { endpoint: '/experiment/price', body: req.body });
    res.status(500).json({
      error: 'Failed to get experiment price',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/revenue/health
 * @desc    Health check for revenue optimization system
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      service: 'Revenue Optimization Engine',
      version: '1.0.0',
      features: [
        'Dynamic Pricing',
        'Churn Prediction',
        'Personalized Offers',
        'LTV Optimization',
        'Revenue Forecasting',
        'Pricing Experiments'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/revenue/docs
 * @desc    API documentation
 * @access  Public
 */
router.get('/docs', async (req, res) => {
  res.json({
    name: 'Revenue Optimization API',
    version: '1.0.0',
    description: 'AI-powered revenue optimization engine with dynamic pricing, churn prediction, and LTV maximization',
    endpoints: {
      pricing: {
        'POST /api/revenue/pricing/calculate': {
          description: 'Calculate optimal price for user and tier',
          body: { userId: 'string', tier: 'cosmic|universe' },
          response: 'Optimized pricing with factors and conversion predictions'
        },
        'POST /api/revenue/experiment/price': {
          description: 'Get price from active pricing experiment',
          body: { userId: 'string', tier: 'cosmic|universe' },
          response: 'Experimental price assignment'
        }
      },
      offers: {
        'POST /api/revenue/offers/generate': {
          description: 'Generate personalized upgrade offer',
          body: { userId: 'string' },
          response: 'Personalized offer with expected conversion rate'
        },
        'POST /api/revenue/discount/check': {
          description: 'Check discount eligibility',
          body: { userId: 'string' },
          response: 'Discount offer if eligible with reasoning'
        }
      },
      churn: {
        'POST /api/revenue/churn/predict': {
          description: 'Predict churn probability',
          body: { userId: 'string' },
          response: 'Churn prediction with risk level and reasons'
        },
        'POST /api/revenue/churn/prevent': {
          description: 'Execute churn prevention intervention',
          body: { userId: 'string' },
          response: 'Intervention details and actions taken'
        }
      },
      ltv: {
        'POST /api/revenue/ltv/optimize': {
          description: 'Get LTV optimization strategy',
          body: { userId: 'string' },
          response: 'Current/potential LTV with optimization strategy'
        }
      },
      analytics: {
        'GET /api/revenue/forecast?months=12': {
          description: 'Revenue forecast (admin only)',
          headers: { 'x-admin-key': 'required' },
          response: 'Conservative/realistic/optimistic scenarios'
        }
      },
      experiments: {
        'POST /api/revenue/experiment/create': {
          description: 'Create pricing experiment (admin only)',
          headers: { 'x-admin-key': 'required' },
          body: { tier: 'cosmic|universe', duration: 'number (days)' },
          response: 'Experiment configuration'
        },
        'GET /api/revenue/experiment/:id/results': {
          description: 'Get experiment results (admin only)',
          headers: { 'x-admin-key': 'required' },
          response: 'Variant performance and winner'
        }
      },
      system: {
        'GET /api/revenue/health': {
          description: 'Health check',
          response: 'System status and features'
        },
        'GET /api/revenue/docs': {
          description: 'API documentation',
          response: 'This documentation'
        }
      }
    },
    expectedImpact: {
      revenue: '+25-40% through pricing optimization',
      churn: '-30-50% through early intervention',
      ltv: '2-3x over 12 months',
      annualIncrease: '+$15,000-30,000'
    },
    features: [
      'Dynamic pricing with purchasing power parity',
      'Engagement-based pricing multipliers',
      'ML-powered churn prediction',
      'Automated churn prevention interventions',
      'Personalized upgrade offers',
      'Smart discount timing',
      'LTV optimization strategies',
      'Revenue forecasting with scenarios',
      'A/B pricing experiments'
    ],
    algorithms: {
      pricing: 'Multi-factor optimization (country PPP, engagement, usage, loyalty, demand, competition)',
      churn: 'Weighted feature model (recency, engagement trend, usage drop, support tickets, payments)',
      ltv: 'Behavioral segmentation with targeted strategies',
      forecasting: 'Monte Carlo simulation with growth/churn/conversion scenarios'
    }
  });
});

module.exports = router;
