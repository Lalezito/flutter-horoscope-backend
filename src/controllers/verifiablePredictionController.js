/**
 * 🔮 VERIFIABLE PREDICTION CONTROLLER
 * 
 * Controller for handling verifiable prediction API endpoints
 * Interfaces with VerifiablePredictionService and manages HTTP responses
 */

const verifiablePredictionService = require('../services/verifiablePredictionService');
const logger = require('../services/loggingService');
const { validatePremiumAccess } = require('../middleware/premiumValidation');

class VerifiablePredictionController {
  
  /**
   * 🎯 GENERATE VERIFIABLE PREDICTIONS
   * POST /api/verifiable-predictions/generate
   */
  async generatePredictions(req, res) {
    const startTime = Date.now();

    try {
      const userId = req.user.id;
      const options = {
        birthData: req.body.birthData,
        preferredAreas: req.body.preferredAreas || [],
        language: req.body.language || 'en',
        preferences: req.body.preferences || {},
        specificityLevel: req.body.specificityLevel || 'high',
        maxPredictions: req.body.maxPredictions || 4
      };

      logger.getLogger().info('Generating verifiable predictions', { userId, options });

      // Premium validation (if required)
      // const premiumCheck = await validatePremiumAccess(userId, req.body.receiptData);
      // if (!premiumCheck.hasAccess) {
      //   return res.status(403).json({
      //     success: false,
      //     error: 'premium_required',
      //     message: 'Verifiable predictions require premium subscription'
      //   });
      // }

      const result = await verifiablePredictionService.generateVerifiablePredictions(userId, options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
          responseTime: Date.now() - startTime
        });
      }

      res.json({
        success: true,
        data: {
          predictions: result.predictions,
          astrologyContext: result.astrologyContext,
          metadata: result.metadata
        },
        responseTime: Date.now() - startTime
      });

    } catch (error) {
      logger.logError(error, { context: 'generate_predictions_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'generation_failed',
        message: 'Failed to generate verifiable predictions',
        responseTime: Date.now() - startTime
      });
    }
  }

  /**
   * 📋 GET USER PREDICTIONS
   * GET /api/verifiable-predictions
   */
  async getUserPredictions(req, res) {
    try {
      const userId = req.user.id;
      const options = {
        status: req.query.status || 'active',
        category: req.query.category,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy || 'created_at',
        sortOrder: req.query.sortOrder || 'desc',
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      };

      const result = await verifiablePredictionService.getUserPredictions(userId, options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.predictions,
        pagination: result.pagination,
        summary: result.summary
      });

    } catch (error) {
      logger.logError(error, { context: 'get_user_predictions_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'fetch_failed',
        message: 'Failed to retrieve predictions'
      });
    }
  }

  /**
   * 🔍 GET SINGLE PREDICTION
   * GET /api/verifiable-predictions/:predictionId
   */
  async getSinglePrediction(req, res) {
    try {
      const userId = req.user.id;
      const predictionId = req.params.predictionId;

      const result = await verifiablePredictionService.getSinglePrediction(predictionId, userId);

      if (!result.success) {
        const statusCode = result.error === 'prediction_not_found' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.prediction
      });

    } catch (error) {
      logger.logError(error, { context: 'get_single_prediction_controller', userId: req.user?.id, predictionId: req.params.predictionId });

      res.status(500).json({
        success: false,
        error: 'fetch_failed',
        message: 'Failed to retrieve prediction'
      });
    }
  }

  /**
   * ✅ UPDATE PREDICTION OUTCOME
   * PUT /api/verifiable-predictions/:predictionId/outcome
   */
  async updatePredictionOutcome(req, res) {
    try {
      const userId = req.user.id;
      const predictionId = req.params.predictionId;
      const outcome = req.body.outcome;
      const feedback = {
        userFeedback: req.body.userFeedback,
        details: req.body.details,
        rating: req.body.rating,
        wasHelpful: req.body.wasHelpful
      };

      const result = await verifiablePredictionService.updatePredictionOutcome(
        predictionId, 
        userId, 
        outcome, 
        feedback
      );

      if (!result.success) {
        const statusCode = result.error === 'prediction_not_found' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: {
          prediction: result.prediction,
          accuracyScore: result.accuracyScore,
          learningUpdate: result.learningUpdate
        },
        message: 'Prediction outcome updated successfully'
      });

    } catch (error) {
      logger.logError(error, { 
        context: 'update_prediction_outcome_controller', 
        userId: req.user?.id, 
        predictionId: req.params.predictionId 
      });

      res.status(500).json({
        success: false,
        error: 'update_failed',
        message: 'Failed to update prediction outcome'
      });
    }
  }

  /**
   * 📊 GET PREDICTION ANALYTICS
   * GET /api/verifiable-predictions/analytics/summary
   */
  async getPredictionAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const options = {
        timeframe: req.query.timeframe || '30 days',
        category: req.query.category,
        includeComparison: req.query.includeComparison === 'true',
        includeRecommendations: req.query.includeRecommendations === 'true'
      };

      const result = await verifiablePredictionService.getPredictionAnalytics(userId, options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: {
          analytics: result.analytics,
          summary: result.summary,
          comparison: result.comparison,
          recommendations: result.recommendations,
          timeframe: result.timeframe
        }
      });

    } catch (error) {
      logger.logError(error, { context: 'get_prediction_analytics_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'analytics_failed',
        message: 'Failed to retrieve prediction analytics'
      });
    }
  }

  /**
   * 📈 GET ACCURACY TRENDS
   * GET /api/verifiable-predictions/analytics/trends
   */
  async getAccuracyTrends(req, res) {
    try {
      const userId = req.user.id;
      const options = {
        category: req.query.category,
        period: req.query.period || 'weekly',
        daysBack: parseInt(req.query.daysBack) || 30
      };

      const result = await verifiablePredictionService.getAccuracyTrends(userId, options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.trends,
        metadata: {
          period: options.period,
          daysBack: options.daysBack,
          category: options.category
        }
      });

    } catch (error) {
      logger.logError(error, { context: 'get_accuracy_trends_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'trends_failed',
        message: 'Failed to retrieve accuracy trends'
      });
    }
  }

  /**
   * ⚙️ GET USER PREFERENCES
   * GET /api/verifiable-predictions/preferences
   */
  async getUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      
      const result = await verifiablePredictionService.getUserPreferences(userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.preferences
      });

    } catch (error) {
      logger.logError(error, { context: 'get_user_preferences_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'preferences_failed',
        message: 'Failed to retrieve user preferences'
      });
    }
  }

  /**
   * ⚙️ UPDATE USER PREFERENCES
   * PUT /api/verifiable-predictions/preferences
   */
  async updateUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      const preferences = {
        preferredCategories: req.body.preferredCategories,
        timeframePreference: req.body.timeframePreference,
        specificityLevel: req.body.specificityLevel,
        feedbackNotifications: req.body.feedbackNotifications,
        emailReminders: req.body.emailReminders,
        maxActivePredictions: req.body.maxActivePredictions
      };

      const result = await verifiablePredictionService.updateUserPreferences(userId, preferences);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.preferences,
        message: 'Preferences updated successfully'
      });

    } catch (error) {
      logger.logError(error, { context: 'update_user_preferences_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'update_failed',
        message: 'Failed to update preferences'
      });
    }
  }

  /**
   * 💬 SUBMIT PREDICTION FEEDBACK
   * POST /api/verifiable-predictions/:predictionId/feedback
   */
  async submitPredictionFeedback(req, res) {
    try {
      const userId = req.user.id;
      const predictionId = req.params.predictionId;
      const feedbackData = {
        feedbackType: req.body.feedbackType,
        rating: req.body.rating,
        feedbackText: req.body.feedbackText,
        isHelpful: req.body.isHelpful,
        suggestedImprovement: req.body.suggestedImprovement
      };

      const result = await verifiablePredictionService.submitPredictionFeedback(
        predictionId, 
        userId, 
        feedbackData
      );

      if (!result.success) {
        const statusCode = result.error === 'prediction_not_found' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.feedback,
        message: 'Feedback submitted successfully'
      });

    } catch (error) {
      logger.logError(error, { 
        context: 'submit_prediction_feedback_controller', 
        userId: req.user?.id,
        predictionId: req.params.predictionId 
      });

      res.status(500).json({
        success: false,
        error: 'feedback_failed',
        message: 'Failed to submit feedback'
      });
    }
  }

  /**
   * 🔄 EXTEND PREDICTION DEADLINE
   * PUT /api/verifiable-predictions/:predictionId/extend
   */
  async extendPredictionDeadline(req, res) {
    try {
      const userId = req.user.id;
      const predictionId = req.params.predictionId;
      const extensionDays = req.body.extensionDays;
      const reason = req.body.reason;

      const result = await verifiablePredictionService.extendPredictionDeadline(
        predictionId, 
        userId, 
        extensionDays, 
        reason
      );

      if (!result.success) {
        const statusCode = result.error === 'prediction_not_found' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.prediction,
        message: `Prediction deadline extended by ${extensionDays} days`
      });

    } catch (error) {
      logger.logError(error, { 
        context: 'extend_prediction_deadline_controller', 
        userId: req.user?.id,
        predictionId: req.params.predictionId 
      });

      res.status(500).json({
        success: false,
        error: 'extension_failed',
        message: 'Failed to extend prediction deadline'
      });
    }
  }

  /**
   * ❌ CANCEL PREDICTION
   * DELETE /api/verifiable-predictions/:predictionId
   */
  async cancelPrediction(req, res) {
    try {
      const userId = req.user.id;
      const predictionId = req.params.predictionId;
      const reason = req.body.reason;

      const result = await verifiablePredictionService.cancelPrediction(predictionId, userId, reason);

      if (!result.success) {
        const statusCode = result.error === 'prediction_not_found' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: 'Prediction cancelled successfully'
      });

    } catch (error) {
      logger.logError(error, { 
        context: 'cancel_prediction_controller', 
        userId: req.user?.id,
        predictionId: req.params.predictionId 
      });

      res.status(500).json({
        success: false,
        error: 'cancellation_failed',
        message: 'Failed to cancel prediction'
      });
    }
  }

  /**
   * 🌟 GET PREDICTION EXAMPLES
   * GET /api/verifiable-predictions/examples/categories
   */
  async getPredictionExamples(req, res) {
    try {
      const language = req.query.language || 'en';
      const category = req.query.category;

      const result = await verifiablePredictionService.getPredictionExamples(language, category);

      res.json({
        success: true,
        data: result.examples,
        categories: result.categories
      });

    } catch (error) {
      logger.logError(error, { context: 'get_prediction_examples_controller' });

      res.status(500).json({
        success: false,
        error: 'examples_failed',
        message: 'Failed to retrieve prediction examples'
      });
    }
  }

  /**
   * 📱 GET PENDING REMINDERS
   * GET /api/verifiable-predictions/reminders/pending
   */
  async getPendingReminders(req, res) {
    try {
      const userId = req.user.id;
      
      const result = await verifiablePredictionService.getPendingReminders(userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: {
          reminders: result.reminders,
          counts: result.counts
        }
      });

    } catch (error) {
      logger.logError(error, { context: 'get_pending_reminders_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'reminders_failed',
        message: 'Failed to retrieve pending reminders'
      });
    }
  }

  /**
   * 🎲 GENERATE QUICK PREDICTION
   * POST /api/verifiable-predictions/quick
   */
  async generateQuickPrediction(req, res) {
    const startTime = Date.now();

    try {
      const userId = req.user.id;
      const options = {
        category: req.body.category,
        timeframe: req.body.timeframe || 'today',
        language: req.body.language || 'en'
      };

      const result = await verifiablePredictionService.generateQuickPrediction(userId, options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
          responseTime: Date.now() - startTime
        });
      }

      res.json({
        success: true,
        data: result.prediction,
        responseTime: Date.now() - startTime
      });

    } catch (error) {
      logger.logError(error, { context: 'generate_quick_prediction_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'quick_generation_failed',
        message: 'Failed to generate quick prediction',
        responseTime: Date.now() - startTime
      });
    }
  }

  /**
   * 📈 GET GLOBAL ANALYTICS (Admin)
   * GET /api/verifiable-predictions/admin/analytics
   */
  async getGlobalAnalytics(req, res) {
    try {
      // Check if user is admin (implement admin check logic)
      // if (!req.user.isAdmin) {
      //   return res.status(403).json({
      //     success: false,
      //     error: 'admin_required',
      //     message: 'Admin access required'
      //   });
      // }

      const options = {
        timeframe: req.query.timeframe || '30d',
        includeUserBreakdown: req.query.includeUserBreakdown === 'true'
      };

      const result = await verifiablePredictionService.getGlobalAnalytics(options);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.analytics,
        metadata: {
          generatedAt: new Date().toISOString(),
          timeframe: options.timeframe
        }
      });

    } catch (error) {
      logger.logError(error, { context: 'get_global_analytics_controller', userId: req.user?.id });

      res.status(500).json({
        success: false,
        error: 'global_analytics_failed',
        message: 'Failed to retrieve global analytics'
      });
    }
  }

  /**
   * 🛠️ HEALTH CHECK
   * GET /api/verifiable-predictions/health
   */
  async healthCheck(req, res) {
    try {
      const health = await verifiablePredictionService.healthCheck();
      
      const statusCode = health.healthy ? 200 : 503;
      
      res.status(statusCode).json(health);

    } catch (error) {
      logger.logError(error, { context: 'verifiable_predictions_health_check' });

      res.status(503).json({
        healthy: false,
        error: 'health_check_failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 📋 GET SYSTEM STATUS
   * GET /api/verifiable-predictions/status
   */
  async getSystemStatus(req, res) {
    try {
      const status = await verifiablePredictionService.getStatus();

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { context: 'get_system_status_controller' });

      res.status(500).json({
        success: false,
        error: 'status_failed',
        message: 'Failed to retrieve system status'
      });
    }
  }
}

module.exports = new VerifiablePredictionController();