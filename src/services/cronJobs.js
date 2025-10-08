const cron = require('node-cron');
const horoscopeGenerator = require('./horoscopeGenerator');
const monitoringController = require('../controllers/monitoringController');

class CronJobsService {
  constructor() {
    this.jobs = new Map();
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Initialize all cron jobs
   */
  init() {
    console.log('🕐 Initializing cron jobs...');
    
    // Daily horoscope generation - Every day at 6:00 AM
    this.scheduleDailyGeneration();
    
    // Weekly horoscope generation - Every Monday at 5:30 AM (30 min before daily)
    this.scheduleWeeklyGeneration();
    
    // System health check - Every 10 minutes
    this.scheduleHealthChecks();
    
    // Cleanup old data - Every day at 2:00 AM
    this.scheduleCleanup();
    
    // Analytics cleanup - Every Sunday at 3:00 AM
    this.scheduleAnalyticsCleanup();

    console.log(`✅ Cron jobs initialized for ${this.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} environment`);
    this.logScheduledJobs();
  }

  /**
   * Schedule daily horoscope generation
   * Runs every day at 00:00 (midnight)
   */
  scheduleDailyGeneration() {
    const job = cron.schedule('0 0 * * *', async () => {
      console.log('🌟 Starting scheduled daily horoscope generation...');
      
      try {
        const startTime = Date.now();
        const results = await horoscopeGenerator.generateDailyHoroscopes();
        const duration = Date.now() - startTime;
        
        const message = `Daily horoscopes generated: ${results.success} success, ${results.errors} errors in ${Math.round(duration/1000)}s`;
        console.log(`✅ ${message}`);
        
        // Send alert if there were errors
        if (results.errors > 0) {
          await monitoringController.sendAlert(
            `Daily horoscope generation completed with ${results.errors} errors`,
            'warning',
            { results, duration }
          );
        } else {
          await monitoringController.sendAlert(
            message,
            'info',
            { results, duration }
          );
        }

        // Log to monitoring system
        await monitoringController.logHealthCheck({
          status: results.errors === 0 ? 'ok' : 'warning',
          type: 'daily_generation',
          results,
          duration
        });

      } catch (error) {
        console.error('❌ Daily generation failed:', error);
        await monitoringController.sendAlert(
          'Daily horoscope generation FAILED',
          'error',
          { error: error.message, stack: error.stack }
        );
        
        await monitoringController.logError(
          'daily_generation_failure',
          error.message,
          error.stack,
          { scheduled: true }
        );
      }
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'America/New_York'
    });

    this.jobs.set('dailyGeneration', job);
    
    // Start job only in production or if explicitly enabled
    if (this.isProduction || process.env.ENABLE_CRON_JOBS === 'true') {
      job.start();
      console.log('📅 Daily generation cron job started (00:00 midnight daily)');
    } else {
      console.log('📅 Daily generation cron job created but not started (development mode)');
    }
  }

  /**
   * Schedule weekly horoscope generation
   * Runs every Monday at 23:30 (30 minutes before daily midnight generation)
   */
  scheduleWeeklyGeneration() {
    const job = cron.schedule('30 23 * * 0', async () => {
      console.log('📅 Starting scheduled weekly horoscope generation...');
      
      try {
        const startTime = Date.now();
        const results = await horoscopeGenerator.generateWeeklyHoroscopes();
        const duration = Date.now() - startTime;
        
        const message = `Weekly horoscopes generated: ${results.success} success, ${results.errors} errors in ${Math.round(duration/1000)}s`;
        console.log(`✅ ${message}`);
        
        // Send alert
        if (results.errors > 0) {
          await monitoringController.sendAlert(
            `Weekly horoscope generation completed with ${results.errors} errors`,
            'warning',
            { results, duration }
          );
        } else {
          await monitoringController.sendAlert(
            message,
            'info',
            { results, duration }
          );
        }

        // Log to monitoring
        await monitoringController.logHealthCheck({
          status: results.errors === 0 ? 'ok' : 'warning',
          type: 'weekly_generation',
          results,
          duration
        });

      } catch (error) {
        console.error('❌ Weekly generation failed:', error);
        await monitoringController.sendAlert(
          'Weekly horoscope generation FAILED',
          'error',
          { error: error.message, stack: error.stack }
        );
        
        await monitoringController.logError(
          'weekly_generation_failure',
          error.message,
          error.stack,
          { scheduled: true }
        );
      }
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'America/New_York'
    });

    this.jobs.set('weeklyGeneration', job);
    
    if (this.isProduction || process.env.ENABLE_CRON_JOBS === 'true') {
      job.start();
      console.log('📅 Weekly generation cron job started (5:30 AM Mondays)');
    } else {
      console.log('📅 Weekly generation cron job created but not started (development mode)');
    }
  }

  /**
   * Schedule health checks
   * Runs every 10 minutes to check system health
   */
  scheduleHealthChecks() {
    const job = cron.schedule('*/10 * * * *', async () => {
      try {
        await monitoringController.performAutomatedChecks();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('healthChecks', job);
    
    if (this.isProduction || process.env.ENABLE_MONITORING === 'true') {
      job.start();
      console.log('❤️ Health check cron job started (every 10 minutes)');
    }
  }

  /**
   * Schedule cleanup of old horoscope data
   * Runs daily at 2:00 AM
   */
  scheduleCleanup() {
    const job = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Starting scheduled cleanup...');
      
      try {
        // Clean old horoscope data
        await horoscopeGenerator.cleanOldDailyHoroscopes();
        await horoscopeGenerator.cleanOldWeeklyHoroscopes();
        
        console.log('✅ Scheduled cleanup completed');
      } catch (error) {
        console.error('❌ Cleanup failed:', error);
        await monitoringController.logError(
          'scheduled_cleanup_failure',
          error.message,
          error.stack
        );
      }
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'America/New_York'
    });

    this.jobs.set('cleanup', job);
    
    if (this.isProduction || process.env.ENABLE_CRON_JOBS === 'true') {
      job.start();
      console.log('🧹 Cleanup cron job started (2:00 AM daily)');
    }
  }

  /**
   * Schedule analytics cleanup
   * Runs every Sunday at 3:00 AM
   */
  scheduleAnalyticsCleanup() {
    const job = cron.schedule('0 3 * * 0', async () => {
      console.log('📊 Starting scheduled analytics cleanup...');
      
      try {
        await monitoringController.cleanupAnalytics();
        console.log('✅ Analytics cleanup completed');
      } catch (error) {
        console.error('❌ Analytics cleanup failed:', error);
        await monitoringController.logError(
          'analytics_cleanup_failure',
          error.message,
          error.stack
        );
      }
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'America/New_York'
    });

    this.jobs.set('analyticsCleanup', job);
    
    if (this.isProduction || process.env.ENABLE_CRON_JOBS === 'true') {
      job.start();
      console.log('📊 Analytics cleanup cron job started (3:00 AM Sundays)');
    }
  }

  /**
   * Manual trigger for daily generation (admin endpoint)
   */
  async triggerDailyGeneration() {
    console.log('🎯 Manually triggering daily horoscope generation...');
    return await horoscopeGenerator.generateDailyHoroscopes();
  }

  /**
   * Manual trigger for weekly generation (admin endpoint)
   */
  async triggerWeeklyGeneration() {
    console.log('🎯 Manually triggering weekly horoscope generation...');
    return await horoscopeGenerator.generateWeeklyHoroscopes();
  }

  /**
   * Get status of all cron jobs
   */
  getJobsStatus() {
    const status = {};
    
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled,
        nextExecution: job.nextDate ? job.nextDate() : null
      };
    }
    
    return {
      environment: this.isProduction ? 'production' : 'development',
      timezone: process.env.TZ || 'America/New_York',
      jobs: status,
      total: this.jobs.size,
      running: Array.from(this.jobs.values()).filter(job => job.running).length
    };
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    console.log('⏹️ Stopping all cron jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`  ⏹️ ${name} stopped`);
    }
  }

  /**
   * Start all cron jobs
   */
  startAll() {
    console.log('▶️ Starting all cron jobs...');
    for (const [name, job] of this.jobs) {
      job.start();
      console.log(`  ▶️ ${name} started`);
    }
  }

  /**
   * Log scheduled jobs information
   */
  logScheduledJobs() {
    console.log('\n📋 Scheduled Jobs Summary:');
    console.log('═══════════════════════════');
    console.log('🌟 Daily Generation:    6:00 AM (daily) → serve from DB rest of day');
    console.log('📅 Weekly Generation:   5:30 AM (Mondays) → serve from DB rest of week');
    console.log('❤️ Health Checks:       Every 10 minutes');
    console.log('🧹 Data Cleanup:        2:00 AM (daily)');
    console.log('📊 Analytics Cleanup:   3:00 AM (Sundays)');
    console.log('═══════════════════════════');
    console.log('💡 Efficiency Model:');
    console.log('   • Generate ONCE → Serve MANY times from database');
    console.log('   • Daily: 72 API calls → thousands of DB reads');
    console.log('   • Weekly: 72 API calls → hundreds of DB reads');
    console.log('   • Cost: ~$15-30/month (vs constant regeneration)');
    console.log('═══════════════════════════');
    console.log(`🌍 Timezone: ${process.env.TZ || 'America/New_York'}`);
    console.log(`🏭 Environment: ${this.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log('═══════════════════════════\n');
  }
}

module.exports = new CronJobsService();