/**
 * A/B Testing Routes
 * All endpoints for managing A/B tests and tracking experiments
 */

const express = require('express');
const router = express.Router();
const abTestingController = require('../controllers/abTestingController');
const { authenticateToken } = require('../middleware/auth');

// Admin routes (require authentication)
router.post('/tests', authenticateToken, abTestingController.createTest);
router.get('/tests', authenticateToken, abTestingController.getActiveTests);
router.get('/tests/:testId/results', authenticateToken, abTestingController.getTestResults);
router.post('/tests/:testId/pause', authenticateToken, abTestingController.pauseTest);
router.post('/tests/:testId/resume', authenticateToken, abTestingController.resumeTest);
router.post('/tests/:testId/archive', authenticateToken, abTestingController.archiveTest);
router.post('/tests/:testId/check-winner', authenticateToken, abTestingController.checkForWinner);
router.post('/tests/:testId/declare-winner', authenticateToken, abTestingController.declareWinner);

// Public routes (for client apps)
router.post('/assign', abTestingController.assignVariant);
router.post('/track', abTestingController.trackEvent);
router.get('/config/:userId/:testId', abTestingController.getVariantConfig);
router.get('/user/:userId', abTestingController.getUserTests);

module.exports = router;
