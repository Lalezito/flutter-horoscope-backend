/**
 * IMAGE ANALYTICS SERVICE
 *
 * Track and analyze image generation engagement
 * Features:
 * - Generation tracking
 * - Social sharing analytics
 * - Download statistics
 * - Cost tracking
 * - User engagement metrics
 * - Viral content detection
 */

const db = require('../config/db');
const redisService = require('./redisService');
const logger = require('./loggingService');
const moment = require('moment-timezone');

class ImageAnalyticsService {
  constructor() {
    this.metrics = {
      GENERATION: 'generation',
      SHARE: 'share',
      DOWNLOAD: 'download',
      VIEW: 'view',
      FAVORITE: 'favorite'
    };

    this.platforms = {
      INSTAGRAM_SQUARE: 'instagram_square',
      INSTAGRAM_STORY: 'instagram_story',
      TWITTER: 'twitter',
      FACEBOOK: 'facebook'
    };
  }

  /**
   * TRACK IMAGE SHARE EVENT
   */
  async trackShare(imageId, userId, platform) {
    try {
      // Record in database
      await db.query(
        `INSERT INTO image_share_events (image_id, user_id, platform)
         VALUES ($1, $2, $3)`,
        [imageId, userId, platform]
      );

      // Update real-time metrics in Redis
      await this.incrementMetric(`shares:${platform}`, 1);
      await this.incrementMetric(`shares:total`, 1);
      await this.incrementMetric(`image:${imageId}:shares`, 1);

      // Check if image is going viral
      await this.checkViralStatus(imageId);

      logger.info(`Share tracked: ${imageId} on ${platform}`);
      return true;

    } catch (error) {
      logger.error('Share tracking failed:', error);
      return false;
    }
  }

  /**
   * TRACK IMAGE DOWNLOAD EVENT
   */
  async trackDownload(imageId, userId, format) {
    try {
      await db.query(
        `INSERT INTO image_download_events (image_id, user_id, format)
         VALUES ($1, $2, $3)`,
        [imageId, userId, format]
      );

      await this.incrementMetric(`downloads:${format}`, 1);
      await this.incrementMetric(`downloads:total`, 1);
      await this.incrementMetric(`image:${imageId}:downloads`, 1);

      logger.info(`Download tracked: ${imageId} (${format})`);
      return true;

    } catch (error) {
      logger.error('Download tracking failed:', error);
      return false;
    }
  }

  /**
   * TRACK IMAGE FAVORITE
   */
  async trackFavorite(imageId, userId) {
    try {
      await db.query(
        `INSERT INTO image_favorites (user_id, image_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, image_id) DO NOTHING`,
        [userId, imageId]
      );

      await this.incrementMetric(`image:${imageId}:favorites`, 1);

      return true;

    } catch (error) {
      logger.error('Favorite tracking failed:', error);
      return false;
    }
  }

  /**
   * REMOVE IMAGE FAVORITE
   */
  async removeFavorite(imageId, userId) {
    try {
      await db.query(
        `DELETE FROM image_favorites
         WHERE user_id = $1 AND image_id = $2`,
        [userId, imageId]
      );

      await this.incrementMetric(`image:${imageId}:favorites`, -1);

      return true;

    } catch (error) {
      logger.error('Remove favorite failed:', error);
      return false;
    }
  }

  /**
   * GET ENGAGEMENT METRICS FOR IMAGE
   */
  async getImageEngagement(imageId) {
    try {
      const result = await db.query(
        `SELECT
          COUNT(DISTINCT ise.id) as share_count,
          COUNT(DISTINCT ide.id) as download_count,
          COUNT(DISTINCT if.id) as favorite_count,
          COUNT(DISTINCT ise.platform) as platforms_count
         FROM generated_images gi
         LEFT JOIN image_share_events ise ON gi.id = ise.image_id
         LEFT JOIN image_download_events ide ON gi.id = ide.image_id
         LEFT JOIN image_favorites if ON gi.id = if.image_id
         WHERE gi.id = $1
         GROUP BY gi.id`,
        [imageId]
      );

      if (result.rows.length > 0) {
        return {
          shares: parseInt(result.rows[0].share_count),
          downloads: parseInt(result.rows[0].download_count),
          favorites: parseInt(result.rows[0].favorite_count),
          platformsReached: parseInt(result.rows[0].platforms_count),
          engagementScore: this.calculateEngagementScore(result.rows[0])
        };
      }

      return {
        shares: 0,
        downloads: 0,
        favorites: 0,
        platformsReached: 0,
        engagementScore: 0
      };

    } catch (error) {
      logger.error('Engagement fetch failed:', error);
      return null;
    }
  }

  /**
   * CALCULATE ENGAGEMENT SCORE
   * Weighted score: shares (3x), downloads (2x), favorites (1x)
   */
  calculateEngagementScore(metrics) {
    const shares = parseInt(metrics.share_count) || 0;
    const downloads = parseInt(metrics.download_count) || 0;
    const favorites = parseInt(metrics.favorite_count) || 0;

    return (shares * 3) + (downloads * 2) + (favorites * 1);
  }

  /**
   * GET TOP PERFORMING IMAGES
   */
  async getTopImages(limit = 10, category = null) {
    try {
      let query = `
        SELECT
          gi.id,
          gi.image_url,
          gi.category,
          gi.metadata,
          COUNT(DISTINCT ise.id) as share_count,
          COUNT(DISTINCT ide.id) as download_count,
          COUNT(DISTINCT if.id) as favorite_count
        FROM generated_images gi
        LEFT JOIN image_share_events ise ON gi.id = ise.image_id
        LEFT JOIN image_download_events ide ON gi.id = ide.image_id
        LEFT JOIN image_favorites if ON gi.id = if.image_id
      `;

      const params = [];
      if (category) {
        query += ` WHERE gi.category = $1`;
        params.push(category);
      }

      query += `
        GROUP BY gi.id, gi.image_url, gi.category, gi.metadata
        ORDER BY (COUNT(DISTINCT ise.id) * 3 + COUNT(DISTINCT ide.id) * 2 + COUNT(DISTINCT if.id)) DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        imageId: row.id,
        imageUrl: row.image_url,
        category: row.category,
        metadata: row.metadata,
        shares: parseInt(row.share_count),
        downloads: parseInt(row.download_count),
        favorites: parseInt(row.favorite_count),
        engagementScore: this.calculateEngagementScore(row)
      }));

    } catch (error) {
      logger.error('Top images fetch failed:', error);
      return [];
    }
  }

  /**
   * GET PLATFORM STATISTICS
   */
  async getPlatformStats(days = 7) {
    try {
      const startDate = moment().subtract(days, 'days').toISOString();

      const result = await db.query(
        `SELECT
          platform,
          COUNT(*) as share_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT image_id) as unique_images
         FROM image_share_events
         WHERE shared_at >= $1
         GROUP BY platform
         ORDER BY share_count DESC`,
        [startDate]
      );

      return result.rows.map(row => ({
        platform: row.platform,
        shares: parseInt(row.share_count),
        uniqueUsers: parseInt(row.unique_users),
        uniqueImages: parseInt(row.unique_images)
      }));

    } catch (error) {
      logger.error('Platform stats fetch failed:', error);
      return [];
    }
  }

  /**
   * GET VIRAL IMAGES
   * Images with >50 shares in last 24 hours
   */
  async getViralImages() {
    try {
      const oneDayAgo = moment().subtract(24, 'hours').toISOString();

      const result = await db.query(
        `SELECT
          gi.id,
          gi.image_url,
          gi.category,
          gi.metadata,
          COUNT(ise.id) as share_count_24h
         FROM generated_images gi
         JOIN image_share_events ise ON gi.id = ise.image_id
         WHERE ise.shared_at >= $1
         GROUP BY gi.id, gi.image_url, gi.category, gi.metadata
         HAVING COUNT(ise.id) >= 50
         ORDER BY share_count_24h DESC`,
        [oneDayAgo]
      );

      return result.rows.map(row => ({
        imageId: row.id,
        imageUrl: row.image_url,
        category: row.category,
        metadata: row.metadata,
        sharesLast24h: parseInt(row.share_count_24h)
      }));

    } catch (error) {
      logger.error('Viral images fetch failed:', error);
      return [];
    }
  }

  /**
   * CHECK IF IMAGE IS GOING VIRAL
   */
  async checkViralStatus(imageId) {
    try {
      const oneDayAgo = moment().subtract(24, 'hours').toISOString();

      const result = await db.query(
        `SELECT COUNT(*) as recent_shares
         FROM image_share_events
         WHERE image_id = $1 AND shared_at >= $2`,
        [imageId, oneDayAgo]
      );

      const recentShares = parseInt(result.rows[0].recent_shares);

      if (recentShares >= 50) {
        // Mark as viral in Redis for real-time detection
        await redisService.set(`viral:${imageId}`, {
          shares: recentShares,
          detectedAt: new Date().toISOString()
        }, 86400); // 24 hour TTL

        logger.info(`🔥 VIRAL ALERT: Image ${imageId} has ${recentShares} shares in 24h`);
      }

      return recentShares >= 50;

    } catch (error) {
      logger.error('Viral check failed:', error);
      return false;
    }
  }

  /**
   * GET USER ENGAGEMENT SUMMARY
   */
  async getUserEngagementSummary(userId) {
    try {
      const result = await db.query(
        `SELECT
          COUNT(DISTINCT gi.id) as total_images_generated,
          COUNT(DISTINCT ise.id) as total_shares,
          COUNT(DISTINCT ide.id) as total_downloads,
          COUNT(DISTINCT if.id) as total_favorites,
          SUM(gi.cost) as total_cost_incurred
         FROM generated_images gi
         LEFT JOIN image_share_events ise ON gi.id = ise.image_id AND ise.user_id = $1
         LEFT JOIN image_download_events ide ON gi.id = ide.image_id AND ide.user_id = $1
         LEFT JOIN image_favorites if ON gi.id = if.image_id AND if.user_id = $1
         WHERE gi.user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          totalImagesGenerated: parseInt(row.total_images_generated) || 0,
          totalShares: parseInt(row.total_shares) || 0,
          totalDownloads: parseInt(row.total_downloads) || 0,
          totalFavorites: parseInt(row.total_favorites) || 0,
          totalCostIncurred: parseFloat(row.total_cost_incurred) || 0,
          avgSharesPerImage: row.total_images_generated > 0
            ? (parseInt(row.total_shares) / parseInt(row.total_images_generated)).toFixed(2)
            : 0
        };
      }

      return null;

    } catch (error) {
      logger.error('User engagement summary failed:', error);
      return null;
    }
  }

  /**
   * GET CATEGORY PERFORMANCE
   */
  async getCategoryPerformance(days = 30) {
    try {
      const startDate = moment().subtract(days, 'days').toISOString();

      const result = await db.query(
        `SELECT
          gi.category,
          COUNT(DISTINCT gi.id) as image_count,
          COUNT(DISTINCT ise.id) as total_shares,
          COUNT(DISTINCT ide.id) as total_downloads,
          AVG(gi.cost) as avg_cost
         FROM generated_images gi
         LEFT JOIN image_share_events ise ON gi.id = ise.image_id
         LEFT JOIN image_download_events ide ON gi.id = ide.image_id
         WHERE gi.created_at >= $1
         GROUP BY gi.category
         ORDER BY total_shares DESC`,
        [startDate]
      );

      return result.rows.map(row => ({
        category: row.category,
        imageCount: parseInt(row.image_count),
        totalShares: parseInt(row.total_shares),
        totalDownloads: parseInt(row.total_downloads),
        avgCost: parseFloat(row.avg_cost),
        sharesPerImage: row.image_count > 0
          ? (parseInt(row.total_shares) / parseInt(row.image_count)).toFixed(2)
          : 0
      }));

    } catch (error) {
      logger.error('Category performance fetch failed:', error);
      return [];
    }
  }

  /**
   * INCREMENT METRIC IN REDIS
   */
  async incrementMetric(metricKey, value = 1) {
    try {
      const cacheKey = `analytics:${metricKey}`;
      const current = await redisService.get(cacheKey) || 0;
      await redisService.set(cacheKey, current + value, 86400); // 24 hour TTL
    } catch (error) {
      logger.error('Metric increment failed:', error);
    }
  }

  /**
   * GET REAL-TIME DASHBOARD STATS
   */
  async getDashboardStats() {
    try {
      // Get today's stats
      const today = moment().startOf('day').toISOString();

      const result = await db.query(
        `SELECT
          COUNT(DISTINCT gi.id) as images_today,
          COUNT(DISTINCT ise.id) as shares_today,
          COUNT(DISTINCT ide.id) as downloads_today,
          SUM(gi.cost) as cost_today
         FROM generated_images gi
         LEFT JOIN image_share_events ise ON gi.id = ise.image_id AND ise.shared_at >= $1
         LEFT JOIN image_download_events ide ON gi.id = ide.image_id AND ide.downloaded_at >= $1
         WHERE gi.created_at >= $1`,
        [today]
      );

      const viralImages = await this.getViralImages();
      const topImages = await this.getTopImages(5);

      return {
        today: {
          imagesGenerated: parseInt(result.rows[0].images_today) || 0,
          shares: parseInt(result.rows[0].shares_today) || 0,
          downloads: parseInt(result.rows[0].downloads_today) || 0,
          cost: parseFloat(result.rows[0].cost_today) || 0
        },
        viral: {
          count: viralImages.length,
          images: viralImages.slice(0, 5)
        },
        topPerforming: topImages
      };

    } catch (error) {
      logger.error('Dashboard stats fetch failed:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new ImageAnalyticsService();
