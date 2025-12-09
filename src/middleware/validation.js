const validator = require('validator');
const { body, param, query, validationResult } = require('express-validator');

// Horoscope request validation
const validateHoroscopeRequest = [
  param('sign').isIn([
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
  ]).withMessage('Invalid zodiac sign'),
  query('date').optional().isISO8601().withMessage('Invalid date format'),
];

// Chat message validation
const validateChatMessage = [
  body('message').isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
  body('sessionId').isUUID().withMessage('Invalid session ID'),
  body('languageCode').isIn(['en', 'es', 'fr', 'de', 'it', 'pt']).withMessage('Unsupported language'),
];

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs
  for (const key in req.body) {
    if (typeof req.body[key] === 'string') {
      req.body[key] = validator.escape(req.body[key]);
    }
  }
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = validator.escape(req.query[key]);
    }
  }
  next();
};

// Error handling for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = {
  validateHoroscopeRequest,
  validateChatMessage,
  sanitizeInput,
  handleValidationErrors
};