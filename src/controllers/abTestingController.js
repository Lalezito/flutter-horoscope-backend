/**
 * A/B Testing Controller
 * Handles all A/B testing API endpoints
 */

const abTestingService = require('../services/abTestingService');
const { loggingService } = require('../services/loggingService');

class ABTestingController {
  /**
   * Create a new A/B test
   * POST /api/ab-testing/tests
   */
  async createTest(req, res) {
    try {
      const test = await abTestingService.createTest(req.body);

      res.status(201).json({
        success: true,
        message: 'A/B test created successfully',
        data: test
      });
    } catch (error) {
      loggingService.log('error', `Error creating A/B test: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all active tests
   * GET /api/ab-testing/tests
   */
  async getActiveTests(req, res) {
    try {
      const tests = await abTestingService.getActiveTests();

      res.json({
        success: true,
        data: tests
      });
    } catch (error) {
      loggingService.log('error', `Error getting active tests: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get test results
   * GET /api/ab-testing/tests/:testId/results
   */
  async getTestResults(req, res) {
    try {
      const { testId } = req.params;
      const results = await abTestingService.getTestResults(testId);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      loggingService.log('error', `Error getting test results: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Assign user to variant
   * POST /api/ab-testing/assign
   */
  async assignVariant(req, res) {
    try {
      const { userId, testId } = req.body;

      if (!userId || !testId) {
        return res.status(400).json({
          success: false,
          error: 'userId and testId are required'
        });
      }

      const assignment = await abTestingService.assignUserToVariant(userId, testId);

      if (!assignment) {
        return res.json({
          success: true,
          data: null,
          message: 'User not eligible for this test'
        });
      }

      res.json({
        success: true,
        data: assignment
      });
    } catch (error) {
      loggingService.log('error', `Error assigning variant: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Track event
   * POST /api/ab-testing/track
   */
  async trackEvent(req, res) {
    try {
      const { userId, testId, eventType, eventData } = req.body;

      if (!userId || !testId || !eventType) {
        return res.status(400).json({
          success: false,
          error: 'userId, testId, and eventType are required'
        });
      }

      await abTestingService.trackEvent(userId, testId, eventType, eventData);

      res.json({
        success: true,
        message: 'Event tracked successfully'
      });
    } catch (error) {
      loggingService.log('error', `Error tracking event: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get variant configuration for user
   * GET /api/ab-testing/config/:userId/:testId
   */
  async getVariantConfig(req, res) {
    try {
      const { userId, testId } = req.params;

      const config = await abTestingService.getVariantConfig(userId, testId);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      loggingService.log('error', `Error getting variant config: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all tests for a user
   * GET /api/ab-testing/user/:userId
   */
  async getUserTests(req, res) {
    try {
      const { userId } = req.params;

      const tests = await abTestingService.getUserTests(userId);

      res.json({
        success: true,
        data: tests
      });
    } catch (error) {
      loggingService.log('error', `Error getting user tests: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Pause a test
   * POST /api/ab-testing/tests/:testId/pause
   */
  async pauseTest(req, res) {
    try {
      const { testId } = req.params;

      await abTestingService.pauseTest(testId);

      res.json({
        success: true,
        message: 'Test paused successfully'
      });
    } catch (error) {
      loggingService.log('error', `Error pausing test: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Resume a test
   * POST /api/ab-testing/tests/:testId/resume
   */
  async resumeTest(req, res) {
    try {
      const { testId } = req.params;

      await abTestingService.resumeTest(testId);

      res.json({
        success: true,
        message: 'Test resumed successfully'
      });
    } catch (error) {
      loggingService.log('error', `Error resuming test: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Archive a test
   * POST /api/ab-testing/tests/:testId/archive
   */
  async archiveTest(req, res) {
    try {
      const { testId } = req.params;

      await abTestingService.archiveTest(testId);

      res.json({
        success: true,
        message: 'Test archived successfully'
      });
    } catch (error) {
      loggingService.log('error', `Error archiving test: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check for winner and potentially auto-rollout
   * POST /api/ab-testing/tests/:testId/check-winner
   */
  async checkForWinner(req, res) {
    try {
      const { testId } = req.params;

      const result = await abTestingService.checkForWinner(testId);

      if (result) {
        res.json({
          success: true,
          message: 'Winner declared and rolled out',
          data: result
        });
      } else {
        res.json({
          success: true,
          message: 'No winner declared yet',
          data: null
        });
      }
    } catch (error) {
      loggingService.log('error', `Error checking for winner: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Declare winner manually
   * POST /api/ab-testing/tests/:testId/declare-winner
   */
  async declareWinner(req, res) {
    try {
      const { testId } = req.params;
      const { winnerId } = req.body;

      if (!winnerId) {
        return res.status(400).json({
          success: false,
          error: 'winnerId is required'
        });
      }

      await abTestingService.declareWinner(testId, winnerId);
      await abTestingService.rolloutWinner(testId, winnerId);

      res.json({
        success: true,
        message: 'Winner declared and rolled out successfully'
      });
    } catch (error) {
      loggingService.log('error', `Error declaring winner: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ABTestingController();
