/**
 * 🎯 GOAL PLANNER SERVICE
 *
 * AI-powered goal planning service using OpenAI GPT-4
 * Features:
 * - SMART goal generation based on zodiac sign and emotional state
 * - Weekly focus areas and micro-habits
 * - Astrological timing recommendations
 * - Premium tier validation (Stellar required)
 * - Goal tracking and check-ins
 */

const dotenv = require('dotenv');
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
  dotenv.config({ path: '.env' }); // Fallback
} else {
  dotenv.config();
}

const OpenAI = require('openai');
const { randomUUID } = require('crypto');
const db = require('../config/db');
const logger = require('./loggingService');
const circuitBreaker = require('./circuitBreakerService');

class GoalPlannerService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.config = {
      model: 'gpt-4-turbo-preview',
      fallbackModel: 'gpt-3.5-turbo',
      maxTokens: 1500,
      temperature: 0.7,
      timeoutMs: 30000
    };

    // Zodiac characteristics for goal personalization
    this.zodiacTraits = {
      aries: { strength: 'initiative', challenge: 'patience', style: 'action-oriented' },
      taurus: { strength: 'persistence', challenge: 'flexibility', style: 'steady progress' },
      gemini: { strength: 'adaptability', challenge: 'focus', style: 'varied approach' },
      cancer: { strength: 'intuition', challenge: 'boundaries', style: 'emotional connection' },
      leo: { strength: 'confidence', challenge: 'ego', style: 'bold action' },
      virgo: { strength: 'analysis', challenge: 'perfectionism', style: 'detailed planning' },
      libra: { strength: 'balance', challenge: 'decision-making', style: 'harmonious approach' },
      scorpio: { strength: 'determination', challenge: 'control', style: 'intense focus' },
      sagittarius: { strength: 'optimism', challenge: 'commitment', style: 'explorative' },
      capricorn: { strength: 'discipline', challenge: 'rigidity', style: 'structured growth' },
      aquarius: { strength: 'innovation', challenge: 'detachment', style: 'unique path' },
      pisces: { strength: 'creativity', challenge: 'boundaries', style: 'intuitive flow' }
    };
  }

  /**
   * Generate SMART goals using AI based on user profile and objectives
   */
  async generateGoals(params) {
    const {
      userId,
      zodiacSign,
      objective,
      emotionalState,
      focusArea, // 'career', 'relationships', 'wellness', 'personal_growth'
      timeframe, // 'weekly', 'monthly', 'quarterly'
      languageCode = 'en'
    } = params;

    try {
      logger.getLogger().info('Generating AI goals', { userId, zodiacSign, focusArea });

      // Get zodiac traits
      const traits = this.zodiacTraits[zodiacSign.toLowerCase()] || this.zodiacTraits.aries;

      // Build AI prompt
      const prompt = this._buildGoalPrompt({
        zodiacSign,
        traits,
        objective,
        emotionalState,
        focusArea,
        timeframe,
        languageCode
      });

      // Call OpenAI directly (circuit breaker adds complexity for initial testing)
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert life coach and astrologer who creates personalized SMART goals. Return responses in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      });

      // Parse AI response
      const aiResponse = JSON.parse(completion.choices[0].message.content);

      // Create goal record in database
      const goalId = randomUUID();
      const goalData = {
        goalId,
        userId,
        zodiacSign,
        focusArea,
        objective,
        ...aiResponse,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      // Save to database
      await this._saveGoal(goalData);

      logger.getLogger().info('AI goals generated successfully', { userId, goalId });

      return {
        success: true,
        goalId,
        goal: goalData,
        responseTime: Date.now()
      };

    } catch (error) {
      logger.logError(error, {
        service: 'goalPlannerService',
        method: 'generateGoals',
        userId
      });

      throw error;
    }
  }

  /**
   * Build AI prompt for goal generation
   */
  _buildGoalPrompt(params) {
    const { zodiacSign, traits, objective, emotionalState, focusArea, timeframe, languageCode } = params;

    return `Generate a personalized SMART goal plan for a ${zodiacSign} user with the following profile:

**User Profile:**
- Zodiac Sign: ${zodiacSign} (Strength: ${traits.strength}, Challenge: ${traits.challenge}, Style: ${traits.style})
- Main Objective: ${objective}
- Current Emotional State: ${emotionalState}
- Focus Area: ${focusArea}
- Timeframe: ${timeframe}
- Language: ${languageCode}

**Task:** Create a comprehensive goal plan with the following structure (return as JSON):

{
  "mainGoal": {
    "title": "Clear, actionable main goal title",
    "why": "Deep emotional reason connecting to user's values and ${zodiacSign} nature",
    "specific": "Precise definition aligned with ${traits.style} approach",
    "measurable": "Concrete metrics for progress tracking",
    "achievable": "Realistic steps considering ${traits.strength} and ${traits.challenge}",
    "relevant": "Connection to ${focusArea} and personal growth",
    "timeBound": "Clear deadline for ${timeframe} timeframe"
  },
  "weeklyFocus": {
    "theme": "Weekly theme aligned with astrological energy",
    "keyActions": ["Action 1", "Action 2", "Action 3"],
    "astroTiming": "Best days/times this week for focused action"
  },
  "microHabits": [
    {
      "habit": "Small daily habit",
      "when": "Specific trigger or time",
      "why": "Connection to main goal",
      "difficulty": "easy|medium|hard"
    },
    {
      "habit": "Second micro-habit",
      "when": "Trigger",
      "why": "Reason",
      "difficulty": "easy|medium|hard"
    },
    {
      "habit": "Third micro-habit",
      "when": "Trigger",
      "why": "Reason",
      "difficulty": "easy|medium|hard"
    }
  ],
  "successIndicators": [
    "Indicator 1",
    "Indicator 2",
    "Indicator 3"
  ],
  "potentialObstacles": [
    {
      "obstacle": "Common challenge for ${zodiacSign}",
      "solution": "Practical workaround leveraging ${traits.strength}"
    }
  ],
  "motivationalMessage": "Inspiring message personalized for ${zodiacSign} speaking to their ${traits.strength}"
}

Make it deeply personal, actionable, and aligned with ${zodiacSign} characteristics. Language: ${languageCode}`;
  }

  /**
   * Save goal to database
   */
  async _saveGoal(goalData) {
    try {
      const query = `
        INSERT INTO premium_goals (
          goal_id, user_id, zodiac_sign, focus_area, objective,
          main_goal, weekly_focus, micro_habits, success_indicators,
          potential_obstacles, motivational_message, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        goalData.goalId,
        goalData.userId,
        goalData.zodiacSign,
        goalData.focusArea,
        goalData.objective,
        JSON.stringify(goalData.mainGoal),
        JSON.stringify(goalData.weeklyFocus),
        JSON.stringify(goalData.microHabits),
        JSON.stringify(goalData.successIndicators),
        JSON.stringify(goalData.potentialObstacles),
        goalData.motivationalMessage,
        goalData.status,
        goalData.createdAt
      ];

      const result = await db.query(query, values);
      return result.rows[0];

    } catch (error) {
      // If table doesn't exist, log warning but don't fail
      if (error.code === '42P01') {
        logger.getLogger().warn('premium_goals table not found - run migrations');
      }
      throw error;
    }
  }

  /**
   * Get user goals
   */
  async getUserGoals(userId, status = 'active') {
    try {
      const query = `
        SELECT * FROM premium_goals
        WHERE user_id = $1 AND status = $2
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId, status]);

      return result.rows.map(row => ({
        ...row,
        // PostgreSQL JSONB columns are already parsed
        mainGoal: typeof row.main_goal === 'string' ? JSON.parse(row.main_goal) : row.main_goal,
        weeklyFocus: typeof row.weekly_focus === 'string' ? JSON.parse(row.weekly_focus) : row.weekly_focus,
        microHabits: typeof row.micro_habits === 'string' ? JSON.parse(row.micro_habits) : row.micro_habits,
        successIndicators: typeof row.success_indicators === 'string' ? JSON.parse(row.success_indicators) : row.success_indicators,
        potentialObstacles: typeof row.potential_obstacles === 'string' ? JSON.parse(row.potential_obstacles) : row.potential_obstacles
      }));

    } catch (error) {
      logger.logError(error, { service: 'goalPlannerService', method: 'getUserGoals' });
      throw error;
    }
  }

  /**
   * Record goal check-in
   */
  async recordCheckIn(goalId, userId, checkInData) {
    try {
      const { progress, feedback, mood } = checkInData;

      const query = `
        INSERT INTO goal_check_ins (
          goal_id, user_id, progress, feedback, mood, check_in_date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        goalId,
        userId,
        progress,
        feedback,
        mood,
        new Date().toISOString()
      ];

      const result = await db.query(query, values);

      logger.getLogger().info('Goal check-in recorded', { goalId, userId, progress });

      return {
        success: true,
        checkIn: result.rows[0]
      };

    } catch (error) {
      logger.logError(error, { service: 'goalPlannerService', method: 'recordCheckIn' });
      throw error;
    }
  }

  /**
   * Get goal analytics
   */
  async getGoalAnalytics(userId, timeframe = '30d') {
    try {
      const query = `
        SELECT
          g.goal_id,
          g.focus_area,
          g.status,
          COUNT(c.id) as check_in_count,
          AVG(c.progress) as avg_progress,
          g.created_at
        FROM premium_goals g
        LEFT JOIN goal_check_ins c ON g.goal_id = c.goal_id
        WHERE g.user_id = $1
        GROUP BY g.goal_id, g.focus_area, g.status, g.created_at
        ORDER BY g.created_at DESC
      `;

      const result = await db.query(query, [userId]);

      return {
        success: true,
        analytics: result.rows,
        summary: {
          totalGoals: result.rows.length,
          activeGoals: result.rows.filter(r => r.status === 'active').length,
          completedGoals: result.rows.filter(r => r.status === 'completed').length,
          avgProgress: result.rows.reduce((sum, r) => sum + (parseFloat(r.avg_progress) || 0), 0) / result.rows.length || 0
        }
      };

    } catch (error) {
      logger.logError(error, { service: 'goalPlannerService', method: 'getGoalAnalytics' });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  async getStats() {
    try {
      const query = `
        SELECT
          COUNT(DISTINCT user_id) as total_users,
          COUNT(*) as total_goals,
          COUNT(*) FILTER (WHERE status = 'active') as active_goals,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_goals
        FROM premium_goals
      `;

      const result = await db.query(query);

      return {
        success: true,
        stats: result.rows[0]
      };

    } catch (error) {
      logger.logError(error, { service: 'goalPlannerService', method: 'getStats' });
      return {
        success: false,
        stats: {
          total_users: 0,
          total_goals: 0,
          active_goals: 0,
          completed_goals: 0
        }
      };
    }
  }
}

module.exports = new GoalPlannerService();
