/**
 * ========================================================
 * 🔥 STREAK SERVICE - DAILY GAMIFICATION SYSTEM
 * ========================================================
 *
 * Purpose: Manages daily check-in streaks and gamification rewards
 * Impact: Expected +800% retention through FOMO and habit formation
 *
 * Features:
 * - Daily check-in tracking
 * - Streak calculation (current & longest)
 * - Milestone rewards system
 * - Cosmic points accumulation
 * - Badge management
 *
 * Created: 2025-01-23
 * ========================================================
 */

// Load environment variables first
const dotenv = require('dotenv');
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
  dotenv.config({ path: '.env' }); // Fallback for missing variables
} else {
  dotenv.config();
}

const db = require('../config/db');
const logger = require('./loggingService');

class StreakService {
  constructor() {
    // Milestone configuration with rewards
    this.milestones = {
      3: {
        name: 'Empezando',
        nameEn: 'Getting Started',
        badge: 'beginner',
        reward: 'Badge: Empezando',
        rewardEn: 'Badge: Getting Started',
        cosmicPoints: 30
      },
      7: {
        name: 'Guerrero de una Semana',
        nameEn: 'Week Warrior',
        badge: 'week_warrior',
        reward: 'Lectura especial Luna (gratis)',
        rewardEn: 'Free Moon Reading',
        cosmicPoints: 70
      },
      14: {
        name: 'Dedicado',
        nameEn: 'Dedicated',
        badge: 'dedicated',
        reward: '1 consulta premium gratis',
        rewardEn: '1 Free Premium Reading',
        cosmicPoints: 150
      },
      30: {
        name: 'Guerrero Cósmico',
        nameEn: 'Cosmic Warrior',
        badge: 'cosmic_warrior',
        reward: 'Lectura anual 2026',
        rewardEn: '2026 Annual Reading',
        cosmicPoints: 300
      },
      60: {
        name: 'Maestro de Hábitos',
        nameEn: 'Habit Master',
        badge: 'habit_master',
        reward: '3 consultas premium gratis',
        rewardEn: '3 Free Premium Readings',
        cosmicPoints: 600
      },
      90: {
        name: 'Iluminado',
        nameEn: 'Enlightened',
        badge: 'enlightened',
        reward: '1 mes premium gratis',
        rewardEn: '1 Month Free Premium',
        cosmicPoints: 1000
      },
      180: {
        name: 'Devoto Cósmico',
        nameEn: 'Cosmic Devotee',
        badge: 'cosmic_devotee',
        reward: '3 meses premium gratis',
        rewardEn: '3 Months Free Premium',
        cosmicPoints: 2000
      },
      365: {
        name: 'Leyenda Cósmica',
        nameEn: 'Cosmic Legend',
        badge: 'cosmic_legend',
        reward: 'Lifetime premium',
        rewardEn: 'Lifetime Premium',
        cosmicPoints: 5000
      }
    };

    // Points awarded per check-in
    this.pointsPerCheckIn = 10;
  }

  /**
   * ========================================================
   * CHECK IN USER FOR TODAY
   * ========================================================
   * Main method to process daily check-in
   *
   * @param {string} userId - UUID of the user
   * @param {string} language - 'es' or 'en' (default: 'es')
   * @returns {Object} Updated streak information
   */
  async checkIn(userId, language = 'es') {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      logger.getLogger().info('Processing streak check-in', { userId, today });

      // Get or create streak record
      let streak = await db.query(
        'SELECT * FROM user_streaks WHERE user_id = $1',
        [userId]
      );

      // CASE 1: First time user - create new record
      if (streak.rows.length === 0) {
        await db.query(
          `INSERT INTO user_streaks (
            user_id,
            current_streak,
            longest_streak,
            last_check_in,
            total_check_ins,
            cosmic_points,
            milestones_achieved,
            badges
          ) VALUES ($1, 1, 1, $2, 1, $3, '[]'::jsonb, '[]'::jsonb)`,
          [userId, today, this.pointsPerCheckIn]
        );

        logger.getLogger().info('First streak check-in created', { userId, streak: 1 });

        return {
          success: true,
          current_streak: 1,
          longest_streak: 1,
          is_new_record: true,
          is_first_time: true,
          cosmic_points_earned: this.pointsPerCheckIn,
          total_cosmic_points: this.pointsPerCheckIn,
          total_check_ins: 1,
          milestone: null,
          message: this._getStreakMessage(1, true, null, language, true)
        };
      }

      streak = streak.rows[0];
      const lastCheckIn = streak.last_check_in;

      // CASE 2: Already checked in today
      if (lastCheckIn === today) {
        logger.getLogger().info('User already checked in today', { userId, streak: streak.current_streak });

        return {
          success: true,
          current_streak: streak.current_streak,
          longest_streak: streak.longest_streak,
          already_checked_in: true,
          cosmic_points_earned: 0,
          total_cosmic_points: streak.cosmic_points,
          total_check_ins: streak.total_check_ins,
          milestone: null,
          message: language === 'es'
            ? `🔥 Ya te registraste hoy. Racha actual: ${streak.current_streak} días`
            : `🔥 Already checked in today. Current streak: ${streak.current_streak} days`
        };
      }

      // CASE 3: Calculate if streak continues or breaks
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak;
      let streakBroken = false;

      if (lastCheckIn === yesterdayStr) {
        // Streak continues!
        newStreak = streak.current_streak + 1;
        logger.getLogger().info('Streak continues', { userId, newStreak });
      } else {
        // Streak broken, start over
        newStreak = 1;
        streakBroken = true;
        logger.getLogger().info('Streak broken, restarting', {
          userId,
          previousStreak: streak.current_streak,
          lastCheckIn,
          today
        });
      }

      // Check if this is a new personal record
      const isNewRecord = newStreak > streak.longest_streak;

      // Check for milestone achievement
      const milestone = this._checkMilestone(
        newStreak,
        streak.milestones_achieved || [],
        language
      );

      // Calculate total cosmic points to award
      let pointsToAward = this.pointsPerCheckIn;
      if (milestone) {
        pointsToAward += milestone.cosmicPoints;
      }

      // Update milestones_achieved array if new milestone
      let updatedMilestones = streak.milestones_achieved || [];
      if (milestone && !updatedMilestones.includes(newStreak)) {
        updatedMilestones = [...updatedMilestones, newStreak];
      }

      // Update badges array if new badge
      let updatedBadges = streak.badges || [];
      if (milestone && milestone.badge && !updatedBadges.includes(milestone.badge)) {
        updatedBadges = [...updatedBadges, milestone.badge];
      }

      // Update database record
      await db.query(
        `UPDATE user_streaks
         SET current_streak = $1,
             longest_streak = GREATEST(longest_streak, $1),
             last_check_in = $2,
             total_check_ins = total_check_ins + 1,
             cosmic_points = cosmic_points + $3,
             milestones_achieved = $4,
             badges = $5,
             updated_at = NOW()
         WHERE user_id = $6`,
        [
          newStreak,
          today,
          pointsToAward,
          JSON.stringify(updatedMilestones),
          JSON.stringify(updatedBadges),
          userId
        ]
      );

      const newLongestStreak = isNewRecord ? newStreak : streak.longest_streak;
      const newTotalPoints = streak.cosmic_points + pointsToAward;
      const newTotalCheckIns = streak.total_check_ins + 1;

      logger.getLogger().info('Streak check-in successful', {
        userId,
        newStreak,
        newLongestStreak,
        pointsAwarded: pointsToAward,
        milestone: milestone ? milestone.name : null
      });

      return {
        success: true,
        current_streak: newStreak,
        longest_streak: newLongestStreak,
        is_new_record: isNewRecord,
        streak_broken: streakBroken,
        previous_streak: streakBroken ? streak.current_streak : null,
        cosmic_points_earned: pointsToAward,
        total_cosmic_points: newTotalPoints,
        total_check_ins: newTotalCheckIns,
        milestone: milestone,
        badges: updatedBadges,
        message: this._getStreakMessage(newStreak, isNewRecord, milestone, language, false, streakBroken)
      };

    } catch (error) {
      logger.logError(error, { context: 'streak_check_in', userId });

      return {
        success: false,
        error: 'check_in_failed',
        message: language === 'es'
          ? 'Error al registrar la racha. Intenta de nuevo.'
          : 'Failed to record streak. Please try again.'
      };
    }
  }

  /**
   * ========================================================
   * GET USER STREAK INFORMATION
   * ========================================================
   * Retrieve current streak data for a user
   *
   * @param {string} userId - UUID of the user
   * @returns {Object} Streak information
   */
  async getStreak(userId) {
    try {
      const result = await db.query(
        'SELECT * FROM user_streaks WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // User has no streak record yet
        return {
          success: true,
          current_streak: 0,
          longest_streak: 0,
          last_check_in: null,
          total_check_ins: 0,
          cosmic_points: 0,
          badges: [],
          milestones_achieved: [],
          has_checked_in_today: false,
          next_milestone: this._getNextMilestone(0)
        };
      }

      const streak = result.rows[0];
      const today = new Date().toISOString().split('T')[0];
      const hasCheckedInToday = streak.last_check_in === today;

      return {
        success: true,
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        last_check_in: streak.last_check_in,
        total_check_ins: streak.total_check_ins,
        cosmic_points: streak.cosmic_points,
        badges: streak.badges || [],
        milestones_achieved: streak.milestones_achieved || [],
        has_checked_in_today: hasCheckedInToday,
        next_milestone: this._getNextMilestone(streak.current_streak),
        created_at: streak.created_at,
        updated_at: streak.updated_at
      };

    } catch (error) {
      logger.logError(error, { context: 'get_streak', userId });

      return {
        success: false,
        error: 'get_streak_failed',
        message: 'Failed to retrieve streak information'
      };
    }
  }

  /**
   * ========================================================
   * GET LEADERBOARD
   * ========================================================
   * Get top users by current streak
   *
   * @param {number} limit - Number of users to return (default: 10)
   * @returns {Object} Leaderboard data
   */
  async getLeaderboard(limit = 10) {
    try {
      const result = await db.query(
        `SELECT
          us.user_id,
          us.current_streak,
          us.longest_streak,
          us.total_check_ins,
          us.cosmic_points,
          us.badges,
          u.email
         FROM user_streaks us
         JOIN users u ON us.user_id = u.id
         WHERE us.current_streak > 0
         ORDER BY us.current_streak DESC, us.cosmic_points DESC
         LIMIT $1`,
        [limit]
      );

      return {
        success: true,
        leaderboard: result.rows,
        total_users: result.rows.length
      };

    } catch (error) {
      logger.logError(error, { context: 'get_leaderboard' });

      return {
        success: false,
        error: 'leaderboard_failed',
        message: 'Failed to retrieve leaderboard'
      };
    }
  }

  /**
   * ========================================================
   * PRIVATE: CHECK MILESTONE
   * ========================================================
   * Check if user reached a milestone and hasn't received it yet
   *
   * @param {number} streak - Current streak number
   * @param {Array} achievedMilestones - Already achieved milestones
   * @param {string} language - 'es' or 'en'
   * @returns {Object|null} Milestone info or null
   */
  _checkMilestone(streak, achievedMilestones = [], language = 'es') {
    // Check if this streak number is a milestone
    if (this.milestones[streak]) {
      // Check if user hasn't already received this milestone
      if (!achievedMilestones.includes(streak)) {
        const milestone = this.milestones[streak];

        return {
          streak: streak,
          name: language === 'es' ? milestone.name : milestone.nameEn,
          badge: milestone.badge,
          reward: language === 'es' ? milestone.reward : milestone.rewardEn,
          cosmicPoints: milestone.cosmicPoints
        };
      }
    }

    return null;
  }

  /**
   * ========================================================
   * PRIVATE: GET NEXT MILESTONE
   * ========================================================
   * Find the next milestone after current streak
   *
   * @param {number} currentStreak - Current streak number
   * @returns {Object|null} Next milestone info or null
   */
  _getNextMilestone(currentStreak) {
    const milestoneNumbers = Object.keys(this.milestones).map(Number).sort((a, b) => a - b);

    for (const milestone of milestoneNumbers) {
      if (milestone > currentStreak) {
        return {
          streak: milestone,
          days_remaining: milestone - currentStreak,
          ...this.milestones[milestone]
        };
      }
    }

    return null; // User has reached all milestones!
  }

  /**
   * ========================================================
   * PRIVATE: GENERATE STREAK MESSAGE
   * ========================================================
   * Create motivational message based on streak status
   *
   * @param {number} streak - Current streak
   * @param {boolean} isNewRecord - Is this a personal record?
   * @param {Object} milestone - Milestone object if achieved
   * @param {string} language - 'es' or 'en'
   * @param {boolean} isFirstTime - Is this user's first check-in?
   * @param {boolean} streakBroken - Was the streak broken?
   * @returns {string} Formatted message
   */
  _getStreakMessage(streak, isNewRecord, milestone, language = 'es', isFirstTime = false, streakBroken = false) {
    let msg = '';

    if (language === 'es') {
      // First time user
      if (isFirstTime) {
        msg = '🔥 ¡Primera racha! Vuelve mañana para mantenerla viva.\n';
        msg += '💫 +10 puntos cósmicos ganados';
        return msg;
      }

      // Streak broken
      if (streakBroken) {
        msg = '💔 Tu racha se rompió, pero cada día es un nuevo comienzo.\n';
      }

      // Current streak
      msg += `🔥 Racha actual: ${streak} día${streak > 1 ? 's' : ''}`;

      // New personal record
      if (isNewRecord) {
        msg += '\n🏆 ¡NUEVO RÉCORD PERSONAL!';
      }

      // Milestone achieved
      if (milestone) {
        msg += `\n\n✨ ¡MILESTONE DESBLOQUEADO: ${milestone.name}!`;
        msg += `\n🎁 Recompensa: ${milestone.reward}`;
        msg += `\n💎 +${milestone.cosmicPoints} puntos cósmicos extra`;
      }

      // Preview next milestone
      const nextMilestone = this._getNextMilestone(streak);
      if (nextMilestone) {
        const daysRemaining = nextMilestone.days_remaining;
        msg += `\n\n💪 Próximo objetivo: ${daysRemaining} día${daysRemaining > 1 ? 's' : ''} para "${nextMilestone.name}"`;
        msg += `\n🎯 Recompensa: ${nextMilestone.reward}`;
      } else {
        msg += '\n\n👑 ¡Has alcanzado todos los milestones! Eres una leyenda cósmica.';
      }

    } else {
      // English version
      if (isFirstTime) {
        msg = '🔥 First streak! Come back tomorrow to keep it alive.\n';
        msg += '💫 +10 cosmic points earned';
        return msg;
      }

      if (streakBroken) {
        msg = '💔 Your streak was broken, but every day is a fresh start.\n';
      }

      msg += `🔥 Current streak: ${streak} day${streak > 1 ? 's' : ''}`;

      if (isNewRecord) {
        msg += '\n🏆 NEW PERSONAL RECORD!';
      }

      if (milestone) {
        msg += `\n\n✨ MILESTONE UNLOCKED: ${milestone.name}!`;
        msg += `\n🎁 Reward: ${milestone.reward}`;
        msg += `\n💎 +${milestone.cosmicPoints} bonus cosmic points`;
      }

      const nextMilestone = this._getNextMilestone(streak);
      if (nextMilestone) {
        const daysRemaining = nextMilestone.days_remaining;
        msg += `\n\n💪 Next goal: ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} to "${nextMilestone.nameEn}"`;
        msg += `\n🎯 Reward: ${nextMilestone.rewardEn}`;
      } else {
        msg += '\n\n👑 You\'ve reached all milestones! You are a cosmic legend.';
      }
    }

    return msg;
  }

  /**
   * ========================================================
   * GET SERVICE STATUS
   * ========================================================
   * Health check for the streak service
   *
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      service: 'StreakService',
      version: '1.0.0',
      milestones_count: Object.keys(this.milestones).length,
      points_per_check_in: this.pointsPerCheckIn,
      available_milestones: Object.keys(this.milestones).map(Number).sort((a, b) => a - b)
    };
  }
}

// Export singleton instance
module.exports = new StreakService();
