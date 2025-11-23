/**
 * ========================================================
 * USER BEHAVIOR ANALYZER - ML-POWERED PATTERN RECOGNITION
 * ========================================================
 *
 * Advanced machine learning service for understanding user behavior
 * patterns and predicting optimal engagement opportunities.
 *
 * Features:
 * - Usage pattern recognition
 * - Engagement scoring
 * - Churn risk prediction
 * - Optimal time window detection
 * - Interest profiling
 * - Session behavior analysis
 *
 * Created: 2025-01-23
 * ========================================================
 */

const db = require('../config/db');
const logger = require('./loggingService');
const redisService = require('./redisService');
const moment = require('moment-timezone');

class UserBehaviorAnalyzer {
  constructor() {
    this.config = {
      // Analysis windows
      analysisWindowDays: 30,
      shortTermDays: 7,
      longTermDays: 90,

      // Caching
      cacheDuration: 3600, // 1 hour
      behaviorCacheDuration: 21600, // 6 hours

      // Scoring thresholds
      highEngagementThreshold: 0.7,
      mediumEngagementThreshold: 0.4,
      churnRiskThreshold: 0.3,

      // Activity patterns
      minSessionsForAnalysis: 5,
      activeUserMinDays: 3
    };

    logger.getLogger().info('User Behavior Analyzer initialized');
  }

  /**
   * ========================================================
   * GET COMPREHENSIVE USER PROFILE
   * ========================================================
   * Main entry point for behavior analysis
   */
  async getUserBehaviorProfile(userId) {
    try {
      const cacheKey = `behavior_profile:${userId}`;
      const cached = await redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const [
        usagePatterns,
        engagementMetrics,
        interestProfile,
        sessionAnalysis,
        churnRisk,
        optimalTimes
      ] = await Promise.all([
        this.analyzeUsagePatterns(userId),
        this.calculateEngagementMetrics(userId),
        this.buildInterestProfile(userId),
        this.analyzeSessionBehavior(userId),
        this.predictChurnRisk(userId),
        this.detectOptimalTimeWindows(userId)
      ]);

      const profile = {
        userId,
        analyzedAt: new Date().toISOString(),
        usagePatterns,
        engagement: engagementMetrics,
        interests: interestProfile,
        sessions: sessionAnalysis,
        churnRisk,
        optimalTimes,
        summary: this.generateBehaviorSummary({
          usagePatterns,
          engagementMetrics,
          churnRisk
        })
      };

      // Cache the profile
      await redisService.setex(
        cacheKey,
        this.config.behaviorCacheDuration,
        JSON.stringify(profile)
      );

      return profile;

    } catch (error) {
      logger.logError(error, {
        service: 'user_behavior_analyzer',
        operation: 'get_user_behavior_profile',
        userId
      });

      return this.getDefaultProfile(userId);
    }
  }

  /**
   * ========================================================
   * ANALYZE USAGE PATTERNS
   * ========================================================
   * Detect when and how users engage with the app
   */
  async analyzeUsagePatterns(userId) {
    try {
      // Get activity logs from last 30 days
      const activities = await db.query(`
        SELECT
          DATE_TRUNC('hour', created_at) as hour,
          EXTRACT(hour FROM created_at) as hour_of_day,
          EXTRACT(dow FROM created_at) as day_of_week,
          activity_type,
          COUNT(*) as count
        FROM user_activity_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('hour', created_at),
                 EXTRACT(hour FROM created_at),
                 EXTRACT(dow FROM created_at),
                 activity_type
        ORDER BY hour DESC
      `, [userId]);

      if (activities.rows.length === 0) {
        return this.getDefaultUsagePatterns();
      }

      // Analyze hourly patterns
      const hourlyActivity = this.aggregateByHour(activities.rows);
      const dailyActivity = this.aggregateByDay(activities.rows);

      // Find peak hours
      const peakHours = this.findPeakHours(hourlyActivity);

      // Find preferred days
      const preferredDays = this.findPreferredDays(dailyActivity);

      // Detect routines
      const routines = this.detectRoutines(activities.rows);

      return {
        totalActivities: activities.rows.length,
        peakHours,
        preferredDays,
        hourlyDistribution: hourlyActivity,
        dailyDistribution: dailyActivity,
        routines,
        lastActivity: activities.rows[0]?.hour,
        consistencyScore: this.calculateConsistencyScore(activities.rows)
      };

    } catch (error) {
      logger.logError(error, { operation: 'analyze_usage_patterns', userId });
      return this.getDefaultUsagePatterns();
    }
  }

  /**
   * ========================================================
   * CALCULATE ENGAGEMENT METRICS
   * ========================================================
   * Quantify user engagement level
   */
  async calculateEngagementMetrics(userId) {
    try {
      // Get engagement data
      const metrics = await db.query(`
        SELECT
          COUNT(DISTINCT DATE(created_at)) as active_days,
          COUNT(*) as total_actions,
          MAX(created_at) as last_active,
          MIN(created_at) as first_active
        FROM user_activity_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
      `, [userId]);

      const data = metrics.rows[0];

      // Get streak data
      const streak = await db.query(
        'SELECT current_streak, total_check_ins FROM user_streaks WHERE user_id = $1',
        [userId]
      );

      const streakData = streak.rows[0] || { current_streak: 0, total_check_ins: 0 };

      // Calculate engagement score (0-1)
      const activeDays = parseInt(data.active_days) || 0;
      const totalActions = parseInt(data.total_actions) || 0;
      const currentStreak = streakData.current_streak || 0;

      const engagementScore = this.calculateEngagementScore({
        activeDays,
        totalActions,
        currentStreak,
        daysSinceFirst: moment().diff(moment(data.first_active), 'days') || 1
      });

      // Determine engagement level
      const engagementLevel = this.categorizeEngagement(engagementScore);

      // Calculate session frequency
      const avgSessionsPerDay = totalActions / Math.max(activeDays, 1);

      // Days since last active
      const daysSinceActive = data.last_active
        ? moment().diff(moment(data.last_active), 'days')
        : 999;

      return {
        engagementScore: Math.round(engagementScore * 100) / 100,
        engagementLevel,
        activeDays,
        totalActions,
        currentStreak,
        totalCheckIns: streakData.total_check_ins,
        avgSessionsPerDay: Math.round(avgSessionsPerDay * 10) / 10,
        daysSinceActive,
        isActive: daysSinceActive <= 7,
        firstActive: data.first_active,
        lastActive: data.last_active
      };

    } catch (error) {
      logger.logError(error, { operation: 'calculate_engagement_metrics', userId });
      return {
        engagementScore: 0.5,
        engagementLevel: 'medium',
        activeDays: 0,
        totalActions: 0,
        isActive: false
      };
    }
  }

  /**
   * ========================================================
   * BUILD INTEREST PROFILE
   * ========================================================
   * Understand what features user cares about
   */
  async buildInterestProfile(userId) {
    try {
      // Get feature usage
      const features = await db.query(`
        SELECT
          activity_type,
          COUNT(*) as usage_count,
          MAX(created_at) as last_used
        FROM user_activity_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY activity_type
        ORDER BY usage_count DESC
      `, [userId]);

      if (features.rows.length === 0) {
        return this.getDefaultInterests();
      }

      const totalActions = features.rows.reduce((sum, f) => sum + parseInt(f.usage_count), 0);

      const interests = features.rows.map(feature => ({
        feature: feature.activity_type,
        usageCount: parseInt(feature.usage_count),
        percentage: Math.round((parseInt(feature.usage_count) / totalActions) * 100),
        lastUsed: feature.last_used,
        affinity: this.calculateAffinityScore(
          parseInt(feature.usage_count),
          totalActions,
          feature.last_used
        )
      }));

      // Categorize interests
      const topInterests = interests.slice(0, 5).map(i => i.feature);
      const primaryInterest = interests[0]?.feature;

      return {
        topInterests,
        primaryInterest,
        allInterests: interests,
        totalFeatureCount: features.rows.length,
        diversityScore: this.calculateDiversityScore(interests)
      };

    } catch (error) {
      logger.logError(error, { operation: 'build_interest_profile', userId });
      return this.getDefaultInterests();
    }
  }

  /**
   * ========================================================
   * ANALYZE SESSION BEHAVIOR
   * ========================================================
   * Understand session patterns
   */
  async analyzeSessionBehavior(userId) {
    try {
      // Simplified session analysis based on activity clustering
      const sessions = await db.query(`
        SELECT
          DATE(created_at) as session_date,
          COUNT(*) as actions_count,
          MIN(created_at) as session_start,
          MAX(created_at) as session_end
        FROM user_activity_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY session_date DESC
      `, [userId]);

      if (sessions.rows.length === 0) {
        return this.getDefaultSessionAnalysis();
      }

      const sessionDurations = sessions.rows.map(s => {
        const duration = moment(s.session_end).diff(moment(s.session_start), 'minutes');
        return Math.max(duration, 1); // Minimum 1 minute
      });

      const avgDuration = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
      const maxDuration = Math.max(...sessionDurations);

      const avgActionsPerSession = sessions.rows.reduce(
        (sum, s) => sum + parseInt(s.actions_count), 0
      ) / sessions.rows.length;

      return {
        totalSessions: sessions.rows.length,
        avgDurationMinutes: Math.round(avgDuration * 10) / 10,
        maxDurationMinutes: maxDuration,
        avgActionsPerSession: Math.round(avgActionsPerSession * 10) / 10,
        lastSessionDate: sessions.rows[0]?.session_date,
        sessionFrequency: this.calculateSessionFrequency(sessions.rows.length)
      };

    } catch (error) {
      logger.logError(error, { operation: 'analyze_session_behavior', userId });
      return this.getDefaultSessionAnalysis();
    }
  }

  /**
   * ========================================================
   * PREDICT CHURN RISK
   * ========================================================
   * ML-based churn risk prediction
   */
  async predictChurnRisk(userId) {
    try {
      // Get recent activity
      const recentActivity = await db.query(`
        SELECT
          COUNT(DISTINCT DATE(created_at)) as recent_active_days,
          MAX(created_at) as last_active
        FROM user_activity_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '7 days'
      `, [userId]);

      const data = recentActivity.rows[0];
      const daysSinceActive = data.last_active
        ? moment().diff(moment(data.last_active), 'days')
        : 999;

      // Get streak info
      const streak = await db.query(
        'SELECT current_streak FROM user_streaks WHERE user_id = $1',
        [userId]
      );

      const currentStreak = streak.rows[0]?.current_streak || 0;

      // Calculate churn risk factors
      const factors = {
        daysSinceActive: daysSinceActive,
        recentActiveDays: parseInt(data.recent_active_days) || 0,
        streakBroken: currentStreak === 0,
        hasRecentActivity: daysSinceActive <= 3
      };

      // Calculate risk score (0-1, higher = more risk)
      let riskScore = 0;

      if (daysSinceActive > 7) riskScore += 0.4;
      else if (daysSinceActive > 3) riskScore += 0.2;

      if (factors.recentActiveDays === 0) riskScore += 0.3;
      else if (factors.recentActiveDays < 2) riskScore += 0.15;

      if (factors.streakBroken) riskScore += 0.2;

      riskScore = Math.min(riskScore, 1.0);

      // Categorize risk
      const riskLevel = this.categorizeChurnRisk(riskScore);

      return {
        riskScore: Math.round(riskScore * 100) / 100,
        riskLevel,
        factors,
        daysSinceActive,
        recommendedAction: this.getChurnPreventionAction(riskLevel, factors)
      };

    } catch (error) {
      logger.logError(error, { operation: 'predict_churn_risk', userId });
      return {
        riskScore: 0.5,
        riskLevel: 'medium',
        recommendedAction: 're_engagement_campaign'
      };
    }
  }

  /**
   * ========================================================
   * DETECT OPTIMAL TIME WINDOWS
   * ========================================================
   * Find best times to reach this user
   */
  async detectOptimalTimeWindows(userId) {
    try {
      // Get hourly activity distribution
      const hourlyData = await db.query(`
        SELECT
          EXTRACT(hour FROM created_at) as hour,
          COUNT(*) as activity_count
        FROM user_activity_logs
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY EXTRACT(hour FROM created_at)
        ORDER BY activity_count DESC
      `, [userId]);

      if (hourlyData.rows.length === 0) {
        return this.getDefaultOptimalTimes();
      }

      // Convert to time windows
      const windows = hourlyData.rows.map(row => ({
        hour: parseInt(row.hour),
        activityCount: parseInt(row.activity_count),
        score: this.scoreTimeWindow(parseInt(row.hour), parseInt(row.activity_count))
      }));

      // Sort by score
      windows.sort((a, b) => b.score - a.score);

      // Group into time ranges
      const morningWindows = windows.filter(w => w.hour >= 6 && w.hour < 12);
      const afternoonWindows = windows.filter(w => w.hour >= 12 && w.hour < 18);
      const eveningWindows = windows.filter(w => w.hour >= 18 && w.hour < 23);

      const bestOverall = windows.slice(0, 3).map(w => w.hour);
      const bestMorning = morningWindows[0]?.hour;
      const bestAfternoon = afternoonWindows[0]?.hour;
      const bestEvening = eveningWindows[0]?.hour;

      return {
        bestOverall,
        bestMorning,
        bestAfternoon,
        bestEvening,
        allWindows: windows,
        preferredTimeRange: this.determinePreferredTimeRange(windows)
      };

    } catch (error) {
      logger.logError(error, { operation: 'detect_optimal_time_windows', userId });
      return this.getDefaultOptimalTimes();
    }
  }

  /**
   * ========================================================
   * HELPER METHODS
   * ========================================================
   */

  aggregateByHour(activities) {
    const hourMap = {};

    for (let h = 0; h < 24; h++) {
      hourMap[h] = 0;
    }

    activities.forEach(act => {
      const hour = parseInt(act.hour_of_day);
      hourMap[hour] = (hourMap[hour] || 0) + parseInt(act.count);
    });

    return hourMap;
  }

  aggregateByDay(activities) {
    const dayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    activities.forEach(act => {
      const day = parseInt(act.day_of_week);
      dayMap[day] = (dayMap[day] || 0) + parseInt(act.count);
    });

    return dayMap;
  }

  findPeakHours(hourlyActivity) {
    const sorted = Object.entries(hourlyActivity)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .filter(h => h.count > 0)
      .sort((a, b) => b.count - a.count);

    return sorted.slice(0, 3).map(h => h.hour);
  }

  findPreferredDays(dailyActivity) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const sorted = Object.entries(dailyActivity)
      .map(([day, count]) => ({ day: parseInt(day), dayName: dayNames[parseInt(day)], count }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    return sorted.slice(0, 3).map(d => d.dayName);
  }

  detectRoutines(activities) {
    // Simple routine detection: frequent same-hour patterns
    const routines = [];

    // Morning routine (6-10 AM)
    const morningActivity = activities.filter(a =>
      parseInt(a.hour_of_day) >= 6 && parseInt(a.hour_of_day) < 10
    ).length;

    if (morningActivity > 10) {
      routines.push({
        type: 'morning',
        strength: 'strong',
        window: '6-10 AM'
      });
    }

    // Evening routine (6-10 PM)
    const eveningActivity = activities.filter(a =>
      parseInt(a.hour_of_day) >= 18 && parseInt(a.hour_of_day) < 22
    ).length;

    if (eveningActivity > 10) {
      routines.push({
        type: 'evening',
        strength: 'strong',
        window: '6-10 PM'
      });
    }

    return routines;
  }

  calculateConsistencyScore(activities) {
    // Measure how consistent user is across days
    const uniqueDays = new Set(activities.map(a => a.hour.toString().split(' ')[0])).size;
    const totalDays = 30;

    return Math.round((uniqueDays / totalDays) * 100) / 100;
  }

  calculateEngagementScore(data) {
    const { activeDays, totalActions, currentStreak, daysSinceFirst } = data;

    // Weighted scoring
    const activeDaysScore = Math.min(activeDays / 30, 1) * 0.3;
    const actionsScore = Math.min(totalActions / 100, 1) * 0.3;
    const streakScore = Math.min(currentStreak / 30, 1) * 0.2;
    const retentionScore = Math.min(activeDays / Math.max(daysSinceFirst, 1), 1) * 0.2;

    return activeDaysScore + actionsScore + streakScore + retentionScore;
  }

  categorizeEngagement(score) {
    if (score >= this.config.highEngagementThreshold) return 'high';
    if (score >= this.config.mediumEngagementThreshold) return 'medium';
    return 'low';
  }

  calculateAffinityScore(usageCount, totalActions, lastUsed) {
    const usageRatio = usageCount / totalActions;
    const recencyDays = moment().diff(moment(lastUsed), 'days');
    const recencyScore = Math.max(0, 1 - (recencyDays / 30));

    return (usageRatio * 0.7) + (recencyScore * 0.3);
  }

  calculateDiversityScore(interests) {
    // Shannon diversity index simplified
    const total = interests.reduce((sum, i) => sum + i.usageCount, 0);
    const proportions = interests.map(i => i.usageCount / total);

    const diversity = -proportions.reduce((sum, p) => sum + (p * Math.log(p)), 0);

    return Math.min(Math.round(diversity * 100) / 100, 1);
  }

  calculateSessionFrequency(sessionCount) {
    const perDay = sessionCount / 30;

    if (perDay >= 1) return 'daily';
    if (perDay >= 0.5) return 'frequent';
    if (perDay >= 0.2) return 'occasional';
    return 'rare';
  }

  categorizeChurnRisk(riskScore) {
    if (riskScore > 0.7) return 'high';
    if (riskScore > 0.4) return 'medium';
    return 'low';
  }

  getChurnPreventionAction(riskLevel, factors) {
    if (riskLevel === 'high') {
      if (factors.daysSinceActive > 14) return 'win_back_campaign';
      if (factors.streakBroken) return 'streak_recovery';
      return 'urgent_re_engagement';
    }

    if (riskLevel === 'medium') {
      if (factors.daysSinceActive > 3) return 'gentle_reminder';
      return 'engagement_boost';
    }

    return 'none';
  }

  scoreTimeWindow(hour, activityCount) {
    let score = activityCount;

    // Boost good notification hours
    if (hour >= 8 && hour <= 10) score *= 1.2; // Morning
    if (hour >= 18 && hour <= 21) score *= 1.3; // Evening

    // Penalty for bad hours
    if (hour >= 22 || hour <= 6) score *= 0.5;

    return Math.round(score);
  }

  determinePreferredTimeRange(windows) {
    const morning = windows.filter(w => w.hour >= 6 && w.hour < 12)
      .reduce((sum, w) => sum + w.score, 0);

    const afternoon = windows.filter(w => w.hour >= 12 && w.hour < 18)
      .reduce((sum, w) => sum + w.score, 0);

    const evening = windows.filter(w => w.hour >= 18 && w.hour < 23)
      .reduce((sum, w) => sum + w.score, 0);

    const max = Math.max(morning, afternoon, evening);

    if (max === morning) return 'morning';
    if (max === afternoon) return 'afternoon';
    return 'evening';
  }

  generateBehaviorSummary(data) {
    const { usagePatterns, engagementMetrics, churnRisk } = data;

    return {
      userType: this.classifyUserType(engagementMetrics.engagementLevel, usagePatterns.consistencyScore),
      healthScore: this.calculateUserHealthScore(engagementMetrics, churnRisk),
      keyInsights: this.generateKeyInsights(data),
      recommendations: this.generateRecommendations(data)
    };
  }

  classifyUserType(engagementLevel, consistencyScore) {
    if (engagementLevel === 'high' && consistencyScore > 0.5) return 'power_user';
    if (engagementLevel === 'high') return 'enthusiast';
    if (engagementLevel === 'medium' && consistencyScore > 0.5) return 'regular_user';
    if (engagementLevel === 'medium') return 'casual_user';
    return 'at_risk_user';
  }

  calculateUserHealthScore(engagement, churnRisk) {
    const engagementScore = engagement.engagementScore * 100;
    const churnPenalty = churnRisk.riskScore * 50;

    return Math.max(0, Math.min(100, Math.round(engagementScore - churnPenalty)));
  }

  generateKeyInsights(data) {
    const insights = [];

    if (data.engagementMetrics.engagementLevel === 'high') {
      insights.push('Highly engaged user - excellent retention candidate');
    }

    if (data.churnRisk.riskLevel === 'high') {
      insights.push(`User at churn risk - ${data.churnRisk.daysSinceActive} days inactive`);
    }

    if (data.usagePatterns.routines.length > 0) {
      insights.push(`Strong ${data.usagePatterns.routines[0].type} routine detected`);
    }

    return insights;
  }

  generateRecommendations(data) {
    const recommendations = [];

    if (data.churnRisk.recommendedAction !== 'none') {
      recommendations.push({
        action: data.churnRisk.recommendedAction,
        priority: 'high'
      });
    }

    if (data.engagementMetrics.currentStreak > 0) {
      recommendations.push({
        action: 'streak_protection_notification',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * ========================================================
   * DEFAULT FALLBACKS
   * ========================================================
   */

  getDefaultProfile(userId) {
    return {
      userId,
      analyzedAt: new Date().toISOString(),
      usagePatterns: this.getDefaultUsagePatterns(),
      engagement: {
        engagementScore: 0.5,
        engagementLevel: 'medium',
        isActive: false
      },
      interests: this.getDefaultInterests(),
      sessions: this.getDefaultSessionAnalysis(),
      churnRisk: { riskScore: 0.5, riskLevel: 'medium' },
      optimalTimes: this.getDefaultOptimalTimes(),
      summary: {
        userType: 'new_user',
        healthScore: 50,
        keyInsights: ['Insufficient data for analysis'],
        recommendations: []
      }
    };
  }

  getDefaultUsagePatterns() {
    return {
      totalActivities: 0,
      peakHours: [9, 12, 18],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      hourlyDistribution: {},
      dailyDistribution: {},
      routines: [],
      consistencyScore: 0
    };
  }

  getDefaultInterests() {
    return {
      topInterests: ['horoscope', 'compatibility'],
      primaryInterest: 'horoscope',
      allInterests: [],
      totalFeatureCount: 0,
      diversityScore: 0
    };
  }

  getDefaultSessionAnalysis() {
    return {
      totalSessions: 0,
      avgDurationMinutes: 5,
      maxDurationMinutes: 0,
      avgActionsPerSession: 0,
      sessionFrequency: 'rare'
    };
  }

  getDefaultOptimalTimes() {
    return {
      bestOverall: [9, 12, 18],
      bestMorning: 9,
      bestAfternoon: 12,
      bestEvening: 18,
      allWindows: [],
      preferredTimeRange: 'morning'
    };
  }

  /**
   * ========================================================
   * PUBLIC API
   * ========================================================
   */

  async quickEngagementCheck(userId) {
    try {
      const cached = await redisService.get(`quick_engagement:${userId}`);
      if (cached) return JSON.parse(cached);

      const result = await db.query(`
        SELECT
          CASE
            WHEN MAX(created_at) > NOW() - INTERVAL '3 days' THEN 'active'
            WHEN MAX(created_at) > NOW() - INTERVAL '7 days' THEN 'warm'
            WHEN MAX(created_at) > NOW() - INTERVAL '30 days' THEN 'cold'
            ELSE 'dormant'
          END as status
        FROM user_activity_logs
        WHERE user_id = $1
      `, [userId]);

      const status = result.rows[0]?.status || 'new';

      await redisService.setex(`quick_engagement:${userId}`, 3600, JSON.stringify(status));

      return status;

    } catch (error) {
      logger.logError(error, { operation: 'quick_engagement_check', userId });
      return 'unknown';
    }
  }

  /**
   * ========================================================
   * GET STATUS
   * ========================================================
   */
  getStatus() {
    return {
      service: 'UserBehaviorAnalyzer',
      version: '1.0.0',
      config: this.config,
      status: 'operational'
    };
  }
}

// Export singleton
module.exports = new UserBehaviorAnalyzer();
