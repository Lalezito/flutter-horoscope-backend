/**
 * ADVANCED COMPATIBILITY CONTROLLER
 * Handles all compatibility-related API endpoints
 *
 * Features:
 * - Deep compatibility analysis
 * - Timeline predictions
 * - Matching algorithm
 * - Milestone predictions
 * - PDF report generation
 * - User profile management
 *
 * @version 1.0.0
 */

const logger = require('../services/loggingService');
const compatibilityEngine = require('../services/compatibilityEngine');
const reportGenerator = require('../services/compatibilityReportGenerator');
const pool = require('../config/database');

class AdvancedCompatibilityController {
  /**
   * ANALYZE DEEP COMPATIBILITY
   * POST /api/v2/compatibility/analyze
   *
   * Body:
   * {
   *   user1: { userId, sunSign, moonSign?, risingSign?, venusSign?, marsSign?, mercurySign?, birthData? },
   *   user2: { userId, sunSign, moonSign?, risingSign?, venusSign?, marsSign?, mercurySign?, birthData? },
   *   relationType: 'romantic' | 'friendship' | 'business'
   * }
   */
  async analyzeCompatibility(req, res) {
    try {
      const { user1, user2, relationType = 'romantic' } = req.body;

      // Validation
      if (!user1 || !user2) {
        return res.status(400).json({
          success: false,
          error: 'Both user1 and user2 are required',
          code: 'MISSING_USERS'
        });
      }

      if (!user1.sunSign || !user2.sunSign) {
        return res.status(400).json({
          success: false,
          error: 'Sun signs are required for both users',
          code: 'MISSING_SUN_SIGNS'
        });
      }

      // Check subscription tier limits
      const subscriptionTier = req.user?.subscriptionTier || 'free';
      const canAnalyze = await this.checkCompatibilityLimits(req.user?.userId, subscriptionTier);

      if (!canAnalyze.allowed) {
        return res.status(403).json({
          success: false,
          error: canAnalyze.message,
          code: 'LIMIT_EXCEEDED',
          upgradeRequired: true,
          currentTier: subscriptionTier
        });
      }

      // Perform deep compatibility analysis
      const compatibility = await compatibilityEngine.calculateDeepCompatibility(
        user1,
        user2,
        relationType
      );

      // Track analytics
      await this.trackCompatibilityCheck(subscriptionTier);

      logger.getLogger().info('Compatibility analysis completed', {
        controller: 'advanced_compatibility',
        relationType,
        score: compatibility.scores.overall,
        tier: subscriptionTier
      });

      res.json({
        success: true,
        compatibility,
        subscriptionTier,
        checksRemaining: canAnalyze.remaining,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'analyze_compatibility'
      });

      res.status(500).json({
        success: false,
        error: 'Compatibility analysis failed',
        code: 'ANALYSIS_ERROR'
      });
    }
  }

  /**
   * GET COMPATIBILITY TIMELINE
   * POST /api/v2/compatibility/timeline
   *
   * Body:
   * {
   *   user1: { ... },
   *   user2: { ... }
   * }
   */
  async getCompatibilityTimeline(req, res) {
    try {
      const { user1, user2 } = req.body;

      // Validate subscription tier (Cosmic or Universe required)
      const subscriptionTier = req.user?.subscriptionTier || 'free';
      if (subscriptionTier === 'free') {
        return res.status(403).json({
          success: false,
          error: 'Timeline predictions require Cosmic or Universe subscription',
          code: 'UPGRADE_REQUIRED',
          requiredTier: 'cosmic'
        });
      }

      // Generate timeline predictions
      const timeline = await compatibilityEngine.predictCompatibilityTimeline(user1, user2);

      logger.getLogger().info('Timeline prediction generated', {
        controller: 'advanced_compatibility',
        tier: subscriptionTier
      });

      res.json({
        success: true,
        timeline,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'get_timeline'
      });

      res.status(500).json({
        success: false,
        error: 'Timeline prediction failed',
        code: 'TIMELINE_ERROR'
      });
    }
  }

  /**
   * FIND MATCHES
   * POST /api/v2/compatibility/matches
   *
   * Body:
   * {
   *   userId: 'user123',
   *   preferences: {
   *     limit: 10,
   *     minScore: 60,
   *     maxDistance: 50,
   *     ageRange: [25, 35],
   *     preferredSigns: ['leo', 'aries'],
   *     relationType: 'romantic'
   *   }
   * }
   */
  async findMatches(req, res) {
    try {
      const { userId, preferences = {} } = req.body;

      // Validate subscription tier (Universe required for matching)
      const subscriptionTier = req.user?.subscriptionTier || 'free';
      if (subscriptionTier !== 'universe') {
        return res.status(403).json({
          success: false,
          error: 'Matching algorithm requires Universe subscription',
          code: 'UPGRADE_REQUIRED',
          requiredTier: 'universe',
          feature: 'Dating & Matching'
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      // Find top matches
      const matches = await compatibilityEngine.findTopMatches(userId, preferences);

      logger.getLogger().info('Matches found', {
        controller: 'advanced_compatibility',
        userId,
        matchCount: matches.total,
        tier: subscriptionTier
      });

      res.json({
        success: true,
        matches,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'find_matches'
      });

      res.status(500).json({
        success: false,
        error: 'Match finding failed',
        code: 'MATCHING_ERROR'
      });
    }
  }

  /**
   * PREDICT RELATIONSHIP MILESTONES
   * POST /api/v2/compatibility/milestones
   *
   * Body:
   * {
   *   user1: { ... },
   *   user2: { ... }
   * }
   */
  async predictMilestones(req, res) {
    try {
      const { user1, user2 } = req.body;

      // Validate subscription tier (Universe required)
      const subscriptionTier = req.user?.subscriptionTier || 'free';
      if (subscriptionTier !== 'universe') {
        return res.status(403).json({
          success: false,
          error: 'Milestone predictions require Universe subscription',
          code: 'UPGRADE_REQUIRED',
          requiredTier: 'universe'
        });
      }

      // Predict milestones
      const milestones = await compatibilityEngine.predictRelationshipMilestones(user1, user2);

      logger.getLogger().info('Milestones predicted', {
        controller: 'advanced_compatibility',
        milestoneCount: milestones.milestones?.length || 0,
        tier: subscriptionTier
      });

      res.json({
        success: true,
        milestones,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'predict_milestones'
      });

      res.status(500).json({
        success: false,
        error: 'Milestone prediction failed',
        code: 'MILESTONE_ERROR'
      });
    }
  }

  /**
   * GENERATE PDF REPORT
   * POST /api/v2/compatibility/report
   *
   * Body:
   * {
   *   checkId: 'check_xxx',
   *   reportType: 'basic' | 'premium' | 'elite'
   * }
   */
  async generateReport(req, res) {
    try {
      const { checkId, reportType = 'premium' } = req.body;

      if (!checkId) {
        return res.status(400).json({
          success: false,
          error: 'Check ID is required',
          code: 'MISSING_CHECK_ID'
        });
      }

      // Validate subscription tier
      const subscriptionTier = req.user?.subscriptionTier || 'free';
      const tierLimits = {
        free: null,
        cosmic: 'basic',
        universe: 'elite'
      };

      const maxReportType = tierLimits[subscriptionTier];
      if (!maxReportType || (reportType === 'premium' && subscriptionTier === 'free')) {
        return res.status(403).json({
          success: false,
          error: 'Your subscription tier does not include PDF reports',
          code: 'UPGRADE_REQUIRED',
          currentTier: subscriptionTier
        });
      }

      // Get compatibility check from database
      const compatibility = await this.getCompatibilityCheck(checkId);

      if (!compatibility) {
        return res.status(404).json({
          success: false,
          error: 'Compatibility check not found',
          code: 'CHECK_NOT_FOUND'
        });
      }

      // Generate PDF report
      const report = await reportGenerator.generateReport(compatibility, reportType);

      logger.getLogger().info('PDF report generated', {
        controller: 'advanced_compatibility',
        reportId: report.reportId,
        reportType,
        tier: subscriptionTier
      });

      res.json({
        success: true,
        report,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'generate_report'
      });

      res.status(500).json({
        success: false,
        error: 'Report generation failed',
        code: 'REPORT_ERROR'
      });
    }
  }

  /**
   * GET USER PROFILE
   * GET /api/v2/compatibility/profile/:userId
   */
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;

      const query = 'SELECT * FROM user_compatibility_profiles WHERE user_id = $1';
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }

      const profile = result.rows[0];

      // Remove sensitive data
      delete profile.birth_location_lat;
      delete profile.birth_location_lng;

      res.json({
        success: true,
        profile,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'get_user_profile'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve profile',
        code: 'PROFILE_ERROR'
      });
    }
  }

  /**
   * CREATE/UPDATE USER PROFILE
   * POST /api/v2/compatibility/profile
   *
   * Body:
   * {
   *   userId: 'user123',
   *   sunSign: 'leo',
   *   moonSign: 'cancer',
   *   risingSign: 'virgo',
   *   ...
   * }
   */
  async updateUserProfile(req, res) {
    try {
      const profileData = req.body;

      if (!profileData.userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      if (!profileData.sunSign) {
        return res.status(400).json({
          success: false,
          error: 'Sun sign is required',
          code: 'MISSING_SUN_SIGN'
        });
      }

      // Upsert profile
      const query = `
        INSERT INTO user_compatibility_profiles (
          user_id, sun_sign, moon_sign, rising_sign, venus_sign, mars_sign, mercury_sign,
          birth_date, birth_time, birth_location_city, birth_location_country,
          display_name, bio, age, gender, location_city, location_country,
          show_in_matching, subscription_tier
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (user_id) DO UPDATE SET
          sun_sign = EXCLUDED.sun_sign,
          moon_sign = EXCLUDED.moon_sign,
          rising_sign = EXCLUDED.rising_sign,
          venus_sign = EXCLUDED.venus_sign,
          mars_sign = EXCLUDED.mars_sign,
          mercury_sign = EXCLUDED.mercury_sign,
          birth_date = EXCLUDED.birth_date,
          birth_time = EXCLUDED.birth_time,
          birth_location_city = EXCLUDED.birth_location_city,
          birth_location_country = EXCLUDED.birth_location_country,
          display_name = EXCLUDED.display_name,
          bio = EXCLUDED.bio,
          age = EXCLUDED.age,
          gender = EXCLUDED.gender,
          location_city = EXCLUDED.location_city,
          location_country = EXCLUDED.location_country,
          show_in_matching = EXCLUDED.show_in_matching,
          subscription_tier = EXCLUDED.subscription_tier,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await pool.query(query, [
        profileData.userId,
        profileData.sunSign,
        profileData.moonSign || null,
        profileData.risingSign || null,
        profileData.venusSign || null,
        profileData.marsSign || null,
        profileData.mercurySign || null,
        profileData.birthDate || null,
        profileData.birthTime || null,
        profileData.birthLocationCity || null,
        profileData.birthLocationCountry || null,
        profileData.displayName || null,
        profileData.bio || null,
        profileData.age || null,
        profileData.gender || null,
        profileData.locationCity || null,
        profileData.locationCountry || null,
        profileData.showInMatching || false,
        profileData.subscriptionTier || 'free'
      ]);

      logger.getLogger().info('User profile updated', {
        controller: 'advanced_compatibility',
        userId: profileData.userId
      });

      res.json({
        success: true,
        profile: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'update_user_profile'
      });

      res.status(500).json({
        success: false,
        error: 'Profile update failed',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  }

  /**
   * GET COMPATIBILITY HISTORY
   * GET /api/v2/compatibility/history/:userId
   */
  async getCompatibilityHistory(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const query = `
        SELECT * FROM compatibility_checks
        WHERE user1_id = $1 OR user2_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      res.json({
        success: true,
        history: result.rows,
        total: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'get_history'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve history',
        code: 'HISTORY_ERROR'
      });
    }
  }

  /**
   * SUBMIT COMPATIBILITY FEEDBACK
   * POST /api/v2/compatibility/feedback
   *
   * Body:
   * {
   *   checkId: 'check_xxx',
   *   userId: 'user123',
   *   accuracyRating: 4,
   *   helpfulRating: 5,
   *   comments: 'Very accurate!',
   *   relationshipStatus: 'dating'
   * }
   */
  async submitFeedback(req, res) {
    try {
      const { checkId, userId, accuracyRating, helpfulRating, comments, relationshipStatus } = req.body;

      if (!checkId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Check ID and User ID are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const query = `
        INSERT INTO compatibility_feedback (
          check_id, user_id, accuracy_rating, helpful_rating,
          comments, relationship_status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await pool.query(query, [
        checkId,
        userId,
        accuracyRating,
        helpfulRating,
        comments,
        relationshipStatus
      ]);

      logger.getLogger().info('Feedback submitted', {
        controller: 'advanced_compatibility',
        checkId,
        accuracyRating
      });

      res.json({
        success: true,
        feedback: result.rows[0],
        message: 'Thank you for your feedback!',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'submit_feedback'
      });

      res.status(500).json({
        success: false,
        error: 'Feedback submission failed',
        code: 'FEEDBACK_ERROR'
      });
    }
  }

  /**
   * GET SERVICE STATUS
   * GET /api/v2/compatibility/status
   */
  async getServiceStatus(req, res) {
    try {
      const engineStatus = compatibilityEngine.getServiceStatus();
      const reportStatus = reportGenerator.getServiceStatus();

      res.json({
        success: true,
        status: 'operational',
        services: {
          engine: engineStatus,
          reports: reportStatus
        },
        features: {
          deepAnalysis: true,
          timeline: true,
          matching: true,
          milestones: true,
          pdfReports: true,
          birthChartSynastry: true
        },
        subscriptionTiers: {
          free: {
            checksPerDay: 1,
            features: ['Basic sun sign compatibility']
          },
          cosmic: {
            checksPerMonth: 10,
            features: ['Multi-dimensional analysis', 'Basic PDF reports', 'Timeline predictions']
          },
          universe: {
            checksPerMonth: 'unlimited',
            features: ['All features', 'Elite PDF reports', 'Matching algorithm', 'Milestone predictions', 'Birth chart synastry']
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        endpoint: 'get_status'
      });

      res.status(500).json({
        success: false,
        error: 'Status check failed',
        code: 'STATUS_ERROR'
      });
    }
  }

  /**
   * HELPER: Check compatibility limits based on subscription tier
   */
  async checkCompatibilityLimits(userId, tier) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const limits = {
        free: { daily: 1, monthly: null },
        cosmic: { daily: null, monthly: 10 },
        universe: { daily: null, monthly: null } // Unlimited
      };

      const tierLimits = limits[tier] || limits.free;

      if (!tierLimits.daily && !tierLimits.monthly) {
        // Unlimited
        return { allowed: true, remaining: 'unlimited' };
      }

      // Check daily limit for free tier
      if (tierLimits.daily) {
        const query = `
          SELECT COUNT(*) as count FROM compatibility_checks
          WHERE (user1_id = $1 OR user2_id = $1)
            AND created_at::date = $2
        `;

        const result = await pool.query(query, [userId, today]);
        const count = parseInt(result.rows[0].count);

        if (count >= tierLimits.daily) {
          return {
            allowed: false,
            message: 'Daily compatibility check limit reached. Upgrade to Cosmic for more checks.',
            remaining: 0
          };
        }

        return {
          allowed: true,
          remaining: tierLimits.daily - count
        };
      }

      // Check monthly limit for cosmic tier
      if (tierLimits.monthly) {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const query = `
          SELECT COUNT(*) as count FROM compatibility_checks
          WHERE (user1_id = $1 OR user2_id = $1)
            AND created_at >= $2
        `;

        const result = await pool.query(query, [userId, firstDayOfMonth]);
        const count = parseInt(result.rows[0].count);

        if (count >= tierLimits.monthly) {
          return {
            allowed: false,
            message: 'Monthly compatibility check limit reached. Upgrade to Universe for unlimited checks.',
            remaining: 0
          };
        }

        return {
          allowed: true,
          remaining: tierLimits.monthly - count
        };
      }

      return { allowed: true, remaining: 'unlimited' };

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        operation: 'check_limits'
      });
      return { allowed: true, remaining: 'unknown' };
    }
  }

  /**
   * HELPER: Track analytics
   */
  async trackCompatibilityCheck(tier) {
    try {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const hour = now.getHours();

      const query = `
        INSERT INTO compatibility_analytics (date, hour, total_checks, ${tier}_tier_checks)
        VALUES ($1, $2, 1, 1)
        ON CONFLICT (date, hour) DO UPDATE SET
          total_checks = compatibility_analytics.total_checks + 1,
          ${tier}_tier_checks = compatibility_analytics.${tier}_tier_checks + 1
      `;

      await pool.query(query, [date, hour]);

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        operation: 'track_analytics'
      });
    }
  }

  /**
   * HELPER: Get compatibility check from database
   */
  async getCompatibilityCheck(checkId) {
    try {
      const query = 'SELECT * FROM compatibility_checks WHERE check_id = $1';
      const result = await pool.query(query, [checkId]);

      if (result.rows.length === 0) {
        return null;
      }

      const check = result.rows[0];

      // Reconstruct compatibility object
      return {
        checkId: check.check_id,
        user1: {
          userId: check.user1_id,
          sunSign: check.sun_sign || 'unknown'
        },
        user2: {
          userId: check.user2_id,
          sunSign: check.sun_sign || 'unknown'
        },
        scores: {
          overall: check.overall_score,
          sun: check.sun_compatibility,
          moon: check.moon_compatibility,
          rising: check.rising_compatibility,
          venus: check.venus_compatibility,
          mars: check.mars_compatibility,
          mercury: check.mercury_compatibility,
          emotional: check.emotional_compatibility,
          communication: check.communication_compatibility,
          intimacy: check.intimacy_compatibility,
          conflictResolution: check.conflict_resolution_score
        },
        rating: this.getCompatibilityRating(check.overall_score),
        strengths: check.strengths || [],
        challenges: check.challenges || [],
        recommendations: check.recommendations || [],
        redFlags: check.red_flags || [],
        birthChartAnalysis: check.has_birth_chart_analysis ? {} : null,
        metadata: {
          analysisDepth: check.analysis_depth,
          hasBirthChartData: check.has_birth_chart_analysis
        }
      };

    } catch (error) {
      logger.logError(error, {
        controller: 'advanced_compatibility',
        operation: 'get_check'
      });
      return null;
    }
  }

  /**
   * HELPER: Get compatibility rating
   */
  getCompatibilityRating(score) {
    if (score >= 90) return 'Soulmate Connection';
    if (score >= 80) return 'Excellent Match';
    if (score >= 70) return 'Very Compatible';
    if (score >= 60) return 'Good Compatibility';
    if (score >= 50) return 'Fair Compatibility';
    if (score >= 40) return 'Challenging';
    return 'Difficult Match';
  }
}

// Export singleton instance
const advancedCompatibilityController = new AdvancedCompatibilityController();
module.exports = advancedCompatibilityController;
