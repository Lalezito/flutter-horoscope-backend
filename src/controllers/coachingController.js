const db = require("../config/db");
const weeklyController = require("./weeklyController");
const aiCoachService = require("../services/aiCoachService");
const logger = require("../services/loggingService");
const { body, validationResult } = require("express-validator");
const { normalizeSignName } = require("../utils/signTranslations");

class CoachingController {
  async getDailyHoroscope(req, res) {
    const { sign, language, lang } = req.query;

    // Support both 'language' and 'lang' parameters for compatibility
    const languageCode = language || lang;

    // Normalizar el nombre del signo (inglés → español)
    const normalizedSign = normalizeSignName(sign);

    try {
      const query = `
        SELECT * FROM daily_horoscopes
        WHERE date = CURRENT_DATE
        AND sign ILIKE $1 AND language_code = $2
        LIMIT 1;
      `;
      const result = await db.query(query, [normalizedSign, languageCode]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "No horoscope found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("DB error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getAllHoroscopes(req, res) {
    const { sign, language, lang } = req.query;

    // Support both 'language' and 'lang' parameters for compatibility
    const languageCode = language || lang;

    // Normalizar el nombre del signo si se proporciona
    const normalizedSign = sign ? normalizeSignName(sign) : null;

    try {
      const query = `
        SELECT * FROM daily_horoscopes
        WHERE date = CURRENT_DATE
        AND ($1::text IS NULL OR language_code = $1)
        AND ($2::text IS NULL OR sign ILIKE $2)
        ORDER BY sign;
      `;
      const result = await db.query(query, [
        languageCode || null,
        normalizedSign,
      ]);
      res.json(result.rows);
    } catch (error) {
      console.error("DB error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * AI Coach Chat - Main endpoint for personalized astrological coaching
   */
  async chatWithCoach(req, res) {
    // Input validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: errors.array(),
      });
    }

    const { message, userId, zodiacSign, language, premiumTier } = req.body;
    const startTime = Date.now();

    try {
      // Build user context for personalized coaching
      // NOTE: premiumTier comes from RevenueCat via frontend
      // Only "stellar" tier has access to Cosmic Coach
      const userContext = {
        userId: userId || `anonymous_${Date.now()}`,
        zodiacSign: zodiacSign || "Leo", // Default to Leo if not provided
        language: language || "en",
        premiumTier: premiumTier || null, // From RevenueCat: "stellar" = full access, "cosmic" = no AI access
        requestId: `req_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      };

      logger.getLogger().info("AI Coach: New chat request", {
        userId: userContext.userId,
        zodiacSign: userContext.zodiacSign,
        messageLength: message?.length,
        language: userContext.language,
      });

      // Generate AI coach response
      const coachResponse = await aiCoachService.generateCoachResponse(
        message,
        userContext
      );

      const responseTime = Date.now() - startTime;

      // Return successful response
      res.status(200).json({
        success: true,
        data: {
          response: coachResponse.content,
          scenario: coachResponse.scenario,
          qualityScore: coachResponse.qualityScore,
          responseTime: responseTime,
          requestId: userContext.requestId,
          zodiacSign: userContext.zodiacSign,
          timestamp: coachResponse.timestamp,
        },
        meta: {
          tokensUsed: coachResponse.tokensUsed,
          model: coachResponse.model,
          responseType: coachResponse.responseType,
          cached: coachResponse.cached || false,
        },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.logError(error, {
        controller: "CoachingController",
        method: "chatWithCoach",
        userId: req.body.userId,
        zodiacSign: req.body.zodiacSign,
        responseTime,
      });

      res.status(500).json({
        success: false,
        error: "Unable to generate coach response",
        message:
          "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.",
        requestId: `req_${Date.now()}_error`,
        responseTime,
      });
    }
  }

  /**
   * Get user's conversation history with the AI coach
   */
  async getConversationHistory(req, res) {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    try {
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const query = `
        SELECT 
          id,
          user_message,
          ai_response,
          scenario,
          quality_score,
          zodiac_sign,
          language_code,
          created_at
        FROM coach_conversations 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [
        userId,
        parseInt(limit),
        parseInt(offset),
      ]);

      // Get total count for pagination
      const countQuery =
        "SELECT COUNT(*) FROM coach_conversations WHERE user_id = $1";
      const countResult = await db.query(countQuery, [userId]);
      const totalCount = parseInt(countResult.rows[0].count);

      res.status(200).json({
        success: true,
        data: {
          conversations: result.rows,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + result.rows.length < totalCount,
          },
        },
      });
    } catch (error) {
      logger.logError(error, {
        controller: "CoachingController",
        method: "getConversationHistory",
        userId,
      });

      res.status(500).json({
        success: false,
        error: "Unable to retrieve conversation history",
      });
    }
  }

  /**
   * Update user preferences for AI coaching
   */
  async updateUserPreferences(req, res) {
    const { userId } = req.params;
    const {
      zodiacSign,
      preferredLanguage,
      coachingStyle,
      focusAreas,
      communicationPreferences,
      timezone,
    } = req.body;

    try {
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const query = `
        INSERT INTO coach_user_preferences (
          user_id, zodiac_sign, preferred_language, coaching_style, 
          focus_areas, communication_preferences, timezone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          zodiac_sign = EXCLUDED.zodiac_sign,
          preferred_language = EXCLUDED.preferred_language,
          coaching_style = EXCLUDED.coaching_style,
          focus_areas = EXCLUDED.focus_areas,
          communication_preferences = EXCLUDED.communication_preferences,
          timezone = EXCLUDED.timezone,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        zodiacSign,
        preferredLanguage || "en",
        coachingStyle || "balanced",
        JSON.stringify(focusAreas || []),
        JSON.stringify(communicationPreferences || {}),
        timezone,
      ]);

      res.status(200).json({
        success: true,
        data: {
          preferences: result.rows[0],
          message: "User preferences updated successfully",
        },
      });
    } catch (error) {
      logger.logError(error, {
        controller: "CoachingController",
        method: "updateUserPreferences",
        userId,
      });

      res.status(500).json({
        success: false,
        error: "Unable to update user preferences",
      });
    }
  }

  /**
   * Get AI coach service health and statistics
   */
  async getCoachStats(req, res) {
    try {
      const stats = await aiCoachService.getServiceStats();
      const healthCheck = await aiCoachService.healthCheck();

      res.status(200).json({
        success: true,
        data: {
          health: healthCheck,
          statistics: stats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.logError(error, {
        controller: "CoachingController",
        method: "getCoachStats",
      });

      res.status(500).json({
        success: false,
        error: "Unable to retrieve coach statistics",
      });
    }
  }

  /**
   * Submit feedback for a conversation
   */
  async submitConversationFeedback(req, res) {
    const { conversationId } = req.params;
    const { userId, satisfactionRating, helpful, feedback, followUpRequested } =
      req.body;

    try {
      // Validate conversation exists and belongs to user
      const conversationCheck = await db.query(
        "SELECT user_id FROM coach_conversations WHERE id = $1",
        [conversationId]
      );

      if (conversationCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      if (conversationCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized to provide feedback for this conversation",
        });
      }

      // Insert feedback
      const query = `
        INSERT INTO coach_conversation_analytics (
          user_id, conversation_id, satisfaction_rating, helpful, 
          follow_up_requested, feedback
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await db.query(query, [
        userId,
        conversationId,
        satisfactionRating,
        helpful,
        followUpRequested || false,
        feedback,
      ]);

      res.status(200).json({
        success: true,
        data: {
          feedback: result.rows[0],
          message: "Feedback submitted successfully",
        },
      });
    } catch (error) {
      logger.logError(error, {
        controller: "CoachingController",
        method: "submitConversationFeedback",
        conversationId,
        userId,
      });

      res.status(500).json({
        success: false,
        error: "Unable to submit feedback",
      });
    }
  }

  /**
   * Enhanced webhook to handle both daily and weekly horoscopes from n8n
   */
  async notifyHoroscope(req, res) {
    const { type, horoscopes } = req.body;

    try {
      if (type === "weekly" && Array.isArray(horoscopes)) {
        // Process weekly horoscopes from n8n
        const results = await weeklyController.storeWeeklyHoroscopes(
          horoscopes
        );
        console.log(
          `✅ Processed ${results.success} weekly horoscopes, ${results.errors} errors`
        );

        res.status(200).json({
          success: true,
          type: "weekly",
          processed: results.success,
          errors: results.errors,
          details: results.details,
        });
      } else if (type === "daily" || !type) {
        // Process daily horoscopes (existing behavior)
        const horoscopeData = req.body;
        console.log("✅ Received daily horoscopes from n8n:", horoscopeData);

        res.status(200).json({
          success: true,
          type: "daily",
          message: "Daily horoscope notification received correctly",
        });
      } else {
        res.status(400).json({
          error: "Invalid notification type",
          supported_types: ["daily", "weekly"],
        });
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({
        error: "Error processing notification",
        message: error.message,
      });
    }
  }

  /**
   * Validation middleware for chat endpoint
   */
  static getChatValidation() {
    return [
      body("message")
        .notEmpty()
        .withMessage("Message is required")
        .isLength({ min: 3, max: 1000 })
        .withMessage("Message must be between 3 and 1000 characters"),
      body("zodiacSign")
        .optional()
        .isIn([
          // Spanish names
          "Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo",
          "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis",
          // English names (for frontend compatibility)
          "Taurus", "Gemini", "Cancer", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
        ])
        .withMessage("Invalid zodiac sign"),
      body("language")
        .optional()
        .isIn(["en", "es", "fr", "de", "it", "pt"])
        .withMessage("Invalid language code"),
      body("userId")
        .optional()
        .isLength({ min: 1, max: 255 })
        .withMessage("User ID must be between 1 and 255 characters"),
    ];
  }
}

const controller = new CoachingController();
controller.getChatValidation = CoachingController.getChatValidation;
module.exports = controller;
