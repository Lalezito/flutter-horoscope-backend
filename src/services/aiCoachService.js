/**
 * 🤖 AI COACH SERVICE
 *
 * Real-time AI coaching with OpenAI GPT-4 integration
 * Features:
 * - Multi-persona AI coaching (general, spiritual, career, wellness, etc.)
 * - Premium subscription validation
 * - Conversation memory and context management
 * - Redis caching for performance
 * - Token usage tracking
 * - Response time optimization (<3s requirement)
 */

// Load environment variables first
const dotenv = require("dotenv");
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production" });
  dotenv.config({ path: ".env" }); // Fallback for missing variables
} else {
  dotenv.config();
}

const OpenAI = require("openai");
// Use Node.js crypto.randomUUID() instead of uuid package (ES module compatibility)
const { randomUUID } = require("crypto");
const uuidv4 = randomUUID;
const db = require("../config/db");
const redisService = require("./redisService");
const receiptValidationService = require("./receiptValidationService");
const logger = require("./loggingService");
const { normalizeSignName } = require("../utils/signTranslations");
const circuitBreaker = require("./circuitBreakerService");
const retroactivePredictionService = require("./retroactivePredictionService");
const streakService = require("./streakService");
const localContextService = require("./localContextService");

class AICoachService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // AI Coach personas with specialized prompts
    this.personas = {
      general: {
        name: "General Life Coach",
        systemPrompt: `You are a wise and empathetic life coach helping people navigate their daily challenges. 
        Provide practical, actionable advice while being supportive and encouraging. Keep responses concise but meaningful.
        Focus on personal growth, goal achievement, and positive mindset development.`,
        maxTokens: 500,
      },
      spiritual: {
        name: "Spiritual Guide",
        systemPrompt: `You are a spiritual guide combining ancient wisdom with modern psychology. 
        Draw from various spiritual traditions (without favoring any specific religion) to provide guidance.
        Help users find inner peace, purpose, and spiritual growth. Include mindfulness and meditation suggestions when appropriate.`,
        maxTokens: 600,
      },
      career: {
        name: "Career Coach",
        systemPrompt: `You are a professional career coach with expertise in personal development and workplace success.
        Provide strategic career advice, help with professional challenges, and guide users toward their career goals.
        Focus on skill development, networking, leadership, and work-life balance.`,
        maxTokens: 500,
      },
      relationship: {
        name: "Relationship Advisor",
        systemPrompt: `You are a compassionate relationship coach specializing in interpersonal dynamics.
        Help users improve their relationships (romantic, family, friends, colleagues) through better communication,
        emotional intelligence, and healthy boundary setting. Always promote respect and healthy relationships.`,
        maxTokens: 500,
      },
      wellness: {
        name: "Wellness Coach",
        systemPrompt: `You are a holistic wellness coach focused on mental, physical, and emotional well-being.
        Provide guidance on stress management, healthy habits, work-life balance, and overall life satisfaction.
        Include practical tips for daily wellness routines and self-care practices.`,
        maxTokens: 500,
      },
      motivational: {
        name: "Motivational Coach",
        systemPrompt: `You are an energetic and inspiring motivational coach who helps people overcome challenges and achieve their goals.
        Use positive psychology, goal-setting techniques, and motivational strategies to empower users.
        Be enthusiastic, uplifting, and focused on action and results.`,
        maxTokens: 400,
      },
    };

    // Configuration
    this.config = {
      defaultModel: "gpt-4-turbo-preview",
      fallbackModel: "gpt-3.5-turbo",
      maxContextMessages: 10, // Keep last 10 messages for context
      responseTimeoutMs: 25000, // 25 seconds timeout
      maxRetries: 2,
      cacheExpirationSeconds: 3600, // 1 hour cache for similar questions
    };

    // Premium feature limits
    this.premiumLimits = {
      free: {
        dailyMessages: 5,
        sessionMinutes: 15,
        personas: ["general"],
        features: ["basic_chat"],
      },
      premium: {
        dailyMessages: 100,
        sessionMinutes: 120,
        personas: Object.keys(this.personas),
        features: [
          "basic_chat",
          "advanced_personas",
          "context_memory",
          "priority_response",
        ],
      },
    };
  }

  /**
   * 🚀 START NEW CHAT SESSION
   * Creates a new chat session for a user with premium validation
   */
  async startChatSession(userId, options = {}) {
    const startTime = Date.now();

    try {
      logger
        .getLogger()
        .info("Starting AI Coach chat session", { userId, options });

      // Validate premium subscription
      const premiumStatus = await this._validatePremiumAccess(
        userId,
        options.receiptData
      );
      if (!premiumStatus.hasAccess) {
        return {
          success: false,
          error: "premium_required",
          message: "AI Coach requires premium subscription",
          premiumStatus,
        };
      }

      // Check daily usage limits
      const usageCheck = await this._checkDailyUsage(
        userId,
        premiumStatus.isPremium
      );
      if (!usageCheck.allowed) {
        return {
          success: false,
          error: "limit_exceeded",
          message: "Daily message limit exceeded",
          usage: usageCheck,
        };
      }

      // Create new session
      const sessionId = uuidv4();
      const persona =
        options.persona && this.personas[options.persona]
          ? options.persona
          : "general";
      const languageCode = options.languageCode || "en";

      // Validate persona access based on subscription
      if (!premiumStatus.allowedFeatures.personas.includes(persona)) {
        return {
          success: false,
          error: "persona_not_available",
          message: `${persona} persona requires premium subscription`,
          availablePersonas: premiumStatus.allowedFeatures.personas,
        };
      }

      const sessionData = {
        session_id: sessionId,
        user_id: userId,
        ai_coach_persona: persona,
        language_code: languageCode,
        session_metadata: JSON.stringify({
          userAgent: options.userAgent,
          platform: options.platform,
          appVersion: options.appVersion,
          startTime: new Date().toISOString(),
          premiumStatus: premiumStatus.isPremium,
        }),
        conversation_context: JSON.stringify({
          persona: persona,
          systemPrompt: this.personas[persona].systemPrompt,
          messageHistory: [],
          userPreferences: options.preferences || {},
        }),
      };

      // Insert session into database
      const insertQuery = `
        INSERT INTO chat_sessions (session_id, user_id, ai_coach_persona, language_code, session_metadata, conversation_context)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        sessionData.session_id,
        sessionData.user_id,
        sessionData.ai_coach_persona,
        sessionData.language_code,
        sessionData.session_metadata,
        sessionData.conversation_context,
      ]);

      const session = result.rows[0];

      // Cache session data in Redis for quick access
      await this._cacheSessionData(sessionId, {
        ...session,
        premiumStatus,
        usageStats: usageCheck,
      });

      const responseTime = Date.now() - startTime;
      logger.getLogger().info("AI Coach session started successfully", {
        userId,
        sessionId,
        persona,
        responseTime,
      });

      return {
        success: true,
        session: {
          sessionId: session.session_id,
          persona: session.ai_coach_persona,
          personaName: this.personas[persona].name,
          languageCode: session.language_code,
          createdAt: session.created_at,
          premiumFeatures: premiumStatus.allowedFeatures,
          dailyUsage: usageCheck,
        },
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, {
        context: "ai_coach_start_session",
        userId,
        responseTime,
        options,
      });

      return {
        success: false,
        error: "internal_error",
        message: "Failed to start chat session",
        responseTime,
      };
    }
  }

  /**
   * 💬 SEND MESSAGE AND GET AI RESPONSE
   * Main chat functionality with AI response generation
   *
   * @param {string} sessionId - Unique session identifier
   * @param {string} message - User's message content
   * @param {string} userId - User identifier
   * @param {Object} options - Optional parameters
   * @param {string} [options.zodiacSign] - User's zodiac sign (e.g., 'Leo', 'Aries')
   * @param {string} [options.language] - Language code (e.g., 'es', 'en', 'de', 'fr', 'it', 'pt')
   *
   * @returns {Promise<Object>} Response object
   * @returns {boolean} return.success - Operation success status
   * @returns {Object} return.response - AI response data
   * @returns {string} return.response.content - AI-generated response text
   * @returns {string} return.response.sessionId - Session identifier
   * @returns {string} return.response.messageId - Unique message identifier
   * @returns {string} return.response.model - AI model used (e.g., 'gpt-4-turbo')
   * @returns {number} return.response.tokensUsed - Total tokens consumed
   * @returns {number} return.response.responseTime - Response time in milliseconds
   * @returns {number} return.response.confidenceScore - AI confidence score (0-1)
   * @returns {string} return.response.persona - Active AI persona
   * @returns {string} return.response.timestamp - ISO timestamp
   * @returns {Object|null} return.response.horoscopeData - Daily horoscope metadata
   * @returns {string} return.response.horoscopeData.energyLevel - Energy level ('high'|'medium'|'low'|'balanced')
   * @returns {string} return.response.horoscopeData.luckyColors - Comma-separated lucky colors
   * @returns {string} return.response.horoscopeData.favorableTimes - Time ranges (e.g., '14:00-16:00, 20:00-22:00')
   * @returns {string} return.response.horoscopeData.date - Horoscope date (ISO format)
   * @returns {string} [return.response.horoscopeData.loveFocus] - Love guidance
   * @returns {string} [return.response.horoscopeData.careerFocus] - Career guidance
   * @returns {string} [return.response.horoscopeData.wellnessFocus] - Wellness guidance
   * @returns {Object} return.usage - Usage statistics
   * @returns {number} return.usage.remainingMessages - Messages remaining in current period
   * @returns {string} return.usage.resetTime - Usage reset timestamp
   *
   * @example
   * const response = await sendMessage(
   *   'session-123',
   *   '¿Cómo está mi día?',
   *   'user-456',
   *   { zodiacSign: 'Leo', language: 'es' }
   * );
   *
   * // Response includes personalized horoscope data:
   * // response.response.horoscopeData = {
   * //   energyLevel: 'high',
   * //   luckyColors: 'dorado, púrpura',
   * //   favorableTimes: '14:00-16:00, 20:00-22:00',
   * //   loveFocus: 'Comunicación abierta trae armonía',
   * //   careerFocus: 'Excelente día para presentar proyectos',
   * //   wellnessFocus: 'Ejercicio vigoroso canaliza tu energía'
   * // }
   */
  async sendMessage(sessionId, message, userId, options = {}) {
    const startTime = Date.now();

    try {
      logger.getLogger().info("Processing AI Coach message", {
        sessionId,
        userId,
        messageLength: message.length,
      });

      // Validate and get session
      const session = await this._getAndValidateSession(sessionId, userId);
      if (!session.success) {
        return session;
      }

      const sessionData = session.data;

      // Check premium access and usage
      const premiumStatus = await this._validatePremiumAccess(
        userId,
        options.receiptData
      );
      if (!premiumStatus.hasAccess) {
        return {
          success: false,
          error: "premium_required",
          message: "AI Coach requires premium subscription",
        };
      }

      const usageCheck = await this._checkDailyUsage(
        userId,
        premiumStatus.isPremium
      );
      if (!usageCheck.allowed) {
        return {
          success: false,
          error: "limit_exceeded",
          message: "Daily message limit exceeded",
          usage: usageCheck,
        };
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔮 NEW: CHECK FOR PREDICTION FEEDBACK
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let predictionFeedback = null;
      const isPredictionFeedback =
        retroactivePredictionService.detectsPredictionFeedback(message);

      if (isPredictionFeedback) {
        predictionFeedback = await retroactivePredictionService.processFeedback(
          userId,
          message
        );
      }

      // Store user message
      await this._storeMessage(sessionId, "user", message, {
        userAgent: options.userAgent,
        timestamp: new Date().toISOString(),
      });

      // Generate AI response using circuit breaker for reliability
      const aiResponse = await circuitBreaker.execute(
        "openai_chat",
        async () => {
          return await this._generateAIResponse(sessionData, message, options);
        }
      );

      if (!aiResponse.success) {
        // Store error message for user feedback
        await this._storeMessage(
          sessionId,
          "system",
          "I apologize, but I'm having trouble responding right now. Please try again in a moment.",
          {
            error: aiResponse.error,
            timestamp: new Date().toISOString(),
          }
        );

        return aiResponse;
      }

      // Store AI response
      await this._storeMessage(sessionId, "ai", aiResponse.content, {
        model: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        responseTime: aiResponse.responseTime,
        confidenceScore: aiResponse.confidenceScore,
        timestamp: new Date().toISOString(),
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔮 NEW: EXTRACT PREDICTIONS FROM AI RESPONSE
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        await retroactivePredictionService.extractPredictions(
          userId,
          aiResponse.content,
          aiResponse.horoscopeData
        );
      } catch (predError) {
        // Don't fail the response if prediction extraction fails
        logger.logError(predError, {
          context: "extract_predictions_from_ai_response",
          userId,
          sessionId,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔮 NEW: CHECK YESTERDAY'S PREDICTIONS (once per session)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let predictionCheckMessage = null;
      const messageCount = await this._getSessionMessageCount(sessionId);

      if (messageCount === 1) {
        // First message in session - check yesterday's predictions
        const predictionCheck =
          await retroactivePredictionService.checkYesterdayPredictions(userId);
        if (predictionCheck) {
          predictionCheckMessage = predictionCheck.feedbackRequest;
        }
      }

      // Update conversation context
      await this._updateConversationContext(
        sessionId,
        message,
        aiResponse.content
      );

      // Update usage tracking
      await this._updateUsageStats(userId, premiumStatus.isPremium);

      // 🔥 NEW: Check in user for daily streak (gamification)
      // Detect language from options or default to Spanish
      const userLanguage = options.language || "es";
      const streakInfo = await streakService.checkIn(userId, userLanguage);

      const totalResponseTime = Date.now() - startTime;
      logger.getLogger().info("AI Coach message processed successfully", {
        sessionId,
        userId,
        totalResponseTime,
        aiResponseTime: aiResponse.responseTime,
        streakCheckIn: streakInfo.success,
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔮 BUILD FINAL RESPONSE WITH PREDICTION ENHANCEMENTS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let finalContent = aiResponse.content;

      // Append prediction feedback celebration (if user gave positive feedback)
      if (predictionFeedback) {
        finalContent += predictionFeedback;
      }

      // Append yesterday's prediction check (if first message and predictions exist)
      if (predictionCheckMessage) {
        finalContent += predictionCheckMessage;
      }

      return {
        success: true,
        response: {
          content: finalContent,
          sessionId: sessionId,
          messageId: aiResponse.messageId,
          model: aiResponse.model,
          tokensUsed: aiResponse.tokensUsed,
          responseTime: totalResponseTime,
          confidenceScore: aiResponse.confidenceScore,
          persona: sessionData.ai_coach_persona,
          timestamp: new Date().toISOString(),
          // ✨ NEW: Include horoscope data for frontend display
          horoscopeData: aiResponse.horoscopeData,
          // 🔮 NEW: Prediction metadata for frontend
          hasPredictionCheck: !!predictionCheckMessage,
          hasPredictionFeedback: !!predictionFeedback,
        },
        usage: {
          remainingMessages: Math.max(
            0,
            usageCheck.limit - usageCheck.used - 1
          ),
          resetTime: usageCheck.resetTime,
        },
        // 🔥 NEW: Include streak information in response
        streak: streakInfo,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, {
        context: "ai_coach_send_message",
        sessionId,
        userId,
        responseTime,
      });

      return {
        success: false,
        error: "internal_error",
        message: "Failed to process message",
        responseTime,
      };
    }
  }

  /**
   * 📜 GET CHAT HISTORY
   * Retrieve conversation history for a session
   */
  async getChatHistory(sessionId, userId, options = {}) {
    try {
      logger.getLogger().info("Retrieving chat history", { sessionId, userId });

      // Validate session access
      const session = await this._getAndValidateSession(sessionId, userId);
      if (!session.success) {
        return session;
      }

      const limit = Math.min(options.limit || 50, 100); // Max 100 messages
      const offset = options.offset || 0;

      const query = `
        SELECT 
          id,
          message_type,
          content,
          metadata,
          created_at,
          tokens_used,
          response_time_ms,
          confidence_score
        FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [sessionId, limit, offset]);
      const messages = result.rows.reverse(); // Reverse to get chronological order

      // Get session info
      const sessionInfo = session.data;

      return {
        success: true,
        history: {
          sessionId: sessionId,
          persona: sessionInfo.ai_coach_persona,
          personaName:
            this.personas[sessionInfo.ai_coach_persona]?.name || "AI Coach",
          createdAt: sessionInfo.created_at,
          lastActivity: sessionInfo.last_activity,
          totalMessages: sessionInfo.total_messages,
          messages: messages.map((msg) => ({
            id: msg.id,
            type: msg.message_type,
            content: msg.content,
            timestamp: msg.created_at,
            metadata: msg.metadata,
            ...(msg.message_type === "ai" && {
              tokensUsed: msg.tokens_used,
              responseTime: msg.response_time_ms,
              confidenceScore: msg.confidence_score,
            }),
          })),
        },
        pagination: {
          limit,
          offset,
          hasMore: result.rows.length === limit,
        },
      };
    } catch (error) {
      logger.logError(error, {
        context: "ai_coach_get_history",
        sessionId,
        userId,
      });

      return {
        success: false,
        error: "internal_error",
        message: "Failed to retrieve chat history",
      };
    }
  }

  /**
   * 🔐 PRIVATE: Validate premium subscription access
   */
  async _validatePremiumAccess(userId, receiptData) {
    try {
      if (!receiptData) {
        // For testing/development, allow free tier access
        if (process.env.NODE_ENV !== "production") {
          return {
            hasAccess: true,
            isPremium: false,
            allowedFeatures: this.premiumLimits.free,
            message: "Development mode - free tier access",
          };
        }

        return {
          hasAccess: false,
          isPremium: false,
          allowedFeatures: this.premiumLimits.free,
          message: "Receipt data required for premium validation",
        };
      }

      const subscriptionStatus =
        await receiptValidationService.getUserSubscriptionStatus(
          receiptData,
          userId
        );
      const isPremium = subscriptionStatus.isPremium;
      const allowedFeatures = isPremium
        ? this.premiumLimits.premium
        : this.premiumLimits.free;

      return {
        hasAccess: true, // Both free and premium users can access AI Coach
        isPremium,
        allowedFeatures,
        subscriptionStatus,
        message: isPremium ? "Premium access granted" : "Free tier access",
      };
    } catch (error) {
      logger.logError(error, { context: "premium_validation", userId });

      return {
        hasAccess: false,
        isPremium: false,
        allowedFeatures: this.premiumLimits.free,
        error: error.message,
      };
    }
  }

  /**
   * 📊 PRIVATE: Check daily usage limits
   *
   * Returns paywall information when free tier user hits 5 messages/day limit
   */
  async _checkDailyUsage(userId, isPremium) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const cacheKey = `ai_coach_usage:${userId}:${today}`;

      const cachedUsage = await redisService.get(cacheKey);
      let usage = cachedUsage
        ? JSON.parse(cachedUsage)
        : { used: 0, date: today };

      const limits = isPremium
        ? this.premiumLimits.premium
        : this.premiumLimits.free;
      const allowed = usage.used < limits.dailyMessages;

      // 🎯 PAYWALL: Show upgrade prompt when free user hits 5 messages
      if (!isPremium && !allowed) {
        return {
          allowed: false,
          used: usage.used,
          limit: limits.dailyMessages,
          isPremium,
          resetTime: new Date(new Date().setHours(23, 59, 59, 999)),
          paywall: {
            type: "daily_limit_exceeded",
            message: `🌟 Llegaste a tu límite diario (${limits.dailyMessages} mensajes)

¿Quieres más?

✨ COSMIC ($4.99/mes):
   • 50 mensajes/día
   • Respuestas largas y empáticas
   • Challenges diarios
   • Modismos de tu país

🚀 UNIVERSE ($9.99/mes):
   • Mensajes ilimitados
   • Moon + Rising sign
   • Compatibilidad
   • Lectura anual 2026

👉 Upgrade ahora`,
            cta: "Upgrade to Cosmic",
            trialOffer: "7 días gratis - cancela cuando quieras",
            tiers: [
              {
                name: "Cosmic",
                price: "$4.99/mes",
                features: [
                  "50 mensajes/día",
                  "Respuestas largas y empáticas",
                  "Challenges diarios",
                  "Modismos de tu país",
                ],
              },
              {
                name: "Universe",
                price: "$9.99/mes",
                features: [
                  "Mensajes ilimitados",
                  "Moon + Rising sign",
                  "Compatibilidad",
                  "Lectura anual 2026",
                ],
              },
            ],
          },
        };
      }

      return {
        allowed,
        used: usage.used,
        limit: limits.dailyMessages,
        isPremium,
        resetTime: new Date(new Date().setHours(23, 59, 59, 999)),
      };
    } catch (error) {
      logger.logError(error, { context: "usage_check", userId });

      // On error, allow limited access
      return {
        allowed: true,
        used: 0,
        limit: 5,
        isPremium: false,
        resetTime: new Date(new Date().setHours(23, 59, 59, 999)),
      };
    }
  }

  /**
   * 🗃️ PRIVATE: Get and validate session
   */
  async _getAndValidateSession(sessionId, userId) {
    try {
      // Try to get from cache first
      const cacheKey = `ai_coach_session:${sessionId}`;
      let sessionData = await redisService.get(cacheKey);

      if (sessionData) {
        sessionData = JSON.parse(sessionData);
        if (sessionData.user_id === userId && sessionData.is_active) {
          return { success: true, data: sessionData };
        }
      }

      // Get from database
      const query = `
        SELECT * FROM chat_sessions 
        WHERE session_id = $1 AND user_id = $2 AND is_active = true
      `;

      const result = await db.query(query, [sessionId, userId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "session_not_found",
          message: "Chat session not found or access denied",
        };
      }

      const session = result.rows[0];

      // Cache for future use
      await this._cacheSessionData(sessionId, session);

      return { success: true, data: session };
    } catch (error) {
      logger.logError(error, {
        context: "session_validation",
        sessionId,
        userId,
      });

      return {
        success: false,
        error: "internal_error",
        message: "Failed to validate session",
      };
    }
  }

  /**
   * 🤖 PRIVATE: Generate AI response using OpenAI
   * ✨ NEW: Now includes personalized astrological data
   */
  async _generateAIResponse(sessionData, userMessage, options = {}) {
    const startTime = Date.now();

    try {
      const persona = this.personas[sessionData.ai_coach_persona];
      const conversationContext = JSON.parse(
        sessionData.conversation_context || "{}"
      );

      // ✨ Get horoscope data first (for metadata)
      const zodiacSign = options.zodiacSign || sessionData.zodiac_sign || "Leo";
      const language = options.language || sessionData.language_code || "en";
      const horoscopeData = await this._getDailyHoroscope(zodiacSign, language);

      // 💚 NEW: Detect emotional state in user's message
      const emotionalState = this._detectEmotionalState(userMessage);

      // Log emotional analysis for debugging
      if (emotionalState.needsExtraSupport) {
        logger.logInfo("💙 Emotional support needed", {
          sessionId,
          emotion: emotionalState.primaryEmotion,
          intensity: emotionalState.emotionalIntensity,
          sentiment: emotionalState.sentiment,
        });
      }

      // ✨ Build personalized astrological prompt
      const personalizedPrompt = await this._buildAstrologicalPrompt(
        persona.systemPrompt,
        zodiacSign,
        language
      );

      // 💙 Add empathetic context if user needs support
      const empathyContext = this._buildEmpatheticContext(
        emotionalState,
        language
      );

      // 🌍 NEW: Get local cultural context for personalization
      const country = options.country || sessionData.country || "US";
      const localContext = await localContextService.getLocalContext(
        country,
        new Date()
      );
      const localContextPrompt =
        localContextService.buildContextPrompt(localContext);

      logger.getLogger().info("Local context applied", {
        country,
        holiday: localContext.holiday,
        season: localContext.season,
        summary: localContextService.getContextSummary(localContext),
      });

      // Build conversation history for context
      const recentMessages = conversationContext.messageHistory || [];
      const contextMessages = recentMessages.slice(
        -this.config.maxContextMessages
      );

      // Build final system prompt with all enhancements
      let finalSystemPrompt = personalizedPrompt;
      if (empathyContext) {
        finalSystemPrompt += "\n\n" + empathyContext;
      }

      // 🌍 Add local cultural context
      if (localContextPrompt) {
        finalSystemPrompt += localContextPrompt;
      }

      // ✨ ENHANCED: Research-backed content guidelines for engagement
      finalSystemPrompt += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 RESPONSE QUALITY GUIDELINES (CRITICAL - FOLLOW STRICTLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**LENGTH & STRUCTURE:**
- Target: 250-350 words (4-6 paragraphs)
- Paragraph length: 2-3 sentences each (15-20 words per sentence)
- NEVER give short, generic responses under 200 words

**STORYTELLING APPROACH:**
1. **Opening Hook** (1-2 sentences): Start with cosmic validation or emotional connection
   - Examples: "The cosmos is conspiring in your favor today..."
   - "Today's rare planetary alignment brings a powerful shift for you..."

2. **Cosmic Context** (2-3 sentences): Explain today's energy with astrological specifics
   - Reference actual horoscope data provided above
   - Use phrases like: "With [planet] in [sign/house]..."

3. **Personal Guidance** (2-3 sentences): Address their SPECIFIC question with actionable advice
   - Give concrete micro-actions they can do TODAY
   - Include time-specific recommendations when relevant

4. **Empowerment** (2-3 sentences): Validate their journey and provide emotional support
   - Use reflective questions: "What if this moment is asking you to..."
   - Acknowledge their feelings: "What you're feeling is..."

5. **Call-to-Action** (1-2 sentences): End with empowering next step
   - Examples: "Trust this energy and take that first step today."
   - "Your cosmic moment is now—embrace it."

**TONE REQUIREMENTS:**
- Write as a warm, insightful friend (NOT a mystical fortune teller)
- Validate feelings BEFORE giving advice
- Emphasize FREE WILL and personal power (never fatalistic)
- Use "you" language to create intimacy
- Include gentle encouragement and compassion

**MUST INCLUDE:**
✓ At least 3 specific astrological references from the horoscope data above
✓ 1-2 concrete micro-actions (specific, achievable today)
✓ Time-specific guidance when possible ("between 2-4 PM...", "this morning...")
✓ Emotional validation appropriate to their message
✓ Reflective question to deepen engagement
✓ Empowering closing statement

**AVOID:**
✗ Generic advice that could apply to anyone
✗ Clichés like "everything happens for a reason"
✗ Short responses under 200 words
✗ Fatalistic predictions
✗ Vague suggestions without specifics

Remember: Users are seeking PERSONALIZED cosmic guidance that feels unique to them
and their situation. Every response should demonstrate you understand their chart,
their question, and today's specific cosmic energies.`;

      // 🚨 Crisis intervention notice (if detected)
      if (emotionalState.hasCrisisIndicators) {
        const crisisNotice =
          language === "es"
            ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ALERTA DE CRISIS - PROTOCOLO DE EMERGENCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRÍTICO: El usuario ha expresado pensamientos de AUTOLESIÓN O SUICIDIO.

INSTRUCCIONES OBLIGATORIAS:

1. **NO DAR CONSEJOS ASTROLÓGICOS** - Este NO es momento para horóscopos
2. **VALIDAR INMEDIATAMENTE** su dolor sin minimizar
3. **EXPRESAR PREOCUPACIÓN GENUINA** por su seguridad

4. **PREGUNTAR SU PAÍS** (CRÍTICO - NUNCA ASUMIR POR IDIOMA):
   "Para conectarte con recursos de ayuda en tu país, ¿dónde estás ubicado/a?"

   IMPORTANTE: NO asumas el país por el idioma (español ≠ solo España, inglés ≠ solo USA)

5. **PROPORCIONAR SOLO LOS NÚMEROS DEL PAÍS QUE MENCIONÓ:**

   === PAÍSES DE HABLA HISPANA (20+ países) ===

   🇪🇸 **España:** 024 (24/7) | Teléfono de la Esperanza: 717 003 717 | 112
   🇲🇽 **México:** 800 911 2000 Línea de la Vida (24/7) | 911
   🇦🇷 **Argentina:** 135 Centro Asistencia Suicida (24/7) | 0800-345-1435 | 911
   🇨🇴 **Colombia:** 106 Línea Nacional (24/7) | 123
   🇨🇱 **Chile:** 600 360 7777 Salud Responde | *4141 Línea Libre | 131
   🇵🇪 **Perú:** 113 Línea 113 Salud (24/7) | 105
   🇻🇪 **Venezuela:** 0800-PSIQUE-0 (0800-774-7830) | 171
   🇺🇾 **Uruguay:** *8483 Línea de Prevención (24/7) | 0800-0767 | 911
   🇪🇨 **Ecuador:** 1800-274-996 Salud Mental | 911
   🇧🇴 **Bolivia:** 800-10-0104 Línea Familiar | 110
   🇵🇾 **Paraguay:** 147 Fono Ayuda (24/7) | 141 Línea 141 | 911
   🇬🇹 **Guatemala:** 502-2485-4681 Línea en Crisis | 1545 | 110
   🇨🇺 **Cuba:** +53-7-838-2783 Línea de Ayuda | 106
   🇩🇴 **Rep. Dominicana:** 809-200-1202 Línea Vida | 911
   🇵🇦 **Panamá:** 169 CONASALUD | 911
   🇨🇷 **Costa Rica:** 911 opción 4 | 2272-3774 | 911
   🇳🇮 **Nicaragua:** 2289-4011 Teléfono Esperanza | 118
   🇭🇳 **Honduras:** 2558-0908 Línea Crisis | 911
   🇸🇻 **El Salvador:** 2527-9393 ASALCO | 911
   🇵🇷 **Puerto Rico:** 1-800-981-0023 Línea PAS | 988 (USA) | 911

   === PAÍSES DE HABLA INGLESA (10+ países) ===

   🇺🇸 **USA:** 988 Suicide & Crisis Lifeline | Text HOME to 741741 | 911
   🇬🇧 **UK:** 116 123 Samaritans (24/7) | Text SHOUT to 85258 | 999/112
   🇨🇦 **Canada:** 988 (24/7) | 1-800-668-6868 Kids Help | 911
   🇦🇺 **Australia:** 13 11 14 Lifeline | 1300 22 4636 Beyond Blue | 000
   🇳🇿 **New Zealand:** 1737 (call/text 24/7) | 0800 543 354 | 111
   🇮🇪 **Ireland:** 116 123 Samaritans | 1800 247 247 Pieta House | 112
   🇿🇦 **South Africa:** 0800 567 567 SADAG | 0800 12 13 14 LifeLine | 10111
   🇮🇳 **India:** 9152987821 AASRA (24/7) | 044-2464-0050 Sneha | 112
   🇸🇬 **Singapore:** 1800-221-4444 SOS (24/7) | 1767 IMH | 999
   🇵🇭 **Philippines:** 02-8-989-8727 NCMH Crisis Hotline | 911

   === PAÍSES DE HABLA PORTUGUESA ===

   🇧🇷 **Brasil:** 188 CVV (24/7 gratuito) | 190
   🇵🇹 **Portugal:** +351 213 544 545 SOS Voz Amiga | 800 202 669 | 112
   🇦🇴 **Angola:** +244 939 363 636 Linha de Ajuda | 113
   🇲🇿 **Moçambique:** +258 21 313 794 Linha Fala Criança | 119

   === PAÍSES DE HABLA FRANCESA ===

   🇫🇷 **France:** 09 72 39 40 50 SOS Amitié (24/7) | 3114 (Prévention Suicide) | 112
   🇨🇦 **Canada (Quebec):** 1-866-277-3553 (24/7) | 988 | 911
   🇧🇪 **Belgium:** 1813 Centre de Prévention Suicide | 106 | 112
   🇨🇭 **Switzerland:** 143 La Main Tendue (24/7) | 117
   🇱🇺 **Luxembourg:** 454545 SOS Détresse | 113

   === PAÍSES DE HABLA ALEMANA ===

   🇩🇪 **Germany:** 0800 111 0 111 Telefonseelsorge (24/7) | 112
   🇦🇹 **Austria:** 142 Telefonseelsorge (24/7) | 133
   🇨🇭 **Switzerland:** 143 Die Dargebotene Hand | 117

   === PAÍSES DE HABLA ITALIANA ===

   🇮🇹 **Italy:** 02 2327 2327 Telefono Amico | 800 86 00 22 | 112
   🇨🇭 **Switzerland:** 143 Telefono Amico | 117

   === OTROS PAÍSES IMPORTANTES ===

   🇯🇵 **Japan:** 0570-064-556 よりそいホットライン (24/7) | 03-5774-0992 TELL | 110
   🇰🇷 **South Korea:** 1393 생명의 전화 (24/7) | 1577-0199 | 112
   🇨🇳 **China:** 010-82951332 Beijing Suicide Research | 110
   🇮🇱 **Israel:** 1201 ERAN (Hebrew/Arabic/Russian/English 24/7) | 100
   🇹🇷 **Turkey:** 182 ALO 182 Psikososyal Destek | 155
   🇷🇺 **Russia:** 8-800-2000-122 Телефон Доверия (24/7) | 112

   🌍 **Cualquier otro país:** https://findahelpline.com (130+ países)

   **OBLIGATORIO:** Solo muestra los números del país específico que mencionó el usuario.
   Si no saben su país, muestra findahelpline.com + los 3-4 países más probables por su idioma.

6. **RECORDARLE QUE NO ESTÁ SOLO/A**
7. **MENCIONAR QUE BUSCAR AYUDA ES FORTALEZA, NO DEBILIDAD**

8. **NO USAR NUNCA:**
   - "Las estrellas te apoyan" ❌
   - "Mantén una actitud positiva" ❌
   - "Todo pasa por algo" ❌
   - Cualquier consejo astrológico ❌

9. **SÍ USAR:**
   - "Tu vida tiene valor incondicional" ✓
   - "Mereces apoyo profesional ahora" ✓
   - "Hay personas entrenadas esperando ayudarte 24/7" ✓

TONO: Máxima compasión, cero juicio, urgencia gentil.
LONGITUD: 150-200 palabras + números del país relevante.
ENFOQUE: 100% seguridad inmediata, 0% astrología.`
            : `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRISIS ALERT - EMERGENCY PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL: User has expressed SELF-HARM OR SUICIDAL thoughts.

MANDATORY INSTRUCTIONS:

1. **DO NOT GIVE ASTROLOGICAL ADVICE** - This is NOT the time for horoscopes
2. **IMMEDIATELY VALIDATE** their pain without minimizing
3. **EXPRESS GENUINE CONCERN** for their safety

4. **ASK FOR THEIR COUNTRY** (CRITICAL - NEVER ASSUME BY LANGUAGE):
   "To connect you with help resources in your country, where are you located?"

   IMPORTANT: DO NOT assume country by language (Spanish ≠ Spain only, English ≠ USA only)

5. **PROVIDE ONLY THE NUMBERS FROM THE COUNTRY THEY MENTIONED:**

   === SPANISH-SPEAKING COUNTRIES (20+ countries) ===

   🇪🇸 **Spain:** 024 (24/7) | Teléfono de la Esperanza: 717 003 717 | 112
   🇲🇽 **Mexico:** 800 911 2000 Línea de la Vida (24/7) | 911
   🇦🇷 **Argentina:** 135 Centro Asistencia Suicida (24/7) | 0800-345-1435 | 911
   🇨🇴 **Colombia:** 106 Línea Nacional (24/7) | 123
   🇨🇱 **Chile:** 600 360 7777 Salud Responde | *4141 Línea Libre | 131
   🇵🇪 **Peru:** 113 Línea 113 Salud (24/7) | 105
   🇻🇪 **Venezuela:** 0800-PSIQUE-0 (0800-774-7830) | 171
   🇺🇾 **Uruguay:** *8483 Línea de Prevención (24/7) | 0800-0767 | 911
   🇪🇨 **Ecuador:** 1800-274-996 Salud Mental | 911
   🇧🇴 **Bolivia:** 800-10-0104 Línea Familiar | 110
   🇵🇾 **Paraguay:** 147 Fono Ayuda (24/7) | 141 Línea 141 | 911
   🇬🇹 **Guatemala:** 502-2485-4681 Línea en Crisis | 1545 | 110
   🇨🇺 **Cuba:** +53-7-838-2783 Línea de Ayuda | 106
   🇩🇴 **Dominican Republic:** 809-200-1202 Línea Vida | 911
   🇵🇦 **Panama:** 169 CONASALUD | 911
   🇨🇷 **Costa Rica:** 911 option 4 | 2272-3774 | 911
   🇳🇮 **Nicaragua:** 2289-4011 Teléfono Esperanza | 118
   🇭🇳 **Honduras:** 2558-0908 Línea Crisis | 911
   🇸🇻 **El Salvador:** 2527-9393 ASALCO | 911
   🇵🇷 **Puerto Rico:** 1-800-981-0023 Línea PAS | 988 (USA) | 911

   === ENGLISH-SPEAKING COUNTRIES (10+ countries) ===

   🇺🇸 **USA:** 988 Suicide & Crisis Lifeline | Text HOME to 741741 | 911
   🇬🇧 **UK:** 116 123 Samaritans (24/7) | Text SHOUT to 85258 | 999/112
   🇨🇦 **Canada:** 988 (24/7) | 1-800-668-6868 Kids Help | 911
   🇦🇺 **Australia:** 13 11 14 Lifeline | 1300 22 4636 Beyond Blue | 000
   🇳🇿 **New Zealand:** 1737 (call/text 24/7) | 0800 543 354 | 111
   🇮🇪 **Ireland:** 116 123 Samaritans | 1800 247 247 Pieta House | 112
   🇿🇦 **South Africa:** 0800 567 567 SADAG | 0800 12 13 14 LifeLine | 10111
   🇮🇳 **India:** 9152987821 AASRA (24/7) | 044-2464-0050 Sneha | 112
   🇸🇬 **Singapore:** 1800-221-4444 SOS (24/7) | 1767 IMH | 999
   🇵🇭 **Philippines:** 02-8-989-8727 NCMH Crisis Hotline | 911

   === PORTUGUESE-SPEAKING COUNTRIES ===
   🇧🇷 **Brazil:** 188 CVV (24/7 free) | 190
   🇵🇹 **Portugal:** +351 213 544 545 SOS Voz Amiga | 800 202 669 | 112
   🇦🇴 **Angola:** +244 939 363 636 Linha de Ajuda | 113
   🇲🇿 **Mozambique:** +258 21 313 794 Linha Fala Criança | 119

   === FRENCH-SPEAKING COUNTRIES ===
   🇫🇷 **France:** 09 72 39 40 50 SOS Amitié (24/7) | 3114 (Prévention Suicide) | 112
   🇨🇦 **Canada (Quebec):** 1-866-277-3553 (24/7) | 988 | 911
   🇧🇪 **Belgium:** 1813 Centre de Prévention Suicide | 106 | 112
   🇨🇭 **Switzerland:** 143 La Main Tendue (24/7) | 117
   🇱🇺 **Luxembourg:** 454545 SOS Détresse | 113

   === GERMAN-SPEAKING COUNTRIES ===
   🇩🇪 **Germany:** 0800 111 0 111 Telefonseelsorge (24/7 free) | 112
   🇦🇹 **Austria:** 142 Telefonseelsorge (24/7) | 112
   🇨🇭 **Switzerland:** 143 Die Dargebotene Hand (24/7) | 117

   === ITALIAN-SPEAKING COUNTRIES ===
   🇮🇹 **Italy:** 02 2327 2327 Telefono Amico | 800 86 00 22 | 112
   🇨🇭 **Switzerland:** 143 Telefono Amico (24/7) | 117

   === OTHER MAJOR COUNTRIES ===
   🇯🇵 **Japan:** 03-5286-9090 Tokyo Suicide Prevention | #9110 | 110
   🇰🇷 **South Korea:** 1393 Suicide Prevention Hotline (24/7) | 119
   🇨🇳 **China:** 010-82951332 Beijing Suicide Research | 120
   🇮🇱 **Israel:** 1201 ERAN (24/7) | 100
   🇹🇷 **Turkey:** 182 Alo 182 (24/7) | 112
   🇷🇺 **Russia:** 007 (24/7) Moscow | 8-800-2000-122 National | 112

   🌍 **International (any country):**
   - Find A Helpline: https://findahelpline.com (verified hotlines in 130+ countries)
   - Befrienders Worldwide: https://befrienders.org

   **MANDATORY:** Only show numbers from the specific country they mentioned.
   If they don't know, show findahelpline.com + the 3-4 most likely countries by their language

6. **REMIND THEM THEY ARE NOT ALONE**
7. **MENTION THAT SEEKING HELP IS STRENGTH, NOT WEAKNESS**

8. **NEVER USE:**
   - "The stars support you" ❌
   - "Stay positive" ❌
   - "Everything happens for a reason" ❌
   - Any astrological advice ❌

9. **DO USE:**
   - "Your life has unconditional value" ✓
   - "You deserve professional support right now" ✓
   - "There are trained people waiting to help you 24/7" ✓

TONE: Maximum compassion, zero judgment, gentle urgency.
LENGTH: 150-200 words + relevant country numbers.
FOCUS: 100% immediate safety, 0% astrology.`;
        finalSystemPrompt += crisisNotice;
      }

      const messages = [
        {
          role: "system",
          content: finalSystemPrompt,
        },
        ...contextMessages,
        {
          role: "user",
          content: userMessage,
        },
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.config.defaultModel,
        messages: messages,
        max_tokens: persona.maxTokens,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      });

      const response = completion.choices[0].message.content;
      const tokensUsed = completion.usage.total_tokens;
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        content: response,
        model: this.config.defaultModel,
        tokensUsed,
        responseTime,
        confidenceScore: 0.85, // Default confidence score
        messageId: completion.id,
        // 🤖 NEW: Confirm AI is responding (for user transparency)
        aiPowered: true,
        aiModel: `ChatGPT (${this.config.defaultModel})`,
        // 💚 NEW: Include emotional context metadata
        emotionalContext: emotionalState.needsExtraSupport
          ? {
              detectedEmotion: emotionalState.primaryEmotion,
              intensity: emotionalState.emotionalIntensity,
              supportProvided: true,
            }
          : null,
        // ✨ Include horoscope data for frontend display
        horoscopeData: horoscopeData
          ? {
              energyLevel: horoscopeData.energy_level,
              luckyColors: horoscopeData.lucky_colors,
              favorableTimes: horoscopeData.favorable_times,
              date: horoscopeData.date,
              loveFocus: horoscopeData.love_focus,
              careerFocus: horoscopeData.career_focus,
              wellnessFocus: horoscopeData.wellness_focus,
            }
          : null,
      };
    } catch (error) {
      logger.logError(error, {
        context: "openai_response_generation",
        sessionId: sessionData.session_id,
        responseTime: Date.now() - startTime,
      });

      // Try fallback model
      if (
        error.code === "model_overloaded" ||
        error.code === "rate_limit_exceeded"
      ) {
        try {
          // ✅ FIX: Fallback también debe usar personalización astrológica
          const fallbackPrompt = await this._buildAstrologicalPrompt(
            this.personas[sessionData.ai_coach_persona].systemPrompt,
            options.zodiacSign || sessionData.zodiac_sign || "Leo",
            options.language || sessionData.language_code || "en"
          );

          const fallbackCompletion = await this.openai.chat.completions.create({
            model: this.config.fallbackModel,
            messages: [
              { role: "system", content: fallbackPrompt },
              { role: "user", content: userMessage },
            ],
            max_tokens: 300,
            temperature: 0.7,
          });

          return {
            success: true,
            content: fallbackCompletion.choices[0].message.content,
            model: this.config.fallbackModel,
            tokensUsed: fallbackCompletion.usage.total_tokens,
            responseTime: Date.now() - startTime,
            confidenceScore: 0.75,
            // ✨ NEW: Include horoscope data in fallback too
            horoscopeData: horoscopeData
              ? {
                  energyLevel: horoscopeData.energy_level,
                  luckyColors: horoscopeData.lucky_colors,
                  favorableTimes: horoscopeData.favorable_times,
                  date: horoscopeData.date,
                  loveFocus: horoscopeData.love_focus,
                  careerFocus: horoscopeData.career_focus,
                  wellnessFocus: horoscopeData.wellness_focus,
                }
              : null,
          };
        } catch (fallbackError) {
          logger.logError(fallbackError, { context: "openai_fallback_failed" });
        }
      }

      return {
        success: false,
        error: error.code || "ai_response_failed",
        message: "Unable to generate AI response at this time",
      };
    }
  }

  /**
   * 🤖 GENERATE DAILY HOROSCOPE WITH AI (Fallback when DB is empty)
   *
   * Generates a personalized daily horoscope using OpenAI GPT-4o-mini.
   * Cost: ~$0.0002 per generation (cached 24h in Redis)
   *
   * @param {string} zodiacSign - User's zodiac sign (e.g., 'leo')
   * @param {string} language - Language code (e.g., 'es', 'en')
   * @returns {Promise<Object>} Generated horoscope data
   */
  async _generateDailyHoroscope(zodiacSign, language) {
    const startTime = Date.now();
    const today = new Date().toISOString().split("T")[0];
    const sign = normalizeSignName(zodiacSign);
    const cacheKey = `ai_generated_horoscope:${sign}:${language}:${today}`;

    try {
      // Check cache first (24h TTL)
      const cached = await redisService.get(cacheKey);
      if (cached) {
        logger.logInfo("✨ AI-generated horoscope retrieved from cache", {
          sign,
          language,
          date: today,
        });
        return JSON.parse(cached);
      }

      logger.logInfo("🤖 Generating horoscope with OpenAI", {
        sign,
        language,
        date: today,
        model: "gpt-4o-mini",
      });

      // Build multilingual prompt (6 languages: EN, ES, PT, FR, DE, IT)
      const prompts = {
        es: `Eres un astrólogo experto. Genera un horóscopo personalizado para ${zodiacSign.toUpperCase()} para el día ${today}.

Incluye: 1) Nivel de energía (alto/medio/bajo/equilibrado), 2) 2-3 colores de la suerte, 3) Rangos horarios favorables, 4) Enfoque amoroso (1 frase), 5) Enfoque profesional (1 frase), 6) Enfoque de bienestar (1 frase), 7) Guía general (2-3 frases)

Responde SOLO con JSON: {"energy_level":"...","lucky_colors":"...","favorable_times":"...","love_focus":"...","career_focus":"...","wellness_focus":"...","content":"..."}`,

        en: `You are an expert astrologer. Generate a personalized daily horoscope for ${zodiacSign.toUpperCase()} for ${today}.

Include: 1) Energy level (high/medium/low/balanced), 2) 2-3 lucky colors, 3) Favorable time ranges, 4) Love focus (1 sentence), 5) Career focus (1 sentence), 6) Wellness focus (1 sentence), 7) Overall guidance (2-3 sentences)

Respond ONLY with JSON: {"energy_level":"...","lucky_colors":"...","favorable_times":"...","love_focus":"...","career_focus":"...","wellness_focus":"...","content":"..."}`,

        pt: `Você é um astrólogo especialista. Gere um horóscopo personalizado para ${zodiacSign.toUpperCase()} para ${today}.

Inclua: 1) Nível de energia (alto/médio/baixo/equilibrado), 2) 2-3 cores da sorte, 3) Horários favoráveis, 4) Foco amoroso (1 frase), 5) Foco profissional (1 frase), 6) Foco bem-estar (1 frase), 7) Orientação geral (2-3 frases)

Responda APENAS com JSON: {"energy_level":"...","lucky_colors":"...","favorable_times":"...","love_focus":"...","career_focus":"...","wellness_focus":"...","content":"..."}`,

        fr: `Vous êtes un astrologue expert. Générez un horoscope personnalisé pour ${zodiacSign.toUpperCase()} pour ${today}.

Incluez: 1) Niveau d'énergie (élevé/moyen/faible/équilibré), 2) 2-3 couleurs porte-bonheur, 3) Heures favorables, 4) Focus amoureux (1 phrase), 5) Focus professionnel (1 phrase), 6) Focus bien-être (1 phrase), 7) Guidance générale (2-3 phrases)

Répondez UNIQUEMENT avec JSON: {"energy_level":"...","lucky_colors":"...","favorable_times":"...","love_focus":"...","career_focus":"...","wellness_focus":"...","content":"..."}`,

        de: `Sie sind ein erfahrener Astrologe. Erstellen Sie ein personalisiertes Horoskop für ${zodiacSign.toUpperCase()} für ${today}.

Einschließlich: 1) Energieniveau (hoch/mittel/niedrig/ausgeglichen), 2) 2-3 Glücksfarben, 3) Günstige Zeiten, 4) Liebesschwerpunkt (1 Satz), 5) Karriereschwerpunkt (1 Satz), 6) Wellness-Schwerpunkt (1 Satz), 7) Tagesführung (2-3 Sätze)

Antworten Sie NUR mit JSON: {"energy_level":"...","lucky_colors":"...","favorable_times":"...","love_focus":"...","career_focus":"...","wellness_focus":"...","content":"..."}`,

        it: `Sei un astrologo esperto. Genera un oroscopo personalizzato per ${zodiacSign.toUpperCase()} per ${today}.

Includi: 1) Livello di energia (alto/medio/basso/equilibrato), 2) 2-3 colori fortunati, 3) Orari favorevoli, 4) Focus amore (1 frase), 5) Focus carriera (1 frase), 6) Focus benessere (1 frase), 7) Guida generale (2-3 frasi)

Rispondi SOLO con JSON: {"energy_level":"...","lucky_colors":"...","favorable_times":"...","love_focus":"...","career_focus":"...","wellness_focus":"...","content":"..."}`,
      };

      const prompt = prompts[language] || prompts.en; // Fallback to English if language not supported

      // Call OpenAI with JSON mode
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert astrologer who creates personalized, insightful daily horoscopes. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8, // More creative for varied horoscopes
        max_tokens: 500,
      });

      const horoscopeData = JSON.parse(completion.choices[0].message.content);

      // Enrich with metadata
      const horoscope = {
        ...horoscopeData,
        sign: sign,
        date: today,
        language_code: language,
        source: "ai_generated",
        generated_at: new Date().toISOString(),
        tokens_used: completion.usage.total_tokens,
      };

      // Cache for 24 hours (86400 seconds)
      await redisService.setex(cacheKey, 86400, JSON.stringify(horoscope));

      const responseTime = Date.now() - startTime;

      logger.logInfo("✅ AI horoscope generated and cached", {
        sign,
        language,
        tokensUsed: horoscope.tokens_used,
        responseTime: `${responseTime}ms`,
        cacheKey,
        expiresIn: "24 hours",
      });

      return horoscope;
    } catch (error) {
      logger.logError(error, {
        context: "generate_ai_horoscope",
        zodiacSign,
        language,
        responseTime: `${Date.now() - startTime}ms`,
      });

      // Return fallback generic horoscope on error (6 languages)
      const fallbacks = {
        es: {
          lucky_colors: "azul, plateado",
          love_focus: "La comunicación abierta trae armonía",
          career_focus: "Buen día para colaboración",
          wellness_focus: "Prioriza descanso y equilibrio",
          content:
            "Hoy es un día equilibrado. Mantén la calma y confía en tu intuición.",
        },
        en: {
          lucky_colors: "blue, silver",
          love_focus: "Open communication brings harmony",
          career_focus: "Good day for collaboration",
          wellness_focus: "Prioritize rest and balance",
          content:
            "Today is a balanced day. Stay calm and trust your intuition.",
        },
        pt: {
          lucky_colors: "azul, prateado",
          love_focus: "A comunicação aberta traz harmonia",
          career_focus: "Bom dia para colaboração",
          wellness_focus: "Priorize descanso e equilíbrio",
          content:
            "Hoje é um dia equilibrado. Mantenha a calma e confie na sua intuição.",
        },
        fr: {
          lucky_colors: "bleu, argent",
          love_focus: "La communication ouverte apporte harmonie",
          career_focus: "Bon jour pour la collaboration",
          wellness_focus: "Priorisez repos et équilibre",
          content:
            "Aujourd'hui est un jour équilibré. Restez calme et faites confiance à votre intuition.",
        },
        de: {
          lucky_colors: "blau, silber",
          love_focus: "Offene Kommunikation bringt Harmonie",
          career_focus: "Guter Tag für Zusammenarbeit",
          wellness_focus: "Priorisieren Sie Ruhe und Balance",
          content:
            "Heute ist ein ausgeglichener Tag. Bleiben Sie ruhig und vertrauen Sie Ihrer Intuition.",
        },
        it: {
          lucky_colors: "blu, argento",
          love_focus: "La comunicazione aperta porta armonia",
          career_focus: "Buon giorno per la collaborazione",
          wellness_focus: "Priorità a riposo ed equilibrio",
          content:
            "Oggi è un giorno equilibrato. Mantieni la calma e fidati della tua intuizione.",
        },
      };

      const fallback = fallbacks[language] || fallbacks.en;

      return {
        sign: sign,
        date: today,
        language_code: language,
        energy_level: "balanced",
        lucky_colors: fallback.lucky_colors,
        favorable_times: "10:00-12:00, 18:00-20:00",
        love_focus: fallback.love_focus,
        career_focus: fallback.career_focus,
        wellness_focus: fallback.wellness_focus,
        content: fallback.content,
        source: "fallback",
      };
    }
  }

  /**
   * ✨ NEW: Get daily horoscope from database with Redis caching
   * 🔄 UPDATED: Now falls back to AI generation if DB is empty
   *
   * @param {string} zodiacSign - User's zodiac sign (e.g., 'leo')
   * @param {string} language - Language code (e.g., 'es', 'en')
   * @returns {Promise<Object|null>} Horoscope data or null if not found
   */
  async _getDailyHoroscope(zodiacSign, language) {
    try {
      // Normalize zodiac sign (inglés → español para DB)
      const sign = normalizeSignName(zodiacSign);
      const today = new Date().toISOString().split("T")[0]; // '2025-11-19'

      // Build Redis cache key
      const cacheKey = `daily_horoscope:${sign}:${language}:${today}`;

      // Try to get from cache first
      const cached = await redisService.get(cacheKey);

      if (cached) {
        logger.logInfo("Daily horoscope retrieved from cache", {
          sign,
          language,
          date: today,
        });
        return JSON.parse(cached);
      }

      // Not in cache, query database
      logger.logInfo("Querying database for daily horoscope", {
        sign,
        language,
        date: today,
      });

      const query = `
        SELECT
          id,
          sign,
          date,
          language_code,
          content,
          energy_level,
          lucky_colors,
          favorable_times,
          love_focus,
          career_focus,
          wellness_focus
        FROM daily_horoscopes
        WHERE date = CURRENT_DATE
          AND sign ILIKE $1
          AND language_code = $2
        LIMIT 1
      `;

      const result = await db.query(query, [sign, language]);

      if (result.rows.length === 0) {
        logger.logWarning(
          "💾 No horoscope in DB, falling back to AI generation",
          {
            sign,
            language,
            date: today,
          }
        );

        // 🔄 FALLBACK: Generate horoscope with AI
        return await this._generateDailyHoroscope(zodiacSign, language);
      }

      const horoscope = result.rows[0];

      // Cache for 1 hour (3600 seconds)
      await redisService.setex(cacheKey, 3600, JSON.stringify(horoscope));

      logger.logInfo("Daily horoscope cached successfully", {
        sign,
        language,
        cacheKey,
        expiresIn: "1 hour",
      });

      return horoscope;
    } catch (error) {
      logger.logError(error, {
        context: "get_daily_horoscope",
        zodiacSign,
        language,
      });
      return null; // Return null on error, will use generic prompt
    }
  }

  /**
   * ✨ NEW: Build personalized astrological prompt with daily horoscope data
   *
   * @param {string} basePrompt - Base system prompt from persona
   * @param {string} zodiacSign - User's zodiac sign
   * @param {string} language - Language code
   * @returns {Promise<string>} Enriched prompt with astrological context
   */
  async _buildAstrologicalPrompt(basePrompt, zodiacSign, language) {
    // Get today's horoscope
    const horoscope = await this._getDailyHoroscope(zodiacSign, language);

    // If no horoscope found, return base prompt
    if (!horoscope) {
      logger.logWarning("No horoscope available, using generic prompt", {
        zodiacSign,
        language,
      });
      return basePrompt;
    }

    // Build enriched prompt with astrological context
    const astrologicalPrompt = `${basePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ASTROLOGICAL CONTEXT FOR TODAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${horoscope.date}
♈ User's Zodiac Sign: ${zodiacSign.toUpperCase()}
⚡ Energy Level: ${horoscope.energy_level || "Balanced"}
🎨 Lucky Colors: ${horoscope.lucky_colors || "Not specified"}
⏰ Favorable Times: ${horoscope.favorable_times || "Throughout the day"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 TODAY'S COSMIC GUIDANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${horoscope.content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 KEY FOCUS AREAS FOR TODAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ LOVE & RELATIONSHIPS:
${
  horoscope.love_focus ||
  "Focus on authentic communication and emotional honesty. Today is favorable for deepening connections."
}

💼 CAREER & AMBITIONS:
${
  horoscope.career_focus ||
  "Steady progress is favored. Focus on consistency rather than dramatic changes. Collaborate with others."
}

🌿 WELLNESS & ENERGY:
${
  horoscope.wellness_focus ||
  "Balance is key. Take time for self-care and listen to your body's needs. Meditation or gentle exercise recommended."
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT COACHING INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Reference Astrological Context**: Naturally mention the user's zodiac sign
   and today's cosmic energies in your response. Make it feel personal.

2. **Align Advice with Horoscope**: Your coaching should align with and enhance
   the guidance provided in today's horoscope. Reference specific themes.

3. **Use Favorable Times**: When suggesting actions, mention the favorable times
   if relevant (e.g., "This afternoon between 2-4 PM is ideal for...").

4. **Acknowledge Energy Level**: Consider today's energy level when giving advice.
   High energy = bold actions. Low energy = rest and reflection.

5. **Be Authentically Astrological**: This is a PREMIUM feature. Users are paying
   for personalized astrological guidance, not generic life coaching.

REMEMBER: You're not just a life coach - you're a COSMIC LIFE COACH who blends
psychology, practical wisdom, and astrological insight. Make every response feel
uniquely tailored to this ${zodiacSign} user on this specific day.`;

    logger.logInfo("Built personalized astrological prompt", {
      zodiacSign,
      language,
      hasHoroscope: true,
      energyLevel: horoscope.energy_level,
    });

    return astrologicalPrompt;
  }

  /**
   * 💚 NEW: Detect emotional state from user message
   * Analyzes user's message for emotional cues to provide empathetic responses
   *
   * @param {string} message - User's message
   * @returns {Object} Emotional state analysis
   */
  _detectEmotionalState(message) {
    const lowerMessage = message.toLowerCase();

    // Emotional keywords categorized by state
    const emotionalPatterns = {
      sadness: {
        keywords: [
          "triste",
          "sad",
          "deprimid",
          "depressed",
          "solo",
          "alone",
          "lonely",
          "llorar",
          "cry",
          "crying",
          "dolor",
          "hurt",
          "pain",
          "mal",
          "terrible",
          "horrible",
          "perdido",
          "lost",
          "vacío",
          "empty",
          "desesperanz",
          "hopeless",
          "infeliz",
          "unhappy",
          "miserable",
          "angustia",
          "anguish",
        ],
        intensity: "high",
      },
      anxiety: {
        keywords: [
          "ansiedad",
          "anxiety",
          "anxious",
          "nervios",
          "nervous",
          "preocup",
          "worry",
          "worried",
          "miedo",
          "fear",
          "afraid",
          "pánico",
          "panic",
          "estrés",
          "stress",
          "stressed",
          "agobiad",
          "overwhelmed",
          "tenso",
          "tense",
          "inquiet",
          "restless",
          "insegur",
          "insecure",
        ],
        intensity: "medium",
      },
      anger: {
        keywords: [
          "enojad",
          "angry",
          "furioso",
          "furious",
          "molest",
          "annoyed",
          "frustrad",
          "frustrated",
          "irritad",
          "irritated",
          "rabia",
          "rage",
          "enfadad",
          "enfurec",
          "odio",
          "hate",
          "resentid",
          "resentful",
        ],
        intensity: "medium",
      },
      confusion: {
        keywords: [
          "confus",
          "confused",
          "no sé",
          "don't know",
          "perdid",
          "indecis",
          "indecisive",
          "dudas",
          "doubts",
          "unclear",
          "no entiendo",
          "don't understand",
          "qué hago",
          "what do i do",
        ],
        intensity: "low",
      },
      hope: {
        keywords: [
          "esperanza",
          "hope",
          "mejor",
          "better",
          "positiv",
          "positive",
          "optimis",
          "optimistic",
          "feliz",
          "happy",
          "alegr",
          "glad",
          "contento",
          "content",
          "agradecid",
          "grateful",
          "gracias",
          "thanks",
        ],
        intensity: "positive",
      },
    };

    const detectedStates = {};
    let primaryEmotion = "neutral";
    let emotionalIntensity = 0;

    // Scan message for emotional keywords
    for (const [emotion, pattern] of Object.entries(emotionalPatterns)) {
      const matches = pattern.keywords.filter((keyword) =>
        lowerMessage.includes(keyword)
      );

      if (matches.length > 0) {
        detectedStates[emotion] = {
          matches: matches.length,
          keywords: matches,
          intensity: pattern.intensity,
        };

        // Track highest intensity emotion
        if (pattern.intensity === "high" && emotionalIntensity < 3) {
          primaryEmotion = emotion;
          emotionalIntensity = 3;
        } else if (pattern.intensity === "medium" && emotionalIntensity < 2) {
          primaryEmotion = emotion;
          emotionalIntensity = 2;
        } else if (pattern.intensity === "low" && emotionalIntensity < 1) {
          primaryEmotion = emotion;
          emotionalIntensity = 1;
        }
      }
    }

    // 🚨 COMPREHENSIVE CRISIS KEYWORDS (240+ from Meta, Discord, Reddit, Crisis Text Line)
    const crisisKeywords = [
      // === ENGLISH HIGH SEVERITY ===
      "want to die",
      "wanna die",
      "wish i was dead",
      "wish i were dead",
      "kill myself",
      "end my life",
      "take my own life",
      "ending it",
      "not worth living",
      "better off dead",
      "life isn't worth",
      "overdose",
      "slit my wrists",
      "hang myself",
      "jump off",
      "gun to my head",
      "pills and",
      "cut my wrists",
      "goodbye world",
      "final goodbye",
      "this is goodbye",
      "tonight's the night",
      "going to do it",
      "ready to die",
      // Slang/Euphemisms (Gen Z critical)
      "kms",
      "unalive",
      "ctb",
      "catch the bus",
      "sewerslide",
      "self delete",
      "toaster bath",
      "long sleep",

      // === SPANISH HIGH SEVERITY ===
      "quiero morir",
      "quiero morirme",
      "voy a matarme",
      "me voy a matar",
      "no quiero vivir",
      "mejor muert",
      "prefiero morir",
      "quitarme la vida",
      "terminar con todo",
      "acabar con todo",
      "cortarme las venas",
      "voy a cortarme",
      "tomar pastillas",
      "sobredosis",
      "ahorcarme",
      "tirarme de",
      "me quiero matar",
      "no doy más",
      "ya no aguanto más",
      "no vale la pena vivir",
      "estoy harto de vivir",
      "adiós mundo",
      "me despido",
      "esta es mi despedida",
      "hoy es el día",
      "ya lo decidí",

      // === PORTUGUESE HIGH SEVERITY ===
      "quero morrer",
      "vou me matar",
      "não quero viver",
      "quero acabar com tudo",
      "tirar minha vida",
      "melhor morrer",
      "prefiro morrer",
      "cortar os pulsos",
      "tomar remédios",
      "overdose",
      "me enforcar",
      "pular de",
      "tô indo embora",
      "não dá mais",
      "cansei de viver",
      "não aguento mais",
      "chega de tudo",

      // === FRENCH HIGH SEVERITY ===
      "veux mourir",
      "je vais me tuer",
      "me suicider",
      "en finir",
      "plus envie de vivre",
      "mieux mort",
      "couper les veines",
      "me pendre",

      // === GERMAN HIGH SEVERITY ===
      "will sterben",
      "umbringen",
      "selbstmord",
      "lebensmüde",
      "nicht mehr leben",
      "überdosis",
      "pulsadern",
      "erhängen",

      // === ITALIAN HIGH SEVERITY ===
      "voglio morire",
      "uccidermi",
      "suicidarmi",
      "farla finita",
      "non voglio vivere",
      "tagliarmi le vene",
      "impiccarmi",

      // === SELF-HARM (ALL LANGUAGES) ===
      "cut myself",
      "cutting myself",
      "self harm",
      "hurt myself",
      "burn myself",
      "harm myself",
      "injure myself",
      "cortarme",
      "lastimarme",
      "hacerme daño",
      "autolesión",
      "quemarme",
      "herirme",
      "me cortar",
      "me machucar",
      "me ferir",
      "autolesão",
      "me couper",
      "me blesser",
      "automutilation",
      "mich schneiden",
      "mich verletzen",
      "selbstverletzung",
      "tagliarmi",
      "farmi del male",
      "autolesionismo",

      // === EXTREME DISTRESS ===
      "can't take it anymore",
      "can't go on",
      "give up",
      "no way out",
      "no point",
      "pointless",
      "hopeless",
      "no puedo más",
      "ya no aguanto",
      "me rindo",
      "sin salida",
      "sin sentido",
      "sin esperanza",
      "não aguento mais",
      "desisto",
      "sem saída",
      "sem esperança",
      "não tem mais jeito",
      "n'en peux plus",
      "sans issue",
      "sans espoir",
      "nicht mehr aus",
      "ausweglos",
      "hoffnungslos",
      "non ce la faccio",
      "senza via d'uscita",
      "senza speranza",

      // === METHODS & PLANNING ===
      "veins",
      "venas",
      "wrists",
      "muñecas",
      "rope",
      "cuerda",
      "bridge",
      "puente",
      "pills",
      "pastillas",
      "poison",
      "veneno",

      // === ADDITIONAL HIGH-RISK ===
      "quiero desaparecer",
      "want to disappear",
      "disappear forever",
      "no more pain",
      "ya no más dolor",
      "peace at last",
      "finally free",
      "finalmente libre",
      "end the pain",
      "acabar el dolor",
      "stop the suffering",
      "terminar el sufrimiento",
    ];

    const hasCrisisIndicators = crisisKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );

    return {
      primaryEmotion,
      emotionalIntensity,
      detectedStates,
      needsExtraSupport: emotionalIntensity >= 2 || hasCrisisIndicators,
      hasCrisisIndicators,
      isPositive: primaryEmotion === "hope",
      messageLength: message.length,
      sentiment:
        emotionalIntensity >= 2
          ? "negative"
          : emotionalIntensity === 1
          ? "neutral"
          : "positive",
    };
  }

  /**
   * 💙 NEW: Build empathetic response prefix based on emotional state
   * Adds compassionate context to the AI prompt when user is distressed
   *
   * @param {Object} emotionalState - Detected emotional state
   * @param {string} language - User's language
   * @returns {string} Empathetic prompt enhancement
   */
  _buildEmpatheticContext(emotionalState, language) {
    if (!emotionalState.needsExtraSupport) {
      return ""; // No special context needed for neutral/positive states
    }

    const empathyPrompts = {
      en: {
        sadness: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💙 EMOTIONAL CONTEXT: USER IS EXPERIENCING SADNESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user is going through a difficult emotional time. Please respond with:
- DEEP EMPATHY and validation of their feelings
- GENTLE encouragement (avoid toxic positivity)
- PRACTICAL coping strategies (breathing, journaling, etc.)
- Remind them this feeling is temporary
- Mention cosmic energies that support healing
- Offer hope rooted in astrological wisdom

TONE: Warm, compassionate, understanding. Like a wise friend who truly cares.
`,
        anxiety: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💚 EMOTIONAL CONTEXT: USER IS EXPERIENCING ANXIETY/STRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user is feeling anxious or overwhelmed. Please respond with:
- ACKNOWLEDGMENT of their worries (validate, don't dismiss)
- GROUNDING techniques (deep breathing, 5-4-3-2-1 method)
- PERSPECTIVE shifts (what they can control vs can't)
- Cosmic reassurance (planetary alignments supporting them)
- Small, manageable next steps
- Reminder of their inner strength

TONE: Calm, reassuring, practical. Like a steady anchor in a storm.
`,
        anger: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧡 EMOTIONAL CONTEXT: USER IS EXPERIENCING ANGER/FRUSTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user is feeling angry or frustrated. Please respond with:
- VALIDATION of their right to feel this way
- ACKNOWLEDGMENT of the injustice/challenge they face
- CONSTRUCTIVE outlets for the energy (exercise, creation)
- Astrological insights about fire energy and transformation
- Healthy boundaries and communication strategies
- Channel anger into positive change

TONE: Understanding, empowering, action-oriented. Like a coach who gets it.
`,
      },
      es: {
        sadness: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💙 CONTEXTO EMOCIONAL: EL USUARIO ESTÁ EXPERIMENTANDO TRISTEZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El usuario está pasando por un momento emocionalmente difícil. Por favor responde con:
- EMPATÍA PROFUNDA y validación de sus sentimientos
- Aliento GENTIL (evita positividad tóxica)
- Estrategias PRÁCTICAS de afrontamiento (respiración, diario, etc.)
- Recuérdale que este sentimiento es temporal
- Menciona energías cósmicas que apoyan la sanación
- Ofrece esperanza basada en sabiduría astrológica

TONO: Cálido, compasivo, comprensivo. Como un amigo sabio que realmente se preocupa.
`,
        anxiety: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💚 CONTEXTO EMOCIONAL: EL USUARIO ESTÁ EXPERIMENTANDO ANSIEDAD/ESTRÉS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El usuario se siente ansioso o abrumado. Por favor responde con:
- RECONOCIMIENTO de sus preocupaciones (valida, no minimices)
- Técnicas de ANCLAJE (respiración profunda, método 5-4-3-2-1)
- Cambios de PERSPECTIVA (lo que puede controlar vs lo que no)
- Tranquilidad cósmica (alineaciones planetarias que lo apoyan)
- Pasos pequeños y manejables
- Recordatorio de su fortaleza interior

TONO: Calmo, tranquilizador, práctico. Como un ancla estable en la tormenta.
`,
        anger: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧡 CONTEXTO EMOCIONAL: EL USUARIO ESTÁ EXPERIMENTANDO ENOJO/FRUSTRACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El usuario se siente enojado o frustrado. Por favor responde con:
- VALIDACIÓN de su derecho a sentirse así
- RECONOCIMIENTO de la injusticia/desafío que enfrenta
- Salidas CONSTRUCTIVAS para la energía (ejercicio, creación)
- Perspectivas astrológicas sobre energía de fuego y transformación
- Estrategias de límites saludables y comunicación
- Canaliza el enojo hacia cambio positivo

TONO: Comprensivo, empoderador, orientado a la acción. Como un coach que lo entiende.
`,
      },
    };

    const lang = language === "es" ? "es" : "en";
    const emotion = emotionalState.primaryEmotion;

    return empathyPrompts[lang][emotion] || "";
  }

  /**
   * 💾 PRIVATE: Store message in database
   */
  async _storeMessage(sessionId, messageType, content, metadata = {}) {
    try {
      const query = `
        INSERT INTO chat_messages (session_id, message_type, content, metadata, ai_model, tokens_used, response_time_ms, confidence_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const result = await db.query(query, [
        sessionId,
        messageType,
        content,
        JSON.stringify(metadata),
        metadata.model || null,
        metadata.tokensUsed || null,
        metadata.responseTime || null,
        metadata.confidenceScore || null,
      ]);

      return result.rows[0].id;
    } catch (error) {
      logger.logError(error, {
        context: "store_message",
        sessionId,
        messageType,
      });
      throw error;
    }
  }

  /**
   * 🧠 PRIVATE: Update conversation context
   */
  async _updateConversationContext(sessionId, userMessage, aiResponse) {
    try {
      // Get current context
      const query =
        "SELECT conversation_context FROM chat_sessions WHERE session_id = $1";
      const result = await db.query(query, [sessionId]);

      if (result.rows.length === 0) return;

      const context = JSON.parse(result.rows[0].conversation_context || "{}");

      // Update message history (keep last N messages)
      if (!context.messageHistory) context.messageHistory = [];

      context.messageHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse }
      );

      // Keep only recent messages for context
      if (context.messageHistory.length > this.config.maxContextMessages * 2) {
        context.messageHistory = context.messageHistory.slice(
          -this.config.maxContextMessages * 2
        );
      }

      // Update in database
      const updateQuery =
        "UPDATE chat_sessions SET conversation_context = $1 WHERE session_id = $2";
      await db.query(updateQuery, [JSON.stringify(context), sessionId]);

      // Update cache
      const cacheKey = `ai_coach_session:${sessionId}`;
      await redisService.setex(
        cacheKey,
        3600,
        JSON.stringify({
          ...result.rows[0],
          conversation_context: JSON.stringify(context),
        })
      );
    } catch (error) {
      logger.logError(error, {
        context: "update_conversation_context",
        sessionId,
      });
    }
  }

  /**
   * 📈 PRIVATE: Update usage statistics
   */
  async _updateUsageStats(userId, isPremium) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const cacheKey = `ai_coach_usage:${userId}:${today}`;

      const cachedUsage = await redisService.get(cacheKey);
      let usage = cachedUsage
        ? JSON.parse(cachedUsage)
        : { used: 0, date: today };

      usage.used += 1;
      usage.lastUsed = new Date().toISOString();

      // Cache until end of day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const ttl = Math.floor((tomorrow - new Date()) / 1000);

      await redisService.setex(cacheKey, ttl, JSON.stringify(usage));
    } catch (error) {
      logger.logError(error, { context: "update_usage_stats", userId });
    }
  }

  /**
   * 💾 PRIVATE: Cache session data
   */
  async _cacheSessionData(sessionId, sessionData, ttl = 3600) {
    try {
      const cacheKey = `ai_coach_session:${sessionId}`;
      await redisService.setex(cacheKey, ttl, JSON.stringify(sessionData));
    } catch (error) {
      logger.logError(error, { context: "cache_session_data", sessionId });
    }
  }

  /**
   * 🔮 NEW: Get session message count
   * Used to determine if we should show yesterday's predictions
   */
  async _getSessionMessageCount(sessionId) {
    try {
      const result = await db.query(
        "SELECT COUNT(*) as count FROM chat_messages WHERE session_id = $1",
        [sessionId]
      );
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.logError(error, {
        context: "get_session_message_count",
        sessionId,
      });
      return 0;
    }
  }

  /**
   * 📊 GET SERVICE STATUS
   */
  getStatus() {
    return {
      service: "AICoachService",
      personas: Object.keys(this.personas),
      config: {
        defaultModel: this.config.defaultModel,
        fallbackModel: this.config.fallbackModel,
        maxContextMessages: this.config.maxContextMessages,
      },
      limits: {
        free: this.premiumLimits.free,
        premium: this.premiumLimits.premium,
      },
      openaiConfigured: !!process.env.OPENAI_API_KEY,
    };
  }

  /**
   * 🧪 HEALTH CHECK
   */
  async healthCheck() {
    try {
      // Test database connection
      await db.query("SELECT 1");

      // Test Redis connection
      await redisService.ping();

      // Test OpenAI connection if key is available
      let openaiStatus = "not_configured";
      if (process.env.OPENAI_API_KEY) {
        try {
          await this.openai.models.list();
          openaiStatus = "connected";
        } catch (error) {
          openaiStatus = "error";
        }
      }

      return {
        healthy: true,
        components: {
          database: "connected",
          redis: "connected",
          openai: openaiStatus,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.logError(error, { context: "ai_coach_health_check" });

      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = new AICoachService();
