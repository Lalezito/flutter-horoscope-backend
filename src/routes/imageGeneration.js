/**
 * IMAGE GENERATION API ROUTES
 *
 * Endpoints for DALL-E 3 powered cosmic visualizations
 * - Daily energy images
 * - Zodiac avatars
 * - Compatibility visualizations
 * - Moon ritual guides
 * - Shareable social cards
 */

const express = require('express');
const router = express.Router();
const imageGenerationService = require('../services/imageGenerationService');
const shareableCardService = require('../services/shareableCardService');
const imageGenerationCronJob = require('../services/imageGenerationCronJob');
const authMiddleware = require('../middleware/authMiddleware');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

/**
 * RATE LIMITING
 */
const generateImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 generations per 15 minutes (free tier protection)
  message: 'Too many image generation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 downloads per 5 minutes
  message: 'Too many download requests, please try again later'
});

/**
 * VALIDATION MIDDLEWARE
 */
const validateErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * POST /api/images/generate/daily-energy
 * Generate daily energy visualization
 */
router.post(
  '/generate/daily-energy',
  authMiddleware,
  generateImageLimiter,
  [
    body('sign').isString().trim().notEmpty().withMessage('Zodiac sign is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('energyLevel').isInt({ min: 1, max: 10 }).withMessage('Energy level must be 1-10'),
    body('mood').optional().isString().trim(),
    body('focus').optional().isString().trim(),
    body('personalized').optional().isBoolean()
  ],
  validateErrors,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const { sign, date, energyLevel, mood, focus, personalized } = req.body;

      const horoscopeData = {
        sign,
        date,
        energyLevel,
        mood,
        focus
      };

      const result = await imageGenerationService.generateDailyEnergyImage(
        userId,
        horoscopeData,
        { personalized: personalized || false }
      );

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            imageUrl: result.imageUrl,
            imageId: result.imageId,
            description: result.description,
            shareableCard: result.shareableCard,
            cached: result.cached || false
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          fallback: result.fallback
        });
      }

    } catch (error) {
      console.error('Daily energy generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Image generation failed'
      });
    }
  }
);

/**
 * POST /api/images/generate/avatar
 * Generate personalized zodiac avatar
 */
router.post(
  '/generate/avatar',
  authMiddleware,
  generateImageLimiter,
  [
    body('sunSign').isString().trim().notEmpty().withMessage('Sun sign is required'),
    body('moonSign').isString().trim().notEmpty().withMessage('Moon sign is required'),
    body('risingSign').isString().trim().notEmpty().withMessage('Rising sign is required'),
    body('traits').optional().isArray().withMessage('Traits must be an array'),
    body('version').optional().isInt({ min: 1 })
  ],
  validateErrors,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const userProfile = req.body;

      const result = await imageGenerationService.generateZodiacAvatar(userId, userProfile);

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            imageUrl: result.imageUrl,
            imageId: result.imageId,
            description: result.description,
            cached: result.cached || false
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Avatar generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Avatar generation failed'
      });
    }
  }
);

/**
 * POST /api/images/generate/compatibility
 * Generate compatibility visualization
 */
router.post(
  '/generate/compatibility',
  authMiddleware,
  generateImageLimiter,
  [
    body('user1').isObject().withMessage('User 1 data is required'),
    body('user1.sign').isString().trim().notEmpty(),
    body('user1.element').isString().trim().notEmpty(),
    body('user2').isObject().withMessage('User 2 data is required'),
    body('user2.sign').isString().trim().notEmpty(),
    body('user2.element').isString().trim().notEmpty(),
    body('compatibilityScore').isInt({ min: 0, max: 100 }).withMessage('Score must be 0-100')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const { user1, user2, compatibilityScore } = req.body;

      const result = await imageGenerationService.generateCompatibilityArt(
        userId,
        user1,
        user2,
        compatibilityScore
      );

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            imageUrl: result.imageUrl,
            imageId: result.imageId,
            description: result.description,
            shareableCard: result.shareableCard,
            cached: result.cached || false
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Compatibility art generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Compatibility art generation failed'
      });
    }
  }
);

/**
 * POST /api/images/generate/moon-ritual
 * Generate moon ritual guide image
 */
router.post(
  '/generate/moon-ritual',
  authMiddleware,
  generateImageLimiter,
  [
    body('moonPhase').isString().trim().notEmpty().withMessage('Moon phase is required'),
    body('intention').isString().trim().notEmpty().withMessage('Intention is required'),
    body('userSign').isString().trim().notEmpty().withMessage('Zodiac sign is required')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const { moonPhase, intention, userSign } = req.body;

      const result = await imageGenerationService.generateMoonRitualImage(
        userId,
        moonPhase,
        intention,
        userSign
      );

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            imageUrl: result.imageUrl,
            imageId: result.imageId,
            description: result.description,
            cached: result.cached || false
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Moon ritual image generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Moon ritual image generation failed'
      });
    }
  }
);

/**
 * GET /api/images/my-gallery
 * Get user's generated images
 */
router.get(
  '/my-gallery',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const images = await imageGenerationService.getUserImages(userId, limit, offset);

      return res.status(200).json({
        success: true,
        data: {
          images,
          count: images.length,
          limit,
          offset
        }
      });

    } catch (error) {
      console.error('Gallery fetch error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch gallery'
      });
    }
  }
);

/**
 * GET /api/images/:imageId
 * Get specific image details
 */
router.get(
  '/:imageId',
  authMiddleware,
  [
    param('imageId').isUUID().withMessage('Valid image ID is required')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { imageId } = req.params;
      const image = await imageGenerationService.getImageById(imageId);

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: image
      });

    } catch (error) {
      console.error('Image fetch error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch image'
      });
    }
  }
);

/**
 * POST /api/images/share/:imageId
 * Generate shareable social media card
 */
router.post(
  '/share/:imageId',
  authMiddleware,
  downloadLimiter,
  [
    param('imageId').isUUID().withMessage('Valid image ID is required'),
    body('format').optional().isIn(['instagram_square', 'instagram_story', 'twitter', 'facebook'])
      .withMessage('Invalid format')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { imageId } = req.params;
      const format = req.body.format || 'instagram_square';

      const card = await shareableCardService.createShareableCard(imageId, format);

      if (card.success) {
        res.set({
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="cosmic-coach-${format}.png"`
        });
        return res.send(card.buffer);
      } else {
        return res.status(400).json({
          success: false,
          error: card.error
        });
      }

    } catch (error) {
      console.error('Shareable card generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Card generation failed'
      });
    }
  }
);

/**
 * POST /api/images/share/:imageId/all-formats
 * Generate all social media formats at once
 */
router.post(
  '/share/:imageId/all-formats',
  authMiddleware,
  downloadLimiter,
  [
    param('imageId').isUUID().withMessage('Valid image ID is required')
  ],
  validateErrors,
  async (req, res) => {
    try {
      const { imageId } = req.params;

      const cards = await shareableCardService.createAllFormats(imageId);

      if (cards.success) {
        // Return download links for all formats
        const formats = Object.keys(cards.formats);
        return res.status(200).json({
          success: true,
          data: {
            formats: formats.map(format => ({
              format,
              downloadUrl: `${req.protocol}://${req.get('host')}/api/images/share/${imageId}?format=${format}`
            }))
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: cards.error
        });
      }

    } catch (error) {
      console.error('Multi-format card generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Card generation failed'
      });
    }
  }
);

/**
 * GET /api/images/usage/stats
 * Get user's usage statistics
 */
router.get(
  '/usage/stats',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.uid;

      const tier = await imageGenerationService.getUserTier(userId);
      const weeklyUsage = await imageGenerationService.getWeeklyUsage(userId);
      const limits = imageGenerationService.tierLimits[tier];

      return res.status(200).json({
        success: true,
        data: {
          tier,
          weeklyUsage,
          weeklyLimit: limits.generations,
          remaining: limits.generations === -1 ? 'unlimited' : Math.max(0, limits.generations - weeklyUsage),
          quality: limits.quality
        }
      });

    } catch (error) {
      console.error('Usage stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch usage stats'
      });
    }
  }
);

/**
 * ADMIN ROUTES
 */

/**
 * POST /api/images/admin/batch-generate
 * Manually trigger batch generation (admin only)
 */
router.post(
  '/admin/batch-generate',
  authMiddleware,
  async (req, res) => {
    try {
      // Check admin permission
      if (!req.user.admin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const result = await imageGenerationCronJob.triggerManualBatchGeneration();

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Batch generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Batch generation failed'
      });
    }
  }
);

/**
 * GET /api/images/admin/cost-report
 * Get cost analytics (admin only)
 */
router.get(
  '/admin/cost-report',
  authMiddleware,
  [
    query('days').optional().isInt({ min: 1, max: 90 }).withMessage('Days must be 1-90')
  ],
  validateErrors,
  async (req, res) => {
    try {
      // Check admin permission
      if (!req.user.admin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const days = parseInt(req.query.days) || 7;
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const costData = await imageGenerationService.getTotalCost(startDate, endDate);
      const stats = await imageGenerationService.getGenerationStats(startDate, endDate);
      const cacheStats = await imageGenerationService.getCacheHitRate(days);

      return res.status(200).json({
        success: true,
        data: {
          period: { start: startDate, end: endDate, days },
          totalImages: costData.totalImages,
          totalCost: costData.totalCost,
          avgCostPerImage: costData.totalImages > 0 ? costData.totalCost / costData.totalImages : 0,
          breakdown: stats,
          cacheStats,
          estimatedMonthlyCost: (costData.totalCost / days) * 30
        }
      });

    } catch (error) {
      console.error('Cost report error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate cost report'
      });
    }
  }
);

/**
 * GET /api/images/admin/cron-status
 * Get cron job status (admin only)
 */
router.get(
  '/admin/cron-status',
  authMiddleware,
  async (req, res) => {
    try {
      // Check admin permission
      if (!req.user.admin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const status = imageGenerationCronJob.getStatus();

      return res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Cron status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch cron status'
      });
    }
  }
);

module.exports = router;
