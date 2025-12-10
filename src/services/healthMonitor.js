// Health Monitoring Service
// Continuous health checks and automated alerting

const logger = require('./loggingService');
const { healthCheckWithTimeout } = require('../config/resilience');

class HealthMonitor {
  constructor() {
    this.checks = new Map();
    this.results = new Map();
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.alertCallbacks = [];
    this.consecutiveFailures = new Map();
    this.FAILURE_THRESHOLD = 3; // Alert after 3 consecutive failures
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      interval: options.interval || 60000, // Default 1 minute
      lastCheck: null,
      enabled: true
    });

    this.consecutiveFailures.set(name, 0);

    logger.getLogger().info(`Health check registered: ${name}`, {
      timeout: options.timeout,
      critical: options.critical
    });
  }

  /**
   * Register alert callback
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Execute a single health check
   */
  async executeCheck(name) {
    const check = this.checks.get(name);
    if (!check || !check.enabled) {
      return null;
    }

    const startTime = Date.now();
    let result = {
      name,
      status: 'unknown',
      message: '',
      duration: 0,
      timestamp: new Date().toISOString(),
      critical: check.critical
    };

    try {
      const checkResult = await healthCheckWithTimeout(
        check.fn,
        check.timeout
      );

      result.status = 'healthy';
      result.message = checkResult?.message || 'OK';
      result.data = checkResult?.data;
      result.duration = Date.now() - startTime;

      // Reset consecutive failures
      this.consecutiveFailures.set(name, 0);

      logger.getLogger().debug(`Health check passed: ${name}`, {
        duration: result.duration
      });

    } catch (error) {
      result.status = 'unhealthy';
      result.message = error.message;
      result.duration = Date.now() - startTime;
      result.error = {
        message: error.message,
        stack: error.stack
      };

      // Increment consecutive failures
      const failures = this.consecutiveFailures.get(name) + 1;
      this.consecutiveFailures.set(name, failures);

      logger.logError(error, {
        context: 'health_check_failed',
        checkName: name,
        consecutiveFailures: failures,
        critical: check.critical
      });

      // Trigger alert if threshold reached
      if (failures >= this.FAILURE_THRESHOLD) {
        await this.triggerAlert({
          type: 'health_check_failure',
          severity: check.critical ? 'critical' : 'warning',
          checkName: name,
          consecutiveFailures: failures,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    check.lastCheck = Date.now();
    this.results.set(name, result);

    return result;
  }

  /**
   * Execute all health checks
   */
  async executeAllChecks() {
    const results = [];

    for (const [name] of this.checks) {
      const result = await this.executeCheck(name);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs = 60000) {
    if (this.isMonitoring) {
      logger.getLogger().warn('Health monitoring already started');
      return;
    }

    this.isMonitoring = true;

    logger.getLogger().info('Starting health monitoring', {
      interval: intervalMs,
      checks: Array.from(this.checks.keys())
    });

    // Execute initial check
    this.executeAllChecks().catch(error => {
      logger.logError(error, { context: 'initial_health_check' });
    });

    // Start interval
    this.monitorInterval = setInterval(async () => {
      try {
        await this.executeAllChecks();
      } catch (error) {
        logger.logError(error, { context: 'health_monitoring_interval' });
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.isMonitoring = false;

      logger.getLogger().info('Health monitoring stopped');
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    const checks = [];
    let overallStatus = 'healthy';
    let criticalFailures = 0;

    for (const [name, result] of this.results) {
      checks.push(result);

      if (result.status === 'unhealthy') {
        if (result.critical) {
          criticalFailures++;
          overallStatus = 'critical';
        } else if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      criticalFailures,
      totalChecks: this.checks.size,
      checks
    };
  }

  /**
   * Get health summary for dashboard
   */
  getHealthSummary() {
    const status = this.getHealthStatus();
    const summary = {
      status: status.status,
      timestamp: status.timestamp,
      healthy: 0,
      unhealthy: 0,
      critical: 0,
      totalChecks: status.totalChecks
    };

    for (const check of status.checks) {
      if (check.status === 'healthy') {
        summary.healthy++;
      } else if (check.critical) {
        summary.critical++;
      } else {
        summary.unhealthy++;
      }
    }

    return summary;
  }

  /**
   * Trigger alert
   */
  async triggerAlert(alert) {
    logger.getLogger().error('Health alert triggered', alert);

    // Execute all alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        await callback(alert);
      } catch (error) {
        logger.logError(error, {
          context: 'alert_callback_failed',
          alert
        });
      }
    }
  }

  /**
   * Enable/disable a check
   */
  setCheckEnabled(name, enabled) {
    const check = this.checks.get(name);
    if (check) {
      check.enabled = enabled;
      logger.getLogger().info(`Health check ${name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Remove a check
   */
  removeCheck(name) {
    this.checks.delete(name);
    this.results.delete(name);
    this.consecutiveFailures.delete(name);
    logger.getLogger().info(`Health check removed: ${name}`);
  }
}

// Create singleton instance
const healthMonitor = new HealthMonitor();

// Register default health checks
function registerDefaultChecks() {
  // Database health
  healthMonitor.registerCheck(
    'database',
    async () => {
      const db = require('../config/db');
      await db.testConnection();
      return { message: 'Database connection OK' };
    },
    { timeout: 5000, critical: true }
  );

  // Redis health
  healthMonitor.registerCheck(
    'redis',
    async () => {
      const redisService = require('./redisService');
      const health = await redisService.getHealthStatus();
      if (!health.connected && health.mode !== 'memory') {
        throw new Error('Redis connection failed');
      }
      return { message: `Redis ${health.mode} mode OK` };
    },
    { timeout: 3000, critical: false }
  );

  // Firebase health
  healthMonitor.registerCheck(
    'firebase',
    async () => {
      const firebaseService = require('./firebaseService');
      const status = firebaseService.getStatus();
      return {
        message: `Firebase ${status.initialized ? 'initialized' : 'mock mode'}`,
        data: status
      };
    },
    { timeout: 2000, critical: false }
  );

  // Memory usage
  healthMonitor.registerCheck(
    'memory',
    async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const heapPercentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);

      if (heapPercentage > 90) {
        throw new Error(`High memory usage: ${heapPercentage}% (${heapUsedMB}MB / ${heapTotalMB}MB)`);
      }

      return {
        message: `Memory usage OK: ${heapPercentage}%`,
        data: { heapUsedMB, heapTotalMB, heapPercentage }
      };
    },
    { timeout: 1000, critical: true }
  );

  // OpenAI API health
  healthMonitor.registerCheck(
    'openai',
    async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }
      return { message: 'OpenAI API key configured' };
    },
    { timeout: 1000, critical: false }
  );

  logger.getLogger().info('Default health checks registered');
}

module.exports = {
  healthMonitor,
  registerDefaultChecks
};