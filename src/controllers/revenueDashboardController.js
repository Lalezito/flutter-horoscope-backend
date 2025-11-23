/**
 * REVENUE DASHBOARD CONTROLLER
 *
 * Admin dashboard for monitoring and controlling revenue optimization
 */

const revenueEngine = require('../services/revenueOptimizationEngine');
const db = require('../config/db');
const logger = require('../services/loggingService');

class RevenueDashboardController {
  /**
   * Get comprehensive revenue metrics
   */
  async getMetrics(req, res) {
    try {
      const timeframe = req.query.timeframe || '30days';

      // Get overview metrics
      const overviewQuery = `
        WITH current_period AS (
          SELECT
            COUNT(DISTINCT user_id) as total_users,
            COUNT(DISTINCT CASE WHEN subscription_tier != 'free' THEN user_id END) as premium_users,
            COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN user_id END) as new_users_7d,
            COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN user_id END) as new_users_30d
          FROM users
        ),
        revenue_stats AS (
          SELECT
            SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN amount_paid ELSE 0 END) as revenue_7d,
            SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN amount_paid ELSE 0 END) as revenue_30d,
            SUM(amount_paid) as total_revenue,
            AVG(amount_paid) as avg_transaction
          FROM subscriptions
          WHERE status = 'active'
        ),
        conversion_stats AS (
          SELECT
            COUNT(DISTINCT user_id) FILTER (WHERE subscription_tier != 'free')::float /
            NULLIF(COUNT(DISTINCT user_id), 0) as overall_conversion_rate,
            COUNT(DISTINCT user_id) FILTER (
              WHERE subscription_tier != 'free' AND created_at > NOW() - INTERVAL '30 days'
            )::float /
            NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) as conversion_rate_30d
          FROM users
        ),
        churn_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at > NOW() - INTERVAL '30 days')::float /
            NULLIF(COUNT(*) FILTER (WHERE status = 'active'), 0) as churn_rate
          FROM subscriptions
        )
        SELECT
          cp.*,
          rs.*,
          ROUND((cs.overall_conversion_rate * 100)::numeric, 2) as conversion_rate,
          ROUND((cs.conversion_rate_30d * 100)::numeric, 2) as conversion_rate_30d,
          ROUND((COALESCE(ch.churn_rate, 0) * 100)::numeric, 2) as churn_rate
        FROM current_period cp
        CROSS JOIN revenue_stats rs
        CROSS JOIN conversion_stats cs
        CROSS JOIN churn_stats ch
      `;

      const overviewResult = await db.query(overviewQuery);
      const overview = overviewResult.rows[0];

      // Get tier distribution
      const tierQuery = `
        SELECT
          subscription_tier as tier,
          COUNT(*) as count,
          ROUND((COUNT(*)::float / (SELECT COUNT(*) FROM users) * 100)::numeric, 2) as percentage
        FROM users
        GROUP BY subscription_tier
        ORDER BY count DESC
      `;
      const tierResult = await db.query(tierQuery);

      // Get revenue trend (last 30 days)
      const trendQuery = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as subscriptions,
          SUM(amount_paid) as revenue
        FROM subscriptions
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      const trendResult = await db.query(trendQuery);

      // Get top churn risks
      const churnQuery = `
        SELECT
          user_id,
          churn_probability,
          intervention_type,
          created_at
        FROM churn_interventions
        WHERE created_at > NOW() - INTERVAL '7 days'
        ORDER BY churn_probability DESC
        LIMIT 10
      `;
      const churnResult = await db.query(churnQuery);

      // Get active experiments
      const experimentsQuery = `
        SELECT
          id,
          tier,
          price_points,
          start_date,
          end_date,
          status
        FROM pricing_experiments
        WHERE status = 'active'
        ORDER BY created_at DESC
      `;
      const experimentsResult = await db.query(experimentsQuery);

      res.json({
        success: true,
        metrics: {
          overview: {
            totalUsers: parseInt(overview.total_users),
            premiumUsers: parseInt(overview.premium_users),
            freeUsers: parseInt(overview.total_users) - parseInt(overview.premium_users),
            newUsers7d: parseInt(overview.new_users_7d),
            newUsers30d: parseInt(overview.new_users_30d),
            revenue7d: parseFloat(overview.revenue_7d || 0),
            revenue30d: parseFloat(overview.revenue_30d || 0),
            totalRevenue: parseFloat(overview.total_revenue || 0),
            avgTransaction: parseFloat(overview.avg_transaction || 0),
            conversionRate: parseFloat(overview.conversion_rate || 0),
            conversionRate30d: parseFloat(overview.conversion_rate_30d || 0),
            churnRate: parseFloat(overview.churn_rate || 0)
          },
          tierDistribution: tierResult.rows.map(row => ({
            tier: row.tier,
            count: parseInt(row.count),
            percentage: parseFloat(row.percentage)
          })),
          revenueTrend: trendResult.rows.map(row => ({
            date: row.date,
            subscriptions: parseInt(row.subscriptions),
            revenue: parseFloat(row.revenue)
          })),
          topChurnRisks: churnResult.rows.map(row => ({
            userId: row.user_id,
            churnProbability: parseFloat(row.churn_probability),
            interventionType: row.intervention_type,
            timestamp: row.created_at
          })),
          activeExperiments: experimentsResult.rows.map(row => ({
            id: row.id,
            tier: row.tier,
            pricePoints: JSON.parse(row.price_points),
            startDate: row.start_date,
            endDate: row.end_date,
            status: row.status
          }))
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.getMetrics' });
      res.status(500).json({
        error: 'Failed to fetch metrics',
        message: error.message
      });
    }
  }

  /**
   * Get LTV analytics
   */
  async getLTVAnalytics(req, res) {
    try {
      const query = `
        WITH user_ltv AS (
          SELECT
            u.user_id,
            u.subscription_tier,
            u.created_at as signup_date,
            EXTRACT(DAY FROM (NOW() - u.created_at)) as account_age_days,
            COALESCE(SUM(s.amount_paid), 0) as lifetime_value,
            COUNT(s.id) as subscription_count
          FROM users u
          LEFT JOIN subscriptions s ON u.user_id = s.user_id
          GROUP BY u.user_id, u.subscription_tier, u.created_at
        )
        SELECT
          subscription_tier as tier,
          COUNT(*) as user_count,
          ROUND(AVG(lifetime_value)::numeric, 2) as avg_ltv,
          ROUND(MAX(lifetime_value)::numeric, 2) as max_ltv,
          ROUND(AVG(subscription_count)::numeric, 2) as avg_subscriptions,
          ROUND(AVG(CASE WHEN account_age_days > 0 THEN lifetime_value / account_age_days * 365 ELSE 0 END)::numeric, 2) as projected_annual_ltv
        FROM user_ltv
        GROUP BY subscription_tier
        ORDER BY avg_ltv DESC
      `;

      const result = await db.query(query);

      res.json({
        success: true,
        ltvAnalytics: result.rows.map(row => ({
          tier: row.tier,
          userCount: parseInt(row.user_count),
          avgLTV: parseFloat(row.avg_ltv),
          maxLTV: parseFloat(row.max_ltv),
          avgSubscriptions: parseFloat(row.avg_subscriptions),
          projectedAnnualLTV: parseFloat(row.projected_annual_ltv)
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.getLTVAnalytics' });
      res.status(500).json({
        error: 'Failed to fetch LTV analytics',
        message: error.message
      });
    }
  }

  /**
   * Get offer performance metrics
   */
  async getOfferPerformance(req, res) {
    try {
      const query = `
        SELECT
          offer_type,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE accepted = true) as accepted,
          ROUND((COUNT(*) FILTER (WHERE accepted = true)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as acceptance_rate,
          AVG(discount) as avg_discount,
          MIN(created_at) as first_sent,
          MAX(created_at) as last_sent
        FROM offers_sent
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY offer_type
        ORDER BY total_sent DESC
      `;

      const result = await db.query(query);

      res.json({
        success: true,
        offerPerformance: result.rows.map(row => ({
          offerType: row.offer_type,
          totalSent: parseInt(row.total_sent),
          accepted: parseInt(row.accepted),
          acceptanceRate: parseFloat(row.acceptance_rate || 0),
          avgDiscount: parseFloat(row.avg_discount || 0),
          firstSent: row.first_sent,
          lastSent: row.last_sent
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.getOfferPerformance' });
      res.status(500).json({
        error: 'Failed to fetch offer performance',
        message: error.message
      });
    }
  }

  /**
   * Get cohort analysis
   */
  async getCohortAnalysis(req, res) {
    try {
      const query = `
        WITH cohorts AS (
          SELECT
            DATE_TRUNC('month', created_at) as cohort_month,
            user_id,
            subscription_tier
          FROM users
          WHERE created_at > NOW() - INTERVAL '12 months'
        ),
        cohort_stats AS (
          SELECT
            c.cohort_month,
            COUNT(DISTINCT c.user_id) as cohort_size,
            COUNT(DISTINCT CASE WHEN s.user_id IS NOT NULL THEN c.user_id END) as converted,
            SUM(COALESCE(s.amount_paid, 0)) as cohort_revenue
          FROM cohorts c
          LEFT JOIN subscriptions s ON c.user_id = s.user_id
            AND s.created_at >= c.cohort_month
            AND s.created_at < c.cohort_month + INTERVAL '1 month'
          GROUP BY c.cohort_month
        )
        SELECT
          cohort_month,
          cohort_size,
          converted,
          ROUND((converted::float / NULLIF(cohort_size, 0) * 100)::numeric, 2) as conversion_rate,
          ROUND(cohort_revenue::numeric, 2) as revenue,
          ROUND((cohort_revenue / NULLIF(cohort_size, 0))::numeric, 2) as revenue_per_user
        FROM cohort_stats
        ORDER BY cohort_month DESC
      `;

      const result = await db.query(query);

      res.json({
        success: true,
        cohortAnalysis: result.rows.map(row => ({
          cohortMonth: row.cohort_month,
          cohortSize: parseInt(row.cohort_size),
          converted: parseInt(row.converted),
          conversionRate: parseFloat(row.conversion_rate || 0),
          revenue: parseFloat(row.revenue || 0),
          revenuePerUser: parseFloat(row.revenue_per_user || 0)
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.getCohortAnalysis' });
      res.status(500).json({
        error: 'Failed to fetch cohort analysis',
        message: error.message
      });
    }
  }

  /**
   * Get real-time revenue stats
   */
  async getRealtimeStats(req, res) {
    try {
      const query = `
        WITH today_stats AS (
          SELECT
            COUNT(DISTINCT CASE WHEN created_at::date = CURRENT_DATE THEN user_id END) as new_users_today,
            COUNT(DISTINCT CASE WHEN subscription_tier != 'free' AND created_at::date = CURRENT_DATE THEN user_id END) as conversions_today,
            SUM(CASE WHEN created_at::date = CURRENT_DATE THEN amount_paid ELSE 0 END) as revenue_today
          FROM users u
          LEFT JOIN subscriptions s ON u.user_id = s.user_id
        ),
        last_hour AS (
          SELECT
            COUNT(*) as events_last_hour
          FROM user_events
          WHERE created_at > NOW() - INTERVAL '1 hour'
        ),
        active_now AS (
          SELECT COUNT(DISTINCT user_id) as active_users
          FROM user_analytics
          WHERE created_at > NOW() - INTERVAL '15 minutes'
        )
        SELECT
          ts.*,
          lh.events_last_hour,
          an.active_users
        FROM today_stats ts
        CROSS JOIN last_hour lh
        CROSS JOIN active_now an
      `;

      const result = await db.query(query);
      const stats = result.rows[0];

      res.json({
        success: true,
        realtimeStats: {
          newUsersToday: parseInt(stats.new_users_today || 0),
          conversionsToday: parseInt(stats.conversions_today || 0),
          revenueToday: parseFloat(stats.revenue_today || 0),
          eventsLastHour: parseInt(stats.events_last_hour || 0),
          activeUsersNow: parseInt(stats.active_users || 0)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.getRealtimeStats' });
      res.status(500).json({
        error: 'Failed to fetch realtime stats',
        message: error.message
      });
    }
  }

  /**
   * Trigger bulk churn prevention (admin action)
   */
  async triggerBulkChurnPrevention(req, res) {
    try {
      const { riskLevel } = req.body;

      if (!riskLevel || !['high', 'medium', 'low'].includes(riskLevel)) {
        return res.status(400).json({
          error: 'Invalid risk level',
          validLevels: ['high', 'medium', 'low']
        });
      }

      // Get users at risk
      const usersQuery = `
        SELECT DISTINCT user_id
        FROM churn_interventions
        WHERE created_at > NOW() - INTERVAL '7 days'
        ORDER BY churn_probability DESC
        LIMIT 100
      `;

      const usersResult = await db.query(usersQuery);
      const users = usersResult.rows;

      // Process interventions
      const results = [];
      for (const user of users) {
        try {
          const churnPrediction = await revenueEngine.predictChurnProbability(user.user_id);

          if (churnPrediction.riskLevel === riskLevel || riskLevel === 'low') {
            const intervention = await revenueEngine.preventChurn(user.user_id, churnPrediction);
            results.push({
              userId: user.user_id,
              success: true,
              intervention: intervention.action
            });
          }
        } catch (error) {
          results.push({
            userId: user.user_id,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        processed: results.length,
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.triggerBulkChurnPrevention' });
      res.status(500).json({
        error: 'Failed to trigger bulk churn prevention',
        message: error.message
      });
    }
  }

  /**
   * Export revenue data (CSV)
   */
  async exportData(req, res) {
    try {
      const { type, startDate, endDate } = req.query;

      let query = '';
      let filename = 'revenue_export.csv';

      switch (type) {
        case 'subscriptions':
          query = `
            SELECT
              s.user_id,
              s.tier,
              s.amount_paid,
              s.status,
              s.created_at,
              s.expires_at,
              u.country
            FROM subscriptions s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.created_at BETWEEN $1 AND $2
            ORDER BY s.created_at DESC
          `;
          filename = 'subscriptions_export.csv';
          break;

        case 'users':
          query = `
            SELECT
              user_id,
              subscription_tier,
              country,
              created_at,
              last_active
            FROM users
            WHERE created_at BETWEEN $1 AND $2
            ORDER BY created_at DESC
          `;
          filename = 'users_export.csv';
          break;

        case 'offers':
          query = `
            SELECT
              user_id,
              offer_type,
              discount,
              tier,
              accepted,
              created_at
            FROM offers_sent
            WHERE created_at BETWEEN $1 AND $2
            ORDER BY created_at DESC
          `;
          filename = 'offers_export.csv';
          break;

        default:
          return res.status(400).json({
            error: 'Invalid export type',
            validTypes: ['subscriptions', 'users', 'offers']
          });
      }

      const result = await db.query(query, [
        startDate || '2020-01-01',
        endDate || new Date().toISOString()
      ]);

      // Convert to CSV
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'No data found for the specified date range'
        });
      }

      const headers = Object.keys(result.rows[0]);
      let csv = headers.join(',') + '\n';

      result.rows.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csv += values.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);

    } catch (error) {
      logger.logError(error, { endpoint: 'revenueDashboard.exportData' });
      res.status(500).json({
        error: 'Failed to export data',
        message: error.message
      });
    }
  }
}

module.exports = new RevenueDashboardController();
