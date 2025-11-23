/**
 * ================================================================================
 * ELITE ANALYTICS ENGINE - COMPLETE BUSINESS INTELLIGENCE SYSTEM
 * ================================================================================
 *
 * Revolutionary analytics system that tracks EVERYTHING and provides
 * ACTIONABLE insights to optimize revenue and user engagement.
 *
 * FEATURES:
 * ✅ Real-time Metrics Dashboard
 * ✅ Revenue Analytics (MRR/ARR, Churn, LTV)
 * ✅ User Cohort Analysis
 * ✅ Feature Usage Attribution
 * ✅ A/B Testing Framework
 * ✅ Predictive Analytics
 * ✅ Automated Insights & Alerts
 * ✅ Geographic & Demographic Analytics
 *
 * GOAL: Make data-driven decisions that 2x revenue every 3 months
 */

const logger = require('./loggingService');
const { Pool } = require('pg');

class AnalyticsEngine {
  constructor() {
    this.version = '2.0.0';
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Cache for real-time metrics (5-minute TTL)
    this.metricsCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes

    // Initialize periodic jobs
    this.initializePeriodicJobs();
  }

  // ============================================================================
  // REAL-TIME METRICS DASHBOARD
  // ============================================================================

  /**
   * Get comprehensive real-time metrics
   * Returns the current state of the business at a glance
   */
  async getRealtimeMetrics() {
    try {
      // Check cache first
      const cached = this.getFromCache('realtime_metrics');
      if (cached) return cached;

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      // Parallel execution for speed
      const [
        activeUsers,
        todayStats,
        thisHourStats,
        trends
      ] = await Promise.all([
        this.getActiveUsersCount(),
        this.getTodayRevenue(),
        this.getHourlyStats(thisHour),
        this.calculateTrends()
      ]);

      const metrics = {
        now: {
          timestamp: now.toISOString(),
          activeUsers: activeUsers,
          messagesPerMinute: thisHourStats.messagesPerMinute || 0,
          premiumConversions: todayStats.conversions || 0,
          revenue: {
            today: todayStats.revenue || 0,
            thisHour: thisHourStats.revenue || 0
          }
        },
        trends: {
          usersVsYesterday: trends.users || 0,
          revenueVsLastWeek: trends.revenue || 0,
          conversionRateChange: trends.conversion || 0
        },
        health: {
          status: 'healthy',
          uptime: process.uptime(),
          lastUpdated: now.toISOString()
        }
      };

      this.setCache('realtime_metrics', metrics);
      return metrics;

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'get_realtime_metrics'
      });
      throw error;
    }
  }

  /**
   * Get active users count (last 15 minutes)
   */
  async getActiveUsersCount() {
    const query = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE created_at >= NOW() - INTERVAL '15 minutes'
    `;

    const result = await this.db.query(query);
    return parseInt(result.rows[0]?.count || 0);
  }

  /**
   * Get today's revenue statistics
   */
  async getTodayRevenue() {
    const query = `
      SELECT
        COALESCE(SUM(price_paid), 0) as revenue,
        COUNT(*) FILTER (WHERE start_date::date = CURRENT_DATE) as conversions
      FROM subscription_analytics
      WHERE start_date::date = CURRENT_DATE
        AND subscription_status = 'active'
    `;

    const result = await this.db.query(query);
    return {
      revenue: parseFloat(result.rows[0]?.revenue || 0),
      conversions: parseInt(result.rows[0]?.conversions || 0)
    };
  }

  /**
   * Get hourly statistics
   */
  async getHourlyStats(hour) {
    const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'chat_message_sent') as messages,
        COALESCE(SUM(
          CASE WHEN event_type = 'premium_purchase'
          THEN (event_properties->>'amount')::decimal
          ELSE 0 END
        ), 0) as revenue
      FROM analytics_events
      WHERE created_at >= $1 AND created_at < $2
    `;

    const result = await this.db.query(query, [hour, nextHour]);
    const messages = parseInt(result.rows[0]?.messages || 0);

    return {
      messagesPerMinute: messages / 60,
      revenue: parseFloat(result.rows[0]?.revenue || 0)
    };
  }

  /**
   * Calculate trends vs previous periods
   */
  async calculateTrends() {
    const query = `
      WITH today_metrics AS (
        SELECT COUNT(DISTINCT user_id) as users
        FROM analytics_events
        WHERE created_at::date = CURRENT_DATE
      ),
      yesterday_metrics AS (
        SELECT COUNT(DISTINCT user_id) as users
        FROM analytics_events
        WHERE created_at::date = CURRENT_DATE - 1
      ),
      this_week_revenue AS (
        SELECT COALESCE(SUM(price_paid), 0) as revenue
        FROM subscription_analytics
        WHERE start_date >= CURRENT_DATE - 7
      ),
      last_week_revenue AS (
        SELECT COALESCE(SUM(price_paid), 0) as revenue
        FROM subscription_analytics
        WHERE start_date >= CURRENT_DATE - 14
          AND start_date < CURRENT_DATE - 7
      )
      SELECT
        CASE
          WHEN y.users > 0 THEN ((t.users::decimal - y.users) / y.users * 100)
          ELSE 0
        END as user_change,
        CASE
          WHEN lw.revenue > 0 THEN ((tw.revenue - lw.revenue) / lw.revenue * 100)
          ELSE 0
        END as revenue_change
      FROM today_metrics t, yesterday_metrics y, this_week_revenue tw, last_week_revenue lw
    `;

    const result = await this.db.query(query);
    return {
      users: parseFloat(result.rows[0]?.user_change || 0),
      revenue: parseFloat(result.rows[0]?.revenue_change || 0),
      conversion: 0 // TODO: Calculate conversion rate change
    };
  }

  // ============================================================================
  // REVENUE ANALYTICS
  // ============================================================================

  /**
   * Get comprehensive revenue breakdown
   * MRR, ARR, churn rates, LTV, growth metrics
   */
  async getRevenueBreakdown() {
    try {
      const cached = this.getFromCache('revenue_breakdown');
      if (cached) return cached;

      const [
        mrrData,
        tierBreakdown,
        churnData,
        growthMetrics
      ] = await Promise.all([
        this.calculateMRR(),
        this.getRevenueByTier(),
        this.getChurnMetrics(),
        this.getGrowthMetrics()
      ]);

      const breakdown = {
        mrr: mrrData.mrr,
        arr: mrrData.mrr * 12,
        byTier: tierBreakdown,
        churnPrevention: churnData,
        growthMetrics: growthMetrics,
        lastUpdated: new Date().toISOString()
      };

      this.setCache('revenue_breakdown', breakdown);
      return breakdown;

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'get_revenue_breakdown'
      });
      throw error;
    }
  }

  /**
   * Calculate Monthly Recurring Revenue (MRR)
   */
  async calculateMRR() {
    const query = `
      SELECT
        COUNT(*) as active_subscriptions,
        COALESCE(SUM(
          CASE subscription_tier
            WHEN 'cosmic' THEN 4.99
            WHEN 'stellar' THEN 9.99
            ELSE 0
          END
        ), 0) as mrr
      FROM subscription_analytics
      WHERE subscription_status = 'active'
        AND (end_date IS NULL OR end_date > NOW())
    `;

    const result = await this.db.query(query);
    return {
      mrr: parseFloat(result.rows[0]?.mrr || 0),
      activeSubscriptions: parseInt(result.rows[0]?.active_subscriptions || 0)
    };
  }

  /**
   * Get revenue breakdown by tier
   */
  async getRevenueByTier() {
    const query = `
      SELECT
        subscription_tier as tier,
        COUNT(*) as subscribers,
        COALESCE(SUM(
          CASE subscription_tier
            WHEN 'cosmic' THEN 4.99
            WHEN 'stellar' THEN 9.99
            ELSE 0
          END
        ), 0) as mrr,
        AVG(
          EXTRACT(EPOCH FROM (COALESCE(end_date, NOW()) - start_date)) / 86400
        ) as avg_lifetime_days
      FROM subscription_analytics
      WHERE subscription_status IN ('active', 'cancelled')
      GROUP BY subscription_tier
    `;

    const result = await this.db.query(query);
    const breakdown = {};

    result.rows.forEach(row => {
      const tier = row.tier;
      const monthlyPrice = tier === 'cosmic' ? 4.99 : 9.99;
      const avgLifetimeDays = parseFloat(row.avg_lifetime_days || 0);
      const ltv = (avgLifetimeDays / 30) * monthlyPrice;

      breakdown[tier] = {
        subscribers: parseInt(row.subscribers),
        mrr: parseFloat(row.mrr || 0),
        churnRate: await this.getTierChurnRate(tier),
        ltv: ltv
      };
    });

    return breakdown;
  }

  /**
   * Calculate churn rate for a specific tier
   */
  async getTierChurnRate(tier) {
    const query = `
      WITH monthly_stats AS (
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) FILTER (WHERE subscription_status = 'active') as active,
          COUNT(*) FILTER (WHERE subscription_status = 'cancelled') as cancelled
        FROM subscription_analytics
        WHERE subscription_tier = $1
          AND created_at >= NOW() - INTERVAL '3 months'
        GROUP BY month
      )
      SELECT AVG(
        CASE WHEN active > 0
        THEN (cancelled::decimal / (active + cancelled) * 100)
        ELSE 0 END
      ) as avg_churn_rate
      FROM monthly_stats
    `;

    const result = await this.db.query(query, [tier]);
    return parseFloat(result.rows[0]?.avg_churn_rate || 0);
  }

  /**
   * Get churn prevention metrics
   */
  async getChurnMetrics() {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE churn_probability >= 70) as users_at_risk,
        COUNT(*) FILTER (
          WHERE prediction_date >= CURRENT_DATE - 30
          AND churn_probability < 70
        ) as recovered_this_month
      FROM churn_predictions
      WHERE prediction_date >= CURRENT_DATE - 30
    `;

    const result = await this.db.query(query);
    const usersAtRisk = parseInt(result.rows[0]?.users_at_risk || 0);
    const recovered = parseInt(result.rows[0]?.recovered_this_month || 0);

    return {
      usersAtRisk,
      recoveredThisMonth: recovered,
      revenueRecovered: recovered * 7.5 // Average between cosmic and stellar
    };
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics() {
    const query = `
      WITH current_month AS (
        SELECT COUNT(*) as subs, COALESCE(SUM(price_paid), 0) as revenue
        FROM subscription_analytics
        WHERE DATE_TRUNC('month', start_date) = DATE_TRUNC('month', CURRENT_DATE)
      ),
      last_month AS (
        SELECT COUNT(*) as subs, COALESCE(SUM(price_paid), 0) as revenue
        FROM subscription_analytics
        WHERE DATE_TRUNC('month', start_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      )
      SELECT
        CASE WHEN lm.revenue > 0
        THEN ((cm.revenue - lm.revenue) / lm.revenue * 100)
        ELSE 0 END as mom_growth,
        cm.revenue / NULLIF(cm.subs, 0) as current_arpu
      FROM current_month cm, last_month lm
    `;

    const result = await this.db.query(query);
    const momGrowth = parseFloat(result.rows[0]?.mom_growth || 0);
    const arpu = parseFloat(result.rows[0]?.current_arpu || 0);
    const cac = 12.50; // Customer Acquisition Cost (placeholder - integrate with ad spend)
    const ltv = arpu * 6; // Estimate based on 6 month average lifetime

    return {
      momGrowth,
      cac,
      ltvcacRatio: ltv / cac,
      paybackPeriod: `${(cac / arpu).toFixed(1)} months`
    };
  }

  // ============================================================================
  // USER COHORT ANALYSIS
  // ============================================================================

  /**
   * Analyze user cohorts by signup date
   * Track retention, LTV, and conversion rates
   */
  async analyzeUserCohorts(options = {}) {
    try {
      const {
        period = '30days',
        groupBy = 'signup_date' // 'signup_date', 'zodiac_sign', 'country', 'language'
      } = options;

      let cohortData;

      switch (groupBy) {
        case 'zodiac_sign':
          cohortData = await this.analyzeByZodiacSign();
          break;
        case 'country':
          cohortData = await this.analyzeByCountry();
          break;
        case 'language':
          cohortData = await this.analyzeByLanguage();
          break;
        default:
          cohortData = await this.analyzeBySignupDate(period);
      }

      return {
        groupBy,
        period,
        cohorts: cohortData,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'analyze_user_cohorts',
        options
      });
      throw error;
    }
  }

  /**
   * Analyze cohorts by signup date
   */
  async analyzeBySignupDate(period) {
    const daysBack = period === '30days' ? 30 : (period === '90days' ? 90 : 365);

    const query = `
      WITH cohort_data AS (
        SELECT
          DATE_TRUNC('month', cohort_date) as cohort,
          COUNT(*) as total_users,
          AVG(lifetime_value) as avg_ltv,
          COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL) as premium_users
        FROM user_cohorts
        WHERE cohort_date >= CURRENT_DATE - $1
        GROUP BY DATE_TRUNC('month', cohort_date)
      ),
      retention_data AS (
        SELECT
          cohort_date,
          MAX(CASE WHEN period_number = 1 THEN retention_rate END) as day1,
          MAX(CASE WHEN period_number = 7 THEN retention_rate END) as day7,
          MAX(CASE WHEN period_number = 30 THEN retention_rate END) as day30,
          MAX(CASE WHEN period_number = 90 THEN retention_rate END) as day90
        FROM cohort_retention_metrics crm
        JOIN user_cohorts uc ON uc.cohort_date = crm.cohort_date
        WHERE crm.period_type = 'day'
          AND uc.cohort_date >= CURRENT_DATE - $1
        GROUP BY cohort_date
      )
      SELECT
        TO_CHAR(cd.cohort, 'Mon YYYY') as cohort,
        cd.total_users,
        COALESCE(rd.day1, 0) as day1_retention,
        COALESCE(rd.day7, 0) as day7_retention,
        COALESCE(rd.day30, 0) as day30_retention,
        COALESCE(rd.day90, 0) as day90_retention,
        cd.avg_ltv,
        CASE WHEN cd.total_users > 0
        THEN (cd.premium_users::decimal / cd.total_users * 100)
        ELSE 0 END as premium_conversion_rate
      FROM cohort_data cd
      LEFT JOIN retention_data rd ON DATE_TRUNC('month', rd.cohort_date) = cd.cohort
      ORDER BY cd.cohort DESC
    `;

    const result = await this.db.query(query, [daysBack]);

    return result.rows.map(row => ({
      cohort: row.cohort,
      totalUsers: parseInt(row.total_users),
      retention: {
        day1: parseFloat(row.day1_retention || 0),
        day7: parseFloat(row.day7_retention || 0),
        day30: parseFloat(row.day30_retention || 0),
        day90: parseFloat(row.day90_retention || 0)
      },
      ltv: parseFloat(row.avg_ltv || 0),
      premiumConversionRate: parseFloat(row.premium_conversion_rate || 0)
    }));
  }

  /**
   * Analyze cohorts by zodiac sign
   */
  async analyzeByZodiacSign() {
    const query = `
      SELECT
        zodiac_sign as sign,
        COUNT(*) as total_users,
        AVG(total_sessions / GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(last_active_date, CURRENT_DATE) - cohort_date)) / 86400)) as avg_session_length_minutes,
        COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL) as premium_users,
        AVG(lifetime_value) as avg_ltv,
        CASE WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL)::decimal / COUNT(*) * 100)
        ELSE 0 END as premium_conversion_rate
      FROM user_cohorts
      WHERE zodiac_sign IS NOT NULL
      GROUP BY zodiac_sign
      ORDER BY premium_conversion_rate DESC
    `;

    const result = await this.db.query(query);

    return result.rows.map(row => ({
      sign: row.sign,
      totalUsers: parseInt(row.total_users),
      engagement: this.classifyEngagement(parseFloat(row.avg_session_length_minutes || 0)),
      avgSessionLength: `${parseFloat(row.avg_session_length_minutes || 0).toFixed(1)} min`,
      premiumConversionRate: parseFloat(row.premium_conversion_rate || 0),
      favoriteFeatures: ['Compatibility', 'Daily Horoscope'] // TODO: Get from feature_usage_analytics
    }));
  }

  /**
   * Analyze cohorts by country
   */
  async analyzeByCountry() {
    const query = `
      SELECT
        signup_country as country,
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL) as premium_users,
        AVG(lifetime_value) as avg_ltv,
        CASE WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL)::decimal / COUNT(*) * 100)
        ELSE 0 END as conversion_rate
      FROM user_cohorts
      WHERE signup_country IS NOT NULL
      GROUP BY signup_country
      HAVING COUNT(*) >= 10
      ORDER BY total_users DESC
      LIMIT 20
    `;

    const result = await this.db.query(query);

    return result.rows.map(row => ({
      country: row.country,
      totalUsers: parseInt(row.total_users),
      premiumUsers: parseInt(row.premium_users),
      avgLTV: parseFloat(row.avg_ltv || 0),
      conversionRate: parseFloat(row.conversion_rate || 0)
    }));
  }

  /**
   * Analyze cohorts by language
   */
  async analyzeByLanguage() {
    const query = `
      SELECT
        signup_language as language,
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL) as premium_users,
        AVG(lifetime_value) as avg_ltv,
        CASE WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (WHERE first_premium_date IS NOT NULL)::decimal / COUNT(*) * 100)
        ELSE 0 END as conversion_rate
      FROM user_cohorts
      WHERE signup_language IS NOT NULL
      GROUP BY signup_language
      ORDER BY total_users DESC
    `;

    const result = await this.db.query(query);

    return result.rows.map(row => ({
      language: row.language,
      totalUsers: parseInt(row.total_users),
      premiumUsers: parseInt(row.premium_users),
      avgLTV: parseFloat(row.avg_ltv || 0),
      conversionRate: parseFloat(row.conversion_rate || 0)
    }));
  }

  // ============================================================================
  // FEATURE USAGE ANALYTICS
  // ============================================================================

  /**
   * Analyze feature usage and revenue attribution
   */
  async analyzeFeatureUsage(options = {}) {
    try {
      const { timeRange = '30days' } = options;
      const daysBack = timeRange === '7days' ? 7 : (timeRange === '30days' ? 30 : 90);

      const query = `
        SELECT
          feature_name,
          feature_category,
          SUM(total_users) as daily_active_users,
          AVG(total_users) as avg_daily_users,
          SUM(conversion_events) as total_conversions,
          SUM(revenue_attributed) as total_revenue,
          AVG(satisfaction_score) as avg_satisfaction
        FROM feature_usage_analytics
        WHERE usage_date >= CURRENT_DATE - $1
        GROUP BY feature_name, feature_category
        ORDER BY total_revenue DESC, daily_active_users DESC
      `;

      const result = await this.db.query(query, [daysBack]);

      const features = result.rows.map(row => ({
        name: row.feature_name,
        usage: parseInt(row.daily_active_users || 0),
        engagement: this.calculateEngagementPercentage(parseInt(row.avg_daily_users || 0)),
        premiumUpsell: parseInt(row.total_conversions || 0),
        revenueImpact: parseFloat(row.total_revenue || 0),
        satisfaction: parseFloat(row.avg_satisfaction || 0)
      }));

      const recommendations = this.generateFeatureRecommendations(features);

      return {
        timeRange,
        features,
        recommendations,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'analyze_feature_usage',
        options
      });
      throw error;
    }
  }

  /**
   * Generate feature recommendations based on analytics
   */
  generateFeatureRecommendations(features) {
    const recommendations = [];

    // Find top converter
    const topConverter = features.reduce((max, f) =>
      f.premiumUpsell > max.premiumUpsell ? f : max, features[0]);

    if (topConverter && topConverter.premiumUpsell > 0) {
      const conversionPercent = (topConverter.premiumUpsell / topConverter.usage * 100).toFixed(1);
      recommendations.push(
        `Promote ${topConverter.name} feature more - drives ${conversionPercent}% of conversions`
      );
    }

    // Find high engagement features
    const highEngagement = features.filter(f => parseFloat(f.engagement) > 40);
    highEngagement.forEach(f => {
      recommendations.push(
        `${f.name} working well - ${f.engagement}% engagement`
      );
    });

    // Suggest improvements for low performers
    const lowEngagement = features.filter(f => parseFloat(f.engagement) < 20 && f.usage > 100);
    if (lowEngagement.length > 0) {
      recommendations.push(
        `Consider improving UX for: ${lowEngagement.map(f => f.name).join(', ')}`
      );
    }

    return recommendations;
  }

  // ============================================================================
  // PREDICTIVE ANALYTICS
  // ============================================================================

  /**
   * Predict revenue for next N months
   */
  async predictRevenue(months = 6) {
    try {
      const historicalGrowth = await this.calculateHistoricalGrowth();
      const currentMRR = (await this.calculateMRR()).mrr;

      const predictions = {
        conservative: [],
        optimistic: []
      };

      // Conservative prediction (50% of historical growth)
      let conservativeMRR = currentMRR;
      const conservativeGrowthRate = historicalGrowth.monthlyGrowthRate * 0.5 / 100;

      // Optimistic prediction (100% of historical growth)
      let optimisticMRR = currentMRR;
      const optimisticGrowthRate = historicalGrowth.monthlyGrowthRate / 100;

      const startDate = new Date();

      for (let i = 1; i <= months; i++) {
        const monthDate = new Date(startDate);
        monthDate.setMonth(monthDate.getMonth() + i);
        const monthStr = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        // Conservative
        conservativeMRR = conservativeMRR * (1 + conservativeGrowthRate);
        predictions.conservative.push({
          month: monthStr,
          mrr: parseFloat(conservativeMRR.toFixed(2)),
          arr: parseFloat((conservativeMRR * 12).toFixed(2))
        });

        // Optimistic
        optimisticMRR = optimisticMRR * (1 + optimisticGrowthRate);
        predictions.optimistic.push({
          month: monthStr,
          mrr: parseFloat(optimisticMRR.toFixed(2)),
          arr: parseFloat((optimisticMRR * 12).toFixed(2))
        });
      }

      return {
        ...predictions,
        assumptions: {
          monthlyGrowthRate: `${historicalGrowth.monthlyGrowthRate.toFixed(1)}%`,
          churnRate: `${historicalGrowth.churnRate.toFixed(1)}%`,
          conversionRate: `${historicalGrowth.conversionRate.toFixed(1)}%`,
          basedOnMonths: historicalGrowth.monthsAnalyzed
        }
      };

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'predict_revenue'
      });
      throw error;
    }
  }

  /**
   * Calculate historical growth rates
   */
  async calculateHistoricalGrowth() {
    const query = `
      WITH monthly_revenue AS (
        SELECT
          DATE_TRUNC('month', metric_date) as month,
          AVG(mrr) as avg_mrr,
          AVG(churn_rate) as avg_churn,
          AVG(active_subscriptions) as avg_subs
        FROM revenue_metrics
        WHERE metric_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month
      ),
      growth_calc AS (
        SELECT
          AVG(
            CASE WHEN LAG(avg_mrr) OVER (ORDER BY month) > 0
            THEN ((avg_mrr - LAG(avg_mrr) OVER (ORDER BY month)) /
                  LAG(avg_mrr) OVER (ORDER BY month) * 100)
            ELSE 0 END
          ) as monthly_growth_rate,
          AVG(avg_churn) as avg_churn_rate,
          COUNT(*) as months_analyzed
        FROM monthly_revenue
      )
      SELECT
        monthly_growth_rate,
        avg_churn_rate,
        months_analyzed
      FROM growth_calc
    `;

    const result = await this.db.query(query);

    return {
      monthlyGrowthRate: parseFloat(result.rows[0]?.monthly_growth_rate || 15),
      churnRate: parseFloat(result.rows[0]?.avg_churn_rate || 5),
      conversionRate: 10, // TODO: Calculate from actual data
      monthsAnalyzed: parseInt(result.rows[0]?.months_analyzed || 0)
    };
  }

  // ============================================================================
  // AUTOMATED INSIGHTS & ALERTS
  // ============================================================================

  /**
   * Generate automated insights
   */
  async generateInsights() {
    try {
      const insights = {
        opportunities: [],
        alerts: []
      };

      // Analyze zodiac sign performance
      const zodiacCohorts = await this.analyzeByZodiacSign();
      const avgConversion = zodiacCohorts.reduce((sum, c) =>
        sum + c.premiumConversionRate, 0) / zodiacCohorts.length;

      // Find high-performing segments
      zodiacCohorts.forEach(cohort => {
        if (cohort.premiumConversionRate > avgConversion * 1.3) {
          insights.opportunities.push({
            type: 'revenue',
            insight: `${cohort.sign} users convert at ${cohort.premiumConversionRate.toFixed(1)}% vs ${avgConversion.toFixed(1)}% average. Consider ${cohort.sign}-specific marketing.`,
            expectedImpact: `+$${(cohort.totalUsers * 5).toFixed(0)}/month`,
            effort: 'Low'
          });
        }
      });

      // Check for churn alerts
      const churnMetrics = await this.getChurnMetrics();
      if (churnMetrics.usersAtRisk > 100) {
        insights.alerts.push({
          severity: 'high',
          message: `${churnMetrics.usersAtRisk} users at high risk of churning. Implement retention campaigns immediately.`,
          affectedUsers: churnMetrics.usersAtRisk,
          revenueAtRisk: churnMetrics.usersAtRisk * 7.5
        });
      }

      // Feature usage insights
      const featureAnalysis = await this.analyzeFeatureUsage({ timeRange: '30days' });
      const topFeature = featureAnalysis.features[0];

      if (topFeature && topFeature.premiumUpsell > 50) {
        insights.opportunities.push({
          type: 'retention',
          insight: `Users engaging with ${topFeature.name} show higher retention. Promote this feature more prominently.`,
          expectedImpact: '+25% retention',
          effort: 'Medium'
        });
      }

      return insights;

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'generate_insights'
      });
      throw error;
    }
  }

  // ============================================================================
  // A/B TESTING FRAMEWORK
  // ============================================================================

  /**
   * Get A/B test results
   */
  async getABTestResults(experimentId = null) {
    try {
      let query;
      let params = [];

      if (experimentId) {
        query = `
          SELECT
            e.experiment_name,
            e.experiment_type,
            e.status,
            e.target_metric,
            r.variant,
            SUM(r.users_count) as users,
            AVG(r.conversion_rate) as avg_conversion_rate,
            SUM(r.revenue) as total_revenue,
            AVG(r.revenue_per_user) as avg_revenue_per_user
          FROM ab_test_experiments e
          JOIN ab_test_results r ON e.id = r.experiment_id
          WHERE e.id = $1
          GROUP BY e.id, e.experiment_name, e.experiment_type, e.status, e.target_metric, r.variant
          ORDER BY r.variant
        `;
        params = [experimentId];
      } else {
        query = `
          SELECT
            e.id,
            e.experiment_name,
            e.experiment_type,
            e.status,
            e.target_metric,
            r.variant,
            SUM(r.users_count) as users,
            AVG(r.conversion_rate) as avg_conversion_rate,
            SUM(r.revenue) as total_revenue
          FROM ab_test_experiments e
          JOIN ab_test_results r ON e.id = r.experiment_id
          WHERE e.status = 'active'
          GROUP BY e.id, e.experiment_name, e.experiment_type, e.status, e.target_metric, r.variant
          ORDER BY e.id, r.variant
        `;
      }

      const result = await this.db.query(query, params);

      // Group by experiment
      const experiments = {};
      result.rows.forEach(row => {
        const expName = row.experiment_name;
        if (!experiments[expName]) {
          experiments[expName] = {
            name: expName,
            type: row.experiment_type,
            status: row.status,
            targetMetric: row.target_metric,
            variants: {}
          };
        }

        experiments[expName].variants[row.variant] = {
          users: parseInt(row.users),
          conversionRate: parseFloat(row.avg_conversion_rate || 0),
          revenue: parseFloat(row.total_revenue || 0),
          revenuePerUser: parseFloat(row.avg_revenue_per_user || 0)
        };
      });

      // Calculate winners and confidence
      const activeTests = Object.values(experiments).map(exp => {
        const variants = exp.variants;
        const variantNames = Object.keys(variants);

        if (variantNames.length < 2) return null;

        const control = variants[exp.control_variant || variantNames[0]];
        const test = variants[variantNames[1]];

        if (!control || !test) return null;

        const improvement = ((test.conversionRate - control.conversionRate) / control.conversionRate * 100);
        const isWinner = improvement > 5; // 5% lift threshold

        return {
          name: exp.name,
          variants: {
            control: { ...control, variant: variantNames[0] },
            variant: { ...test, variant: variantNames[1] }
          },
          winner: isWinner ? variantNames[1] : null,
          confidence: this.calculateStatisticalConfidence(control, test),
          improvement: improvement,
          recommendation: isWinner ? `Roll out ${variantNames[1]} to 100%` : 'Continue testing'
        };
      }).filter(Boolean);

      return { activeTests };

    } catch (error) {
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'get_ab_test_results',
        experimentId
      });
      throw error;
    }
  }

  /**
   * Calculate statistical confidence (simplified z-test)
   */
  calculateStatisticalConfidence(control, variant) {
    const p1 = control.conversionRate / 100;
    const p2 = variant.conversionRate / 100;
    const n1 = control.users;
    const n2 = variant.users;

    if (n1 < 100 || n2 < 100) return 0; // Not enough data

    const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(pPool * (1 - pPool) * (1/n1 + 1/n2));

    if (se === 0) return 0;

    const zScore = Math.abs((p2 - p1) / se);

    // Approximate confidence from z-score
    if (zScore > 2.58) return 99;
    if (zScore > 1.96) return 95;
    if (zScore > 1.65) return 90;
    return Math.min(90, zScore * 45);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Track an analytics event
   */
  async trackEvent(userId, eventType, eventCategory, properties = {}, metadata = {}) {
    try {
      const query = `
        INSERT INTO analytics_events
          (user_id, event_type, event_category, event_properties, device_info, location_data, session_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const params = [
        userId,
        eventType,
        eventCategory,
        JSON.stringify(properties),
        JSON.stringify(metadata.deviceInfo || {}),
        JSON.stringify(metadata.locationData || {}),
        metadata.sessionId || null
      ];

      await this.db.query(query, params);

      // Invalidate relevant caches
      this.invalidateCache(['realtime_metrics']);

    } catch (error) {
      // Don't throw on analytics errors - log and continue
      logger.logError(error, {
        service: 'analytics_engine',
        operation: 'track_event',
        userId,
        eventType
      });
    }
  }

  /**
   * Cache helpers
   */
  getFromCache(key) {
    const cached = this.metricsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.metricsCache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTTL
    });
  }

  invalidateCache(keys) {
    keys.forEach(key => this.metricsCache.delete(key));
  }

  /**
   * Helper: Classify engagement level
   */
  classifyEngagement(avgSessionMinutes) {
    if (avgSessionMinutes > 10) return 'High';
    if (avgSessionMinutes > 5) return 'Medium';
    return 'Low';
  }

  /**
   * Helper: Calculate engagement percentage
   */
  calculateEngagementPercentage(dailyUsers) {
    // Assuming 10,000 total active users (adjust based on your metrics)
    const totalUsers = 10000;
    return `${((dailyUsers / totalUsers) * 100).toFixed(0)}%`;
  }

  /**
   * Initialize periodic jobs
   */
  initializePeriodicJobs() {
    // Update revenue metrics daily at midnight
    const updateRevenueMetrics = async () => {
      try {
        await this.updateDailyRevenueMetrics();
      } catch (error) {
        logger.logError(error, {
          service: 'analytics_engine',
          operation: 'update_revenue_metrics_job'
        });
      }
    };

    // Run daily at midnight
    setInterval(updateRevenueMetrics, 24 * 60 * 60 * 1000);

    logger.getLogger().info('Analytics Engine initialized', {
      service: 'analytics_engine',
      version: this.version
    });
  }

  /**
   * Update daily revenue metrics
   */
  async updateDailyRevenueMetrics() {
    const today = new Date().toISOString().split('T')[0];

    const mrrData = await this.calculateMRR();
    const tierBreakdown = await this.getRevenueByTier();

    const query = `
      INSERT INTO revenue_metrics (
        metric_date, mrr, arr, active_subscriptions,
        cosmic_tier_count, stellar_tier_count,
        cosmic_tier_revenue, stellar_tier_revenue
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (metric_date)
      DO UPDATE SET
        mrr = EXCLUDED.mrr,
        arr = EXCLUDED.arr,
        active_subscriptions = EXCLUDED.active_subscriptions,
        cosmic_tier_count = EXCLUDED.cosmic_tier_count,
        stellar_tier_count = EXCLUDED.stellar_tier_count,
        cosmic_tier_revenue = EXCLUDED.cosmic_tier_revenue,
        stellar_tier_revenue = EXCLUDED.stellar_tier_revenue
    `;

    const params = [
      today,
      mrrData.mrr,
      mrrData.mrr * 12,
      mrrData.activeSubscriptions,
      tierBreakdown.cosmic?.subscribers || 0,
      tierBreakdown.stellar?.subscribers || 0,
      tierBreakdown.cosmic?.mrr || 0,
      tierBreakdown.stellar?.mrr || 0
    ];

    await this.db.query(query, params);
  }
}

// Export singleton instance
const analyticsEngine = new AnalyticsEngine();
module.exports = analyticsEngine;
