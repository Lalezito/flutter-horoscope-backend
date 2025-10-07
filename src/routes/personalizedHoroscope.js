const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const PersonalizedHoroscopeAPI = require('../services/personalizedHoroscopeAPI');
const logger = require('../utils/logger');

const router = express.Router();
const personalizedHoroscopeAPI = new PersonalizedHoroscopeAPI();

// Rate limiting for personalized horoscope endpoints
const personalizedHoroscopeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 requests per windowMs for personalized horoscopes
  message: {
    error: 'Too many personalized horoscope requests',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const premiumHoroscopeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 20, // Higher limit for premium users
  message: {
    error: 'Too many premium horoscope requests',
    retryAfter: '15 minutes'
  },
});

// Validation middleware
const validateBirthData = [
  body('birthDate').isISO8601().withMessage('Invalid birth date format'),
  body('birthTime.hour').optional().isInt({ min: 0, max: 23 }).withMessage('Invalid hour'),
  body('birthTime.minute').optional().isInt({ min: 0, max: 59 }).withMessage('Invalid minute'),
  body('birthLocation.latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('birthLocation.longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('birthLocation.city').optional().isString().withMessage('City must be a string'),
  body('language').optional().isIn(['en', 'es']).withMessage('Language must be en or es'),
  body('personalizationLevel').optional().isIn(['basic', 'advanced', 'premium']).withMessage('Invalid personalization level'),
];

const validateHoroscopeRequest = [
  body('targetDate').isISO8601().withMessage('Invalid target date format'),
  body('includeTransitAnalysis').optional().isBoolean().withMessage('includeTransitAnalysis must be boolean'),
  body('includeQualityReport').optional().isBoolean().withMessage('includeQualityReport must be boolean'),
  body('userPreferences').optional().isObject().withMessage('userPreferences must be an object'),
];

/**
 * POST /api/personalized-horoscope/generate
 * Generate a personalized daily horoscope using birth chart data
 */
router.post('/generate', 
  personalizedHoroscopeLimit,
  [...validateBirthData, ...validateHoroscopeRequest],
  async (req, res) => {
    try {
      // Validate request data
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        birthDate,
        birthTime = { hour: 12, minute: 0 },
        birthLocation,
        targetDate,
        language = 'en',
        personalizationLevel = 'advanced',
        userPreferences = {},
        includeTransitAnalysis = true,
        includeQualityReport = false,
      } = req.body;

      logger.info('Generating personalized horoscope', {
        birthDate,
        targetDate,
        language,
        personalizationLevel,
        userId: req.user?.id,
      });

      // Generate personalized horoscope
      const result = await personalizedHoroscopeAPI.generatePersonalizedHoroscope({
        birthDate,
        birthTime,
        birthLocation,
        targetDate,
        language,
        personalizationLevel,
        userPreferences,
        includeTransitAnalysis,
        includeQualityReport,
      });

      // Log successful generation
      logger.info('Personalized horoscope generated successfully', {
        responseTime: result.metadata.responseTimeMs,
        qualityScore: result.qualityReport?.overallScore,
        cacheHit: result.metadata.cacheHit,
      });

      res.json({
        success: true,
        data: result,
        message: 'Personalized horoscope generated successfully'
      });

    } catch (error) {
      logger.error('Failed to generate personalized horoscope', {
        error: error.message,
        stack: error.stack,
        requestBody: req.body,
      });

      res.status(500).json({
        error: 'Failed to generate personalized horoscope',
        message: error.message,
        requestId: req.id,
      });
    }
  }
);

/**
 * POST /api/personalized-horoscope/premium
 * Generate premium personalized horoscope with advanced features
 */
router.post('/premium',
  premiumHoroscopeLimit,
  [...validateBirthData, ...validateHoroscopeRequest],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const requestData = {
        ...req.body,
        personalizationLevel: 'premium',
        includeTransitAnalysis: true,
        includeQualityReport: true,
      };

      logger.info('Generating premium personalized horoscope', {
        birthDate: req.body.birthDate,
        targetDate: req.body.targetDate,
        userId: req.user?.id,
      });

      const result = await personalizedHoroscopeAPI.generatePersonalizedHoroscope(requestData);

      res.json({
        success: true,
        data: result,
        message: 'Premium personalized horoscope generated successfully'
      });

    } catch (error) {
      logger.error('Failed to generate premium horoscope', error);
      res.status(500).json({
        error: 'Failed to generate premium horoscope',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/personalized-horoscope/birth-chart
 * Calculate detailed birth chart
 */
router.post('/birth-chart',
  personalizedHoroscopeLimit,
  validateBirthData,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { birthDate, birthTime, birthLocation } = req.body;

      logger.info('Calculating birth chart', { birthDate, birthLocation });

      const birthChart = await personalizedHoroscopeAPI.getOrCalculateBirthChart({
        birthDate,
        birthTime,
        birthLocation,
      });

      res.json({
        success: true,
        data: {
          birthChart: personalizedHoroscopeAPI.serializeBirthChart(birthChart),
          calculatedAt: new Date().toISOString(),
        },
        message: 'Birth chart calculated successfully'
      });

    } catch (error) {
      logger.error('Failed to calculate birth chart', error);
      res.status(500).json({
        error: 'Failed to calculate birth chart',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/personalized-horoscope/transits
 * Calculate current transits for a birth chart
 */
router.post('/transits',
  personalizedHoroscopeLimit,
  [
    ...validateBirthData,
    body('targetDate').isISO8601().withMessage('Invalid target date format'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { birthDate, birthTime, birthLocation, targetDate } = req.body;

      // First get the birth chart
      const birthChart = await personalizedHoroscopeAPI.getOrCalculateBirthChart({
        birthDate,
        birthTime,
        birthLocation,
      });

      // Then calculate transits
      const transits = await personalizedHoroscopeAPI.calculateCurrentTransits(
        birthChart,
        targetDate
      );

      res.json({
        success: true,
        data: {
          transits,
          targetDate,
          calculatedAt: new Date().toISOString(),
        },
        message: 'Transits calculated successfully'
      });

    } catch (error) {
      logger.error('Failed to calculate transits', error);
      res.status(500).json({
        error: 'Failed to calculate transits',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/personalized-horoscope/validate-quality
 * Validate the quality of generated horoscope content
 */
router.post('/validate-quality',
  personalizedHoroscopeLimit,
  [
    body('content').isString().isLength({ min: 100 }).withMessage('Content must be at least 100 characters'),
    body('birthChart').isObject().withMessage('Birth chart data required'),
    body('transits').isArray().withMessage('Transits must be an array'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { content, birthChart, transits } = req.body;

      const personalizedHoroscope = {
        content,
        qualityMetrics: personalizedHoroscopeAPI.calculateQualityMetrics(
          content,
          birthChart,
          transits,
          'advanced'
        ),
      };

      const qualityReport = await personalizedHoroscopeAPI.validateContentQuality(
        personalizedHoroscope,
        birthChart,
        transits
      );

      res.json({
        success: true,
        data: qualityReport,
        message: 'Content quality validated successfully'
      });

    } catch (error) {
      logger.error('Failed to validate content quality', error);
      res.status(500).json({
        error: 'Failed to validate content quality',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/personalized-horoscope/metrics
 * Get system metrics and performance data
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = personalizedHoroscopeAPI.getMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to retrieve metrics', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message,
    });
  }
});

/**
 * POST /api/personalized-horoscope/clear-cache
 * Clear system caches (admin only)
 */
router.post('/clear-cache', async (req, res) => {
  try {
    // In production, add authentication middleware to verify admin access
    personalizedHoroscopeAPI.clearCaches();

    res.json({
      success: true,
      message: 'Caches cleared successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to clear cache', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message,
    });
  }
});

/**
 * POST /api/personalized-horoscope/batch
 * Generate multiple personalized horoscopes in batch (premium feature)
 */
router.post('/batch',
  premiumHoroscopeLimit,
  [
    body('requests').isArray({ min: 1, max: 7 }).withMessage('Requests must be array of 1-7 items'),
    body('requests.*.birthDate').isISO8601().withMessage('Invalid birth date format'),
    body('requests.*.targetDate').isISO8601().withMessage('Invalid target date format'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { requests } = req.body;

      logger.info(`Processing batch request for ${requests.length} horoscopes`);

      const results = [];
      const errors = [];

      // Process requests in parallel (with concurrency limit)
      const batchPromises = requests.map(async (request, index) => {
        try {
          const result = await personalizedHoroscopeAPI.generatePersonalizedHoroscope({
            ...request,
            personalizationLevel: 'premium',
            includeQualityReport: false, // Skip quality reports for batch to improve performance
          });
          
          return { index, result };
        } catch (error) {
          logger.error(`Batch request ${index} failed`, error);
          return { index, error: error.message };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            errors.push({ index, error: result.value.error });
          } else {
            results.push(result.value.result);
          }
        } else {
          errors.push({ index, error: result.reason.message });
        }
      });

      res.json({
        success: true,
        data: {
          results,
          errors,
          totalRequested: requests.length,
          successful: results.length,
          failed: errors.length,
        },
        message: `Batch processing completed: ${results.length}/${requests.length} successful`
      });

    } catch (error) {
      logger.error('Batch processing failed', error);
      res.status(500).json({
        error: 'Batch processing failed',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/personalized-horoscope/demo
 * Generate a demo personalized horoscope with sample data
 */
router.get('/demo', async (req, res) => {
  try {
    const { language = 'en' } = req.query;

    // Sample birth data
    const sampleData = {
      birthDate: '1990-06-15',
      birthTime: { hour: 14, minute: 30 },
      birthLocation: {
        latitude: 40.7128,
        longitude: -74.0060,
        city: 'New York',
      },
      targetDate: new Date().toISOString().split('T')[0],
      language,
      personalizationLevel: 'advanced',
      includeTransitAnalysis: true,
      includeQualityReport: true,
    };

    const result = await personalizedHoroscopeAPI.generatePersonalizedHoroscope(sampleData);

    res.json({
      success: true,
      data: {
        ...result,
        note: 'This is a demo horoscope generated with sample birth data',
        sampleData,
      },
      message: 'Demo personalized horoscope generated successfully'
    });

  } catch (error) {
    logger.error('Failed to generate demo horoscope', error);
    res.status(500).json({
      error: 'Failed to generate demo horoscope',
      message: error.message,
    });
  }
});

// Error handling middleware specific to personalized horoscope routes
router.use((error, req, res, next) => {
  logger.error('Personalized horoscope route error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
    });
  }

  if (error.name === 'BirthChartCalculationError') {
    return res.status(422).json({
      error: 'Birth Chart Calculation Error',
      message: 'Unable to calculate birth chart with provided data',
    });
  }

  if (error.name === 'TransitAnalysisError') {
    return res.status(422).json({
      error: 'Transit Analysis Error',
      message: 'Unable to analyze current transits',
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred while processing your request',
    requestId: req.id,
  });
});

module.exports = router;