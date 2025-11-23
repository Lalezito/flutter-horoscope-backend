/**
 * Voice AI Routes
 *
 * API endpoints for voice generation, playlists, and audio management
 */

const express = require('express');
const router = express.Router();
const voiceAIController = require('../controllers/voiceAIController');
const { body, param } = require('express-validator');

// Middleware for request validation
const validateRequest = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * POST /api/voice/generate
 * Generate voice response for text
 *
 * Body:
 * - text: string (required, max 4000 chars)
 * - voice: string (optional, default: cosmic_guide)
 * - contentType: string (optional, default: personalized)
 * - userId: string (optional, for anonymous users)
 */
router.post(
  '/generate',
  [
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Text is required')
      .isLength({ max: 4000 })
      .withMessage('Text must not exceed 4000 characters'),
    body('voice')
      .optional()
      .isIn([
        'cosmic_guide',
        'energetic_coach',
        'gentle_healer',
        'wise_elder',
        'mystical_oracle',
        'divine_messenger'
      ])
      .withMessage('Invalid voice personality'),
    body('contentType')
      .optional()
      .isIn(['personalized', 'horoscope', 'meditation', 'affirmation'])
      .withMessage('Invalid content type')
  ],
  validateRequest,
  voiceAIController.generateVoice.bind(voiceAIController)
);

/**
 * POST /api/voice/playlist
 * Generate daily audio playlist
 *
 * Body:
 * - userProfile: object (required) - { sign, voice, name }
 * - content: object (optional) - { dailyHoroscope, tomorrowHoroscope, moonPhase }
 * - userId: string (optional, for anonymous users)
 */
router.post(
  '/playlist',
  [
    body('userProfile.sign')
      .notEmpty()
      .withMessage('Zodiac sign is required')
      .isIn([
        'aries', 'taurus', 'gemini', 'cancer',
        'leo', 'virgo', 'libra', 'scorpio',
        'sagittarius', 'capricorn', 'aquarius', 'pisces'
      ])
      .withMessage('Invalid zodiac sign'),
    body('userProfile.voice')
      .optional()
      .isString(),
    body('userProfile.name')
      .optional()
      .isString()
  ],
  validateRequest,
  voiceAIController.generatePlaylist.bind(voiceAIController)
);

/**
 * POST /api/voice/affirmations
 * Generate affirmations audio
 *
 * Body:
 * - sign: string (required)
 * - count: number (optional, default: 5)
 * - voice: string (optional, default: cosmic_guide)
 * - userId: string (optional)
 */
router.post(
  '/affirmations',
  [
    body('sign')
      .notEmpty()
      .withMessage('Zodiac sign is required')
      .isIn([
        'aries', 'taurus', 'gemini', 'cancer',
        'leo', 'virgo', 'libra', 'scorpio',
        'sagittarius', 'capricorn', 'aquarius', 'pisces'
      ])
      .withMessage('Invalid zodiac sign'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Count must be between 1 and 10'),
    body('voice')
      .optional()
      .isString()
  ],
  validateRequest,
  voiceAIController.generateAffirmations.bind(voiceAIController)
);

/**
 * GET /api/voice/personalities
 * Get available voice personalities
 */
router.get(
  '/personalities',
  voiceAIController.getVoicePersonalities.bind(voiceAIController)
);

/**
 * GET /api/voice/stats/:userId?
 * Get user's voice usage statistics
 */
router.get(
  '/stats/:userId?',
  voiceAIController.getUserStats.bind(voiceAIController)
);

/**
 * GET /api/voice/audio/:fileName
 * Stream audio file
 */
router.get(
  '/audio/:fileName',
  [
    param('fileName')
      .matches(/^[\w-]+\.mp3$/)
      .withMessage('Invalid file name')
  ],
  validateRequest,
  voiceAIController.streamAudio.bind(voiceAIController)
);

/**
 * GET /api/voice/download/:fileName
 * Download audio file (Universe tier only)
 */
router.get(
  '/download/:fileName',
  [
    param('fileName')
      .matches(/^[\w-]+\.mp3$/)
      .withMessage('Invalid file name')
  ],
  validateRequest,
  voiceAIController.downloadAudio.bind(voiceAIController)
);

/**
 * GET /api/voice/metrics
 * Get cost metrics (admin only)
 */
router.get(
  '/metrics',
  voiceAIController.getCostMetrics.bind(voiceAIController)
);

module.exports = router;
