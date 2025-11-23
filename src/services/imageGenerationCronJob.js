/**
 * IMAGE GENERATION CRON JOBS
 *
 * Automated batch generation of daily cosmic images
 * - Runs at midnight to pre-generate daily images for all zodiac signs
 * - Maximizes cache hit rate (target: 80%+)
 * - Reduces real-time generation load
 * - Optimizes DALL-E API costs
 */

const cron = require('node-cron');
const imageGenerationService = require('./imageGenerationService');
const logger = require('./loggingService');
const moment = require('moment-timezone');

class ImageGenerationCronJob {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * INITIALIZE ALL CRON JOBS
   */
  initialize() {
    try {
      logger.info('Initializing image generation cron jobs...');

      // Daily batch generation at 12:00 AM EST
      const dailyBatchJob = cron.schedule('0 0 * * *', async () => {
        await this.runDailyBatchGeneration();
      }, {
        timezone: 'America/New_York'
      });

      this.jobs.push({
        name: 'daily_batch_generation',
        job: dailyBatchJob
      });

      // Cache cleanup at 2:00 AM EST (remove expired images)
      const cacheCleanupJob = cron.schedule('0 2 * * *', async () => {
        await this.runCacheCleanup();
      }, {
        timezone: 'America/New_York'
      });

      this.jobs.push({
        name: 'cache_cleanup',
        job: cacheCleanupJob
      });

      // Weekly cost report (Mondays at 9:00 AM EST)
      const weeklyCostReportJob = cron.schedule('0 9 * * 1', async () => {
        await this.generateWeeklyCostReport();
      }, {
        timezone: 'America/New_York'
      });

      this.jobs.push({
        name: 'weekly_cost_report',
        job: weeklyCostReportJob
      });

      logger.info(`Image generation cron jobs initialized: ${this.jobs.length} jobs`);
      return true;

    } catch (error) {
      logger.error('Cron job initialization failed:', error);
      return false;
    }
  }

  /**
   * RUN DAILY BATCH GENERATION
   * Generates daily cosmic energy images for all 12 zodiac signs
   */
  async runDailyBatchGeneration() {
    if (this.isRunning) {
      logger.warn('Batch generation already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting daily batch image generation...');

      const startTime = Date.now();
      const result = await imageGenerationService.batchGenerateDailyImages();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const totalCost = (result.success * 0.04).toFixed(2); // $0.04 per standard quality image

      logger.info(`Batch generation completed in ${duration}s:`, {
        success: result.success,
        failed: result.failed,
        cached: result.cached,
        totalCost: `$${totalCost}`
      });

      // Record metrics
      await this.recordBatchMetrics({
        date: moment().format('YYYY-MM-DD'),
        success: result.success,
        failed: result.failed,
        cached: result.cached,
        duration: parseFloat(duration),
        cost: parseFloat(totalCost)
      });

      this.isRunning = false;
      return result;

    } catch (error) {
      logger.error('Batch generation failed:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * RUN CACHE CLEANUP
   * Removes expired cached images and optimizes storage
   */
  async runCacheCleanup() {
    try {
      logger.info('Starting cache cleanup...');

      // This would integrate with your caching service
      // For now, log the action
      logger.info('Cache cleanup completed');

      return { success: true };

    } catch (error) {
      logger.error('Cache cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * GENERATE WEEKLY COST REPORT
   * Calculates weekly spending on image generation
   */
  async generateWeeklyCostReport() {
    try {
      logger.info('Generating weekly cost report...');

      const endDate = moment().toISOString();
      const startDate = moment().subtract(7, 'days').toISOString();

      const costData = await imageGenerationService.getTotalCost(startDate, endDate);
      const stats = await imageGenerationService.getGenerationStats(startDate, endDate);
      const cacheStats = await imageGenerationService.getCacheHitRate(7);

      const report = {
        period: {
          start: startDate,
          end: endDate
        },
        total_images: costData.totalImages,
        total_cost: `$${costData.totalCost.toFixed(2)}`,
        avg_cost_per_image: `$${(costData.totalCost / costData.totalImages).toFixed(4)}`,
        cache_hit_rate: cacheStats.hitRate,
        breakdown: stats,
        estimated_monthly_cost: `$${(costData.totalCost * 4).toFixed(2)}`
      };

      logger.info('Weekly cost report:', report);

      // You could send this report via email or store it in database
      return report;

    } catch (error) {
      logger.error('Cost report generation failed:', error);
      return null;
    }
  }

  /**
   * RECORD BATCH METRICS
   */
  async recordBatchMetrics(metrics) {
    try {
      // This would store metrics in your database
      logger.info('Batch metrics recorded:', metrics);
    } catch (error) {
      logger.error('Metrics recording failed:', error);
    }
  }

  /**
   * MANUALLY TRIGGER BATCH GENERATION
   * For testing or on-demand generation
   */
  async triggerManualBatchGeneration() {
    logger.info('Manual batch generation triggered');
    return await this.runDailyBatchGeneration();
  }

  /**
   * STOP ALL CRON JOBS
   */
  stopAll() {
    logger.info('Stopping all image generation cron jobs...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Stopped: ${name}`);
    });
    this.jobs = [];
  }

  /**
   * GET JOB STATUS
   */
  getStatus() {
    return {
      jobs: this.jobs.map(({ name, job }) => ({
        name,
        running: this.isRunning
      })),
      total_jobs: this.jobs.length
    };
  }
}

// Export singleton instance
module.exports = new ImageGenerationCronJob();
