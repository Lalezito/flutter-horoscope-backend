/**
 * Voice AI Analytics & Cost Optimization Service
 *
 * Tracks voice usage, optimizes costs, and provides insights
 */

const logger = require('./loggingService');
const redisService = require('./redisService');

class VoiceAnalyticsService {
  constructor() {
    this.costMetrics = {
      totalCost: 0,
      totalGenerated: 0,
      totalCached: 0,
      cacheHitRate: 0,
      totalCharacters: 0,
      averageCostPerGeneration: 0
    };

    // Cost thresholds for alerts
    this.costThresholds = {
      daily: 10.00,    // Alert if daily cost > $10
      monthly: 200.00  // Alert if monthly cost > $200
    };
  }

  /**
   * Track voice generation event
   */
  async trackVoiceGeneration(event) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return;

      const {
        userId,
        userTier,
        voice,
        contentType,
        duration,
        characters,
        cost,
        cached
      } = event;

      const timestamp = Date.now();
      const today = new Date().toISOString().split('T')[0];

      // Store individual event
      await redis.xadd(
        'voice_analytics:events',
        '*',
        'timestamp', timestamp,
        'userId', userId || 'anonymous',
        'userTier', userTier,
        'voice', voice,
        'contentType', contentType,
        'duration', duration,
        'characters', characters,
        'cost', cost,
        'cached', cached ? '1' : '0'
      );

      // Update daily metrics
      const dailyKey = `voice_analytics:daily:${today}`;
      await redis.hincrby(dailyKey, 'total_generations', 1);
      await redis.hincrby(dailyKey, 'total_characters', characters);
      await redis.hincrbyfloat(dailyKey, 'total_cost', cost);
      await redis.hincrby(dailyKey, cached ? 'cache_hits' : 'cache_misses', 1);
      await redis.expire(dailyKey, 2592000); // 30 days

      // Update tier metrics
      const tierKey = `voice_analytics:tier:${userTier}:${today}`;
      await redis.hincrby(tierKey, 'generations', 1);
      await redis.hincrbyfloat(tierKey, 'cost', cost);
      await redis.expire(tierKey, 2592000);

      // Update voice personality metrics
      const voiceKey = `voice_analytics:voice:${voice}:${today}`;
      await redis.hincrby(voiceKey, 'uses', 1);
      await redis.expire(voiceKey, 2592000);

      // Update content type metrics
      const contentKey = `voice_analytics:content:${contentType}:${today}`;
      await redis.hincrby(contentKey, 'generations', 1);
      await redis.expire(contentKey, 2592000);

      // Check cost thresholds
      await this.checkCostThresholds(today);

    } catch (error) {
      logger.logError(error, { method: 'trackVoiceGeneration' });
    }
  }

  /**
   * Get daily analytics
   */
  async getDailyAnalytics(date) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const dateStr = date || new Date().toISOString().split('T')[0];
      const key = `voice_analytics:daily:${dateStr}`;

      const metrics = await redis.hgetall(key);
      if (!metrics || Object.keys(metrics).length === 0) {
        return null;
      }

      const totalGenerations = parseInt(metrics.total_generations || 0);
      const cacheHits = parseInt(metrics.cache_hits || 0);
      const cacheMisses = parseInt(metrics.cache_misses || 0);

      return {
        date: dateStr,
        totalGenerations,
        totalCharacters: parseInt(metrics.total_characters || 0),
        totalCost: parseFloat(metrics.total_cost || 0),
        cacheHits,
        cacheMisses,
        cacheHitRate: totalGenerations > 0
          ? (cacheHits / totalGenerations * 100).toFixed(2) + '%'
          : '0%',
        averageCostPerGeneration: totalGenerations > 0
          ? (parseFloat(metrics.total_cost || 0) / totalGenerations).toFixed(4)
          : 0
      };

    } catch (error) {
      logger.logError(error, { method: 'getDailyAnalytics', date });
      return null;
    }
  }

  /**
   * Get monthly analytics
   */
  async getMonthlyAnalytics(year, month) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const currentYear = year || new Date().getFullYear();
      const currentMonth = month || (new Date().getMonth() + 1);

      // Get all days in month
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const dailyMetrics = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${currentYear}-${String(currentMonth).padLeft(2, '0')}-${String(day).padLeft(2, '0')}`;
        const dayMetrics = await this.getDailyAnalytics(date);
        if (dayMetrics) {
          dailyMetrics.push(dayMetrics);
        }
      }

      // Aggregate monthly totals
      const monthly = dailyMetrics.reduce((acc, day) => {
        acc.totalGenerations += day.totalGenerations;
        acc.totalCharacters += day.totalCharacters;
        acc.totalCost += day.totalCost;
        acc.cacheHits += day.cacheHits;
        acc.cacheMisses += day.cacheMisses;
        return acc;
      }, {
        totalGenerations: 0,
        totalCharacters: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0
      });

      monthly.cacheHitRate = monthly.totalGenerations > 0
        ? (monthly.cacheHits / monthly.totalGenerations * 100).toFixed(2) + '%'
        : '0%';

      monthly.averageCostPerGeneration = monthly.totalGenerations > 0
        ? (monthly.totalCost / monthly.totalGenerations).toFixed(4)
        : 0;

      monthly.dailyBreakdown = dailyMetrics;

      return monthly;

    } catch (error) {
      logger.logError(error, { method: 'getMonthlyAnalytics', year, month });
      return null;
    }
  }

  /**
   * Get tier usage breakdown
   */
  async getTierBreakdown(date) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const dateStr = date || new Date().toISOString().split('T')[0];
      const tiers = ['free', 'cosmic', 'universe'];
      const breakdown = {};

      for (const tier of tiers) {
        const key = `voice_analytics:tier:${tier}:${dateStr}`;
        const metrics = await redis.hgetall(key);

        breakdown[tier] = {
          generations: parseInt(metrics.generations || 0),
          cost: parseFloat(metrics.cost || 0)
        };
      }

      return breakdown;

    } catch (error) {
      logger.logError(error, { method: 'getTierBreakdown', date });
      return null;
    }
  }

  /**
   * Get voice personality usage
   */
  async getVoiceUsage(date) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const dateStr = date || new Date().toISOString().split('T')[0];
      const voices = [
        'cosmic_guide',
        'energetic_coach',
        'gentle_healer',
        'wise_elder',
        'mystical_oracle',
        'divine_messenger'
      ];

      const usage = {};

      for (const voice of voices) {
        const key = `voice_analytics:voice:${voice}:${dateStr}`;
        const metrics = await redis.hgetall(key);
        usage[voice] = parseInt(metrics.uses || 0);
      }

      return usage;

    } catch (error) {
      logger.logError(error, { method: 'getVoiceUsage', date });
      return null;
    }
  }

  /**
   * Get content type usage
   */
  async getContentTypeUsage(date) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const dateStr = date || new Date().toISOString().split('T')[0];
      const contentTypes = ['personalized', 'horoscope', 'meditation', 'affirmation'];
      const usage = {};

      for (const type of contentTypes) {
        const key = `voice_analytics:content:${type}:${dateStr}`;
        const metrics = await redis.hgetall(key);
        usage[type] = parseInt(metrics.generations || 0);
      }

      return usage;

    } catch (error) {
      logger.logError(error, { method: 'getContentTypeUsage', date });
      return null;
    }
  }

  /**
   * Check cost thresholds and alert if exceeded
   */
  async checkCostThresholds(date) {
    try {
      const daily = await this.getDailyAnalytics(date);
      if (!daily) return;

      // Check daily threshold
      if (daily.totalCost >= this.costThresholds.daily) {
        logger.getLogger().warn('Voice AI daily cost threshold exceeded', {
          date,
          cost: daily.totalCost,
          threshold: this.costThresholds.daily
        });
        // TODO: Send alert to admin
      }

      // Check monthly threshold
      const [year, month] = date.split('-');
      const monthly = await this.getMonthlyAnalytics(parseInt(year), parseInt(month));

      if (monthly && monthly.totalCost >= this.costThresholds.monthly) {
        logger.getLogger().warn('Voice AI monthly cost threshold exceeded', {
          year,
          month,
          cost: monthly.totalCost,
          threshold: this.costThresholds.monthly
        });
        // TODO: Send alert to admin
      }

    } catch (error) {
      logger.logError(error, { method: 'checkCostThresholds', date });
    }
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimizationRecommendations() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const daily = await this.getDailyAnalytics(today);

      if (!daily) {
        return {
          recommendations: [],
          cacheEfficiency: 'unknown'
        };
      }

      const recommendations = [];
      const cacheHitRate = parseFloat(daily.cacheHitRate);

      // Cache optimization
      if (cacheHitRate < 50) {
        recommendations.push({
          priority: 'high',
          category: 'caching',
          title: 'Improve Cache Hit Rate',
          description: `Current cache hit rate is ${daily.cacheHitRate}. Consider increasing cache TTL for popular content.`,
          potentialSavings: `${(daily.totalCost * 0.3).toFixed(2)}/day`
        });
      }

      // Model optimization
      const voiceUsage = await this.getVoiceUsage(today);
      const contentUsage = await this.getContentTypeUsage(today);

      if (contentUsage.meditation > contentUsage.personalized * 0.5) {
        recommendations.push({
          priority: 'medium',
          category: 'model',
          title: 'Use Standard Model for Meditations',
          description: 'Switch meditation content from tts-1-hd to tts-1 to reduce costs by 50%.',
          potentialSavings: `${(daily.totalCost * 0.2).toFixed(2)}/day`
        });
      }

      // Tier optimization
      const tierBreakdown = await this.getTierBreakdown(today);
      if (tierBreakdown.free && tierBreakdown.free.generations > 0) {
        recommendations.push({
          priority: 'low',
          category: 'tier',
          title: 'Review Free Tier Access',
          description: 'Free tier is generating voice responses. Ensure this is intentional.',
          note: 'Free tier should have 0 voice responses according to plan.'
        });
      }

      return {
        recommendations,
        cacheEfficiency: cacheHitRate >= 70 ? 'excellent' : cacheHitRate >= 50 ? 'good' : 'needs_improvement',
        currentMetrics: daily
      };

    } catch (error) {
      logger.logError(error, { method: 'getCostOptimizationRecommendations' });
      return {
        recommendations: [],
        cacheEfficiency: 'error'
      };
    }
  }

  /**
   * Get revenue vs cost analysis
   */
  async getRevenueAnalysis(date, revenue) {
    try {
      const daily = await this.getDailyAnalytics(date);
      if (!daily) return null;

      const roi = revenue > 0
        ? ((revenue - daily.totalCost) / daily.totalCost * 100).toFixed(2)
        : 0;

      return {
        date,
        revenue,
        cost: daily.totalCost,
        profit: revenue - daily.totalCost,
        roi: roi + '%',
        costPercentage: revenue > 0
          ? (daily.totalCost / revenue * 100).toFixed(2) + '%'
          : '100%'
      };

    } catch (error) {
      logger.logError(error, { method: 'getRevenueAnalysis', date });
      return null;
    }
  }

  /**
   * Export analytics to CSV (for reporting)
   */
  async exportAnalytics(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const data = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().split('T')[0];
        const daily = await this.getDailyAnalytics(date);

        if (daily) {
          data.push(daily);
        }
      }

      return data;

    } catch (error) {
      logger.logError(error, { method: 'exportAnalytics', startDate, endDate });
      return [];
    }
  }
}

module.exports = new VoiceAnalyticsService();
