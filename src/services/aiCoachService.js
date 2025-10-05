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
const dotenv = require('dotenv');
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
  dotenv.config({ path: '.env' }); // Fallback for missing variables
} else {
  dotenv.config();
}

const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const redisService = require('./redisService');
const receiptValidationService = require('./receiptValidationService');
const logger = require('./loggingService');
const circuitBreaker = require('./circuitBreakerService');

class AICoachService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // AI Coach personas with specialized prompts
    this.personas = {
      general: {
        name: 'General Life Coach',
        systemPrompt: `You are a wise and empathetic life coach helping people navigate their daily challenges. 
        Provide practical, actionable advice while being supportive and encouraging. Keep responses concise but meaningful.
        Focus on personal growth, goal achievement, and positive mindset development.`,
        maxTokens: 500
      },
      spiritual: {
        name: 'Spiritual Guide',
        systemPrompt: `You are a spiritual guide combining ancient wisdom with modern psychology. 
        Draw from various spiritual traditions (without favoring any specific religion) to provide guidance.
        Help users find inner peace, purpose, and spiritual growth. Include mindfulness and meditation suggestions when appropriate.`,
        maxTokens: 600
      },
      career: {
        name: 'Career Coach', 
        systemPrompt: `You are a professional career coach with expertise in personal development and workplace success.
        Provide strategic career advice, help with professional challenges, and guide users toward their career goals.
        Focus on skill development, networking, leadership, and work-life balance.`,
        maxTokens: 500
      },
      relationship: {
        name: 'Relationship Advisor',
        systemPrompt: `You are a compassionate relationship coach specializing in interpersonal dynamics.
        Help users improve their relationships (romantic, family, friends, colleagues) through better communication,
        emotional intelligence, and healthy boundary setting. Always promote respect and healthy relationships.`,
        maxTokens: 500
      },
      wellness: {
        name: 'Wellness Coach',
        systemPrompt: `You are a holistic wellness coach focused on mental, physical, and emotional well-being.
        Provide guidance on stress management, healthy habits, work-life balance, and overall life satisfaction.
        Include practical tips for daily wellness routines and self-care practices.`,
        maxTokens: 500
      },
      motivational: {
        name: 'Motivational Coach',
        systemPrompt: `You are an energetic and inspiring motivational coach who helps people overcome challenges and achieve their goals.
        Use positive psychology, goal-setting techniques, and motivational strategies to empower users.
        Be enthusiastic, uplifting, and focused on action and results.`,
        maxTokens: 400
      }
    };

    // Configuration
    this.config = {
      defaultModel: 'gpt-4-turbo-preview',
      fallbackModel: 'gpt-3.5-turbo',
      maxContextMessages: 10, // Keep last 10 messages for context
      responseTimeoutMs: 25000, // 25 seconds timeout
      maxRetries: 2,
      cacheExpirationSeconds: 3600 // 1 hour cache for similar questions
    };

    // Premium feature limits
    this.premiumLimits = {
      free: {
        dailyMessages: 5,
        sessionMinutes: 15,
        personas: ['general'],
        features: ['basic_chat']
      },
      premium: {
        dailyMessages: 100,
        sessionMinutes: 120,
        personas: Object.keys(this.personas),
        features: ['basic_chat', 'advanced_personas', 'context_memory', 'priority_response']
      }
    };
  }

  /**
   * 🚀 START NEW CHAT SESSION
   * Creates a new chat session for a user with premium validation
   */
  async startChatSession(userId, options = {}) {
    const startTime = Date.now();

    try {
      logger.getLogger().info('Starting AI Coach chat session', { userId, options });

      // Validate premium subscription
      const premiumStatus = await this._validatePremiumAccess(userId, options.receiptData);
      if (!premiumStatus.hasAccess) {
        return {
          success: false,
          error: 'premium_required',
          message: 'AI Coach requires premium subscription',
          premiumStatus
        };
      }

      // Check daily usage limits
      const usageCheck = await this._checkDailyUsage(userId, premiumStatus.isPremium);
      if (!usageCheck.allowed) {
        return {
          success: false,
          error: 'limit_exceeded',
          message: 'Daily message limit exceeded',
          usage: usageCheck
        };
      }

      // Create new session
      const sessionId = uuidv4();
      const persona = options.persona && this.personas[options.persona] ? options.persona : 'general';
      const languageCode = options.languageCode || 'en';

      // Validate persona access based on subscription
      if (!premiumStatus.allowedFeatures.personas.includes(persona)) {
        return {
          success: false,
          error: 'persona_not_available',
          message: `${persona} persona requires premium subscription`,
          availablePersonas: premiumStatus.allowedFeatures.personas
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
          premiumStatus: premiumStatus.isPremium
        }),
        conversation_context: JSON.stringify({
          persona: persona,
          systemPrompt: this.personas[persona].systemPrompt,
          messageHistory: [],
          userPreferences: options.preferences || {}
        })
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
        sessionData.conversation_context
      ]);

      const session = result.rows[0];

      // Cache session data in Redis for quick access
      await this._cacheSessionData(sessionId, {
        ...session,
        premiumStatus,
        usageStats: usageCheck
      });

      const responseTime = Date.now() - startTime;
      logger.getLogger().info('AI Coach session started successfully', { 
        userId, sessionId, persona, responseTime 
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
          dailyUsage: usageCheck
        },
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_start_session', 
        userId, 
        responseTime,
        options 
      });

      return {
        success: false,
        error: 'internal_error',
        message: 'Failed to start chat session',
        responseTime
      };
    }
  }

  /**
   * 💬 SEND MESSAGE AND GET AI RESPONSE
   * Main chat functionality with AI response generation
   */
  async sendMessage(sessionId, message, userId, options = {}) {
    const startTime = Date.now();

    try {
      logger.getLogger().info('Processing AI Coach message', { sessionId, userId, messageLength: message.length });

      // Validate and get session
      const session = await this._getAndValidateSession(sessionId, userId);
      if (!session.success) {
        return session;
      }

      const sessionData = session.data;

      // Check premium access and usage
      const premiumStatus = await this._validatePremiumAccess(userId, options.receiptData);
      if (!premiumStatus.hasAccess) {
        return {
          success: false,
          error: 'premium_required',
          message: 'AI Coach requires premium subscription'
        };
      }

      const usageCheck = await this._checkDailyUsage(userId, premiumStatus.isPremium);
      if (!usageCheck.allowed) {
        return {
          success: false,
          error: 'limit_exceeded',
          message: 'Daily message limit exceeded',
          usage: usageCheck
        };
      }

      // Store user message
      await this._storeMessage(sessionId, 'user', message, {
        userAgent: options.userAgent,
        timestamp: new Date().toISOString()
      });

      // Generate AI response using circuit breaker for reliability
      const aiResponse = await circuitBreaker.execute('openai_chat', async () => {
        return await this._generateAIResponse(sessionData, message, options);
      });

      if (!aiResponse.success) {
        // Store error message for user feedback
        await this._storeMessage(sessionId, 'system', 'I apologize, but I\'m having trouble responding right now. Please try again in a moment.', {
          error: aiResponse.error,
          timestamp: new Date().toISOString()
        });

        return aiResponse;
      }

      // Store AI response
      await this._storeMessage(sessionId, 'ai', aiResponse.content, {
        model: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        responseTime: aiResponse.responseTime,
        confidenceScore: aiResponse.confidenceScore,
        timestamp: new Date().toISOString()
      });

      // Update conversation context
      await this._updateConversationContext(sessionId, message, aiResponse.content);

      // Update usage tracking
      await this._updateUsageStats(userId, premiumStatus.isPremium);

      const totalResponseTime = Date.now() - startTime;
      logger.getLogger().info('AI Coach message processed successfully', { 
        sessionId, userId, totalResponseTime, aiResponseTime: aiResponse.responseTime 
      });

      return {
        success: true,
        response: {
          content: aiResponse.content,
          sessionId: sessionId,
          messageId: aiResponse.messageId,
          model: aiResponse.model,
          tokensUsed: aiResponse.tokensUsed,
          responseTime: totalResponseTime,
          confidenceScore: aiResponse.confidenceScore,
          persona: sessionData.ai_coach_persona,
          timestamp: new Date().toISOString()
        },
        usage: {
          remainingMessages: Math.max(0, usageCheck.limit - usageCheck.used - 1),
          resetTime: usageCheck.resetTime
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, { 
        context: 'ai_coach_send_message', 
        sessionId, 
        userId, 
        responseTime 
      });

      return {
        success: false,
        error: 'internal_error',
        message: 'Failed to process message',
        responseTime
      };
    }
  }

  /**
   * 📜 GET CHAT HISTORY
   * Retrieve conversation history for a session
   */
  async getChatHistory(sessionId, userId, options = {}) {
    try {
      logger.getLogger().info('Retrieving chat history', { sessionId, userId });

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
          personaName: this.personas[sessionInfo.ai_coach_persona]?.name || 'AI Coach',
          createdAt: sessionInfo.created_at,
          lastActivity: sessionInfo.last_activity,
          totalMessages: sessionInfo.total_messages,
          messages: messages.map(msg => ({
            id: msg.id,
            type: msg.message_type,
            content: msg.content,
            timestamp: msg.created_at,
            metadata: msg.metadata,
            ...(msg.message_type === 'ai' && {
              tokensUsed: msg.tokens_used,
              responseTime: msg.response_time_ms,
              confidenceScore: msg.confidence_score
            })
          }))
        },
        pagination: {
          limit,
          offset,
          hasMore: result.rows.length === limit
        }
      };

    } catch (error) {
      logger.logError(error, { context: 'ai_coach_get_history', sessionId, userId });

      return {
        success: false,
        error: 'internal_error',
        message: 'Failed to retrieve chat history'
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
        if (process.env.NODE_ENV !== 'production') {
          return {
            hasAccess: true,
            isPremium: false,
            allowedFeatures: this.premiumLimits.free,
            message: 'Development mode - free tier access'
          };
        }

        return {
          hasAccess: false,
          isPremium: false,
          allowedFeatures: this.premiumLimits.free,
          message: 'Receipt data required for premium validation'
        };
      }

      const subscriptionStatus = await receiptValidationService.getUserSubscriptionStatus(receiptData, userId);
      const isPremium = subscriptionStatus.isPremium;
      const allowedFeatures = isPremium ? this.premiumLimits.premium : this.premiumLimits.free;

      return {
        hasAccess: true, // Both free and premium users can access AI Coach
        isPremium,
        allowedFeatures,
        subscriptionStatus,
        message: isPremium ? 'Premium access granted' : 'Free tier access'
      };

    } catch (error) {
      logger.logError(error, { context: 'premium_validation', userId });
      
      return {
        hasAccess: false,
        isPremium: false,
        allowedFeatures: this.premiumLimits.free,
        error: error.message
      };
    }
  }

  /**
   * 📊 PRIVATE: Check daily usage limits
   */
  async _checkDailyUsage(userId, isPremium) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `ai_coach_usage:${userId}:${today}`;
      
      const cachedUsage = await redisService.get(cacheKey);
      let usage = cachedUsage ? JSON.parse(cachedUsage) : { used: 0, date: today };

      const limits = isPremium ? this.premiumLimits.premium : this.premiumLimits.free;
      const allowed = usage.used < limits.dailyMessages;

      return {
        allowed,
        used: usage.used,
        limit: limits.dailyMessages,
        isPremium,
        resetTime: new Date(new Date().setHours(23, 59, 59, 999))
      };

    } catch (error) {
      logger.logError(error, { context: 'usage_check', userId });
      
      // On error, allow limited access
      return {
        allowed: true,
        used: 0,
        limit: 5,
        isPremium: false,
        resetTime: new Date(new Date().setHours(23, 59, 59, 999))
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
          error: 'session_not_found',
          message: 'Chat session not found or access denied'
        };
      }

      const session = result.rows[0];
      
      // Cache for future use
      await this._cacheSessionData(sessionId, session);

      return { success: true, data: session };

    } catch (error) {
      logger.logError(error, { context: 'session_validation', sessionId, userId });
      
      return {
        success: false,
        error: 'internal_error',
        message: 'Failed to validate session'
      };
    }
  }

  /**
   * 🤖 PRIVATE: Generate AI response using OpenAI
   */
  async _generateAIResponse(sessionData, userMessage, options = {}) {
    const startTime = Date.now();

    try {
      const persona = this.personas[sessionData.ai_coach_persona];
      const conversationContext = JSON.parse(sessionData.conversation_context || '{}');
      
      // Build conversation history for context
      const recentMessages = conversationContext.messageHistory || [];
      const contextMessages = recentMessages.slice(-this.config.maxContextMessages);

      const messages = [
        {
          role: 'system',
          content: persona.systemPrompt + '\n\nImportant: Keep responses under 500 words and focus on practical, actionable advice. Be warm, supportive, and encouraging.'
        },
        ...contextMessages,
        {
          role: 'user',
          content: userMessage
        }
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.config.defaultModel,
        messages: messages,
        max_tokens: persona.maxTokens,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
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
        messageId: completion.id
      };

    } catch (error) {
      logger.logError(error, { 
        context: 'openai_response_generation', 
        sessionId: sessionData.session_id,
        responseTime: Date.now() - startTime 
      });

      // Try fallback model
      if (error.code === 'model_overloaded' || error.code === 'rate_limit_exceeded') {
        try {
          const fallbackCompletion = await this.openai.chat.completions.create({
            model: this.config.fallbackModel,
            messages: [
              { role: 'system', content: this.personas[sessionData.ai_coach_persona].systemPrompt },
              { role: 'user', content: userMessage }
            ],
            max_tokens: 300,
            temperature: 0.7
          });

          return {
            success: true,
            content: fallbackCompletion.choices[0].message.content,
            model: this.config.fallbackModel,
            tokensUsed: fallbackCompletion.usage.total_tokens,
            responseTime: Date.now() - startTime,
            confidenceScore: 0.75
          };

        } catch (fallbackError) {
          logger.logError(fallbackError, { context: 'openai_fallback_failed' });
        }
      }

      return {
        success: false,
        error: error.code || 'ai_response_failed',
        message: 'Unable to generate AI response at this time'
      };
    }
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
        metadata.confidenceScore || null
      ]);

      return result.rows[0].id;

    } catch (error) {
      logger.logError(error, { context: 'store_message', sessionId, messageType });
      throw error;
    }
  }

  /**
   * 🧠 PRIVATE: Update conversation context
   */
  async _updateConversationContext(sessionId, userMessage, aiResponse) {
    try {
      // Get current context
      const query = 'SELECT conversation_context FROM chat_sessions WHERE session_id = $1';
      const result = await db.query(query, [sessionId]);
      
      if (result.rows.length === 0) return;

      const context = JSON.parse(result.rows[0].conversation_context || '{}');
      
      // Update message history (keep last N messages)
      if (!context.messageHistory) context.messageHistory = [];
      
      context.messageHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse }
      );

      // Keep only recent messages for context
      if (context.messageHistory.length > this.config.maxContextMessages * 2) {
        context.messageHistory = context.messageHistory.slice(-this.config.maxContextMessages * 2);
      }

      // Update in database
      const updateQuery = 'UPDATE chat_sessions SET conversation_context = $1 WHERE session_id = $2';
      await db.query(updateQuery, [JSON.stringify(context), sessionId]);

      // Update cache
      const cacheKey = `ai_coach_session:${sessionId}`;
      await redisService.setex(cacheKey, 3600, JSON.stringify({
        ...result.rows[0],
        conversation_context: JSON.stringify(context)
      }));

    } catch (error) {
      logger.logError(error, { context: 'update_conversation_context', sessionId });
    }
  }

  /**
   * 📈 PRIVATE: Update usage statistics
   */
  async _updateUsageStats(userId, isPremium) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `ai_coach_usage:${userId}:${today}`;
      
      const cachedUsage = await redisService.get(cacheKey);
      let usage = cachedUsage ? JSON.parse(cachedUsage) : { used: 0, date: today };
      
      usage.used += 1;
      usage.lastUsed = new Date().toISOString();
      
      // Cache until end of day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const ttl = Math.floor((tomorrow - new Date()) / 1000);
      
      await redisService.setex(cacheKey, ttl, JSON.stringify(usage));

    } catch (error) {
      logger.logError(error, { context: 'update_usage_stats', userId });
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
      logger.logError(error, { context: 'cache_session_data', sessionId });
    }
  }

  /**
   * 📊 GET SERVICE STATUS
   */
  getStatus() {
    return {
      service: 'AICoachService',
      personas: Object.keys(this.personas),
      config: {
        defaultModel: this.config.defaultModel,
        fallbackModel: this.config.fallbackModel,
        maxContextMessages: this.config.maxContextMessages
      },
      limits: {
        free: this.premiumLimits.free,
        premium: this.premiumLimits.premium
      },
      openaiConfigured: !!process.env.OPENAI_API_KEY
    };
  }

  /**
   * 🧪 HEALTH CHECK
   */
  async healthCheck() {
    try {
      // Test database connection
      await db.query('SELECT 1');
      
      // Test Redis connection
      await redisService.ping();
      
      // Test OpenAI connection if key is available
      let openaiStatus = 'not_configured';
      if (process.env.OPENAI_API_KEY) {
        try {
          await this.openai.models.list();
          openaiStatus = 'connected';
        } catch (error) {
          openaiStatus = 'error';
        }
      }

      return {
        healthy: true,
        components: {
          database: 'connected',
          redis: 'connected',
          openai: openaiStatus
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, { context: 'ai_coach_health_check' });
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new AICoachService();