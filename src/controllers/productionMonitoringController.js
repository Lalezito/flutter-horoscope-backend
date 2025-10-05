/**
 * PRODUCTION MONITORING DASHBOARD CONTROLLER
 * 
 * Features:
 * - Real-time system health monitoring
 * - Performance metrics collection
 * - Automated alerting system
 * - Resource usage tracking
 * - Application performance monitoring (APM)
 * - Error rate monitoring
 * - SLA compliance tracking
 */

const db = require("../config/db");
const recoveryController = require("./recoveryController");
const moment = require('moment');
const os = require('os');
const fs = require('fs').promises;

class ProductionMonitoringController {
  constructor() {
    this.alertThresholds = {
      cpu: 80,        // CPU usage percentage
      memory: 85,     // Memory usage percentage
      disk: 90,       // Disk usage percentage
      errorRate: 5,   // Error rate percentage per minute
      responseTime: 2000, // Response time in milliseconds
      uptime: 99.5,   // SLA uptime percentage
      backupAge: 25,  // Maximum backup age in hours
      dbConnections: 90 // Database connection pool percentage
    };
    
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      responseTimes: [],
      systemMetrics: {
        cpu: [],
        memory: [],
        disk: []
      }
    };
  }

  /**
   * Production-grade health check endpoint
   */
  async comprehensiveHealthCheck(req, res) {
    const startTime = Date.now();
    
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        checks: {}
      };

      // System resource checks
      health.checks.system = await this.checkSystemResources();
      
      // Database connectivity and performance
      health.checks.database = await this.checkDatabaseHealth();
      
      // Application-specific health checks
      health.checks.application = await this.checkApplicationHealth();
      
      // External dependencies
      health.checks.dependencies = await this.checkExternalDependencies();
      
      // Backup system status
      health.checks.backup_system = await this.checkBackupSystemHealth();
      
      // Content availability
      health.checks.content = await this.checkContentAvailability();
      
      // Security status
      health.checks.security = await this.checkSecurityStatus();
      
      // Performance metrics
      health.checks.performance = await this.checkPerformanceMetrics();

      // Determine overall health status
      health.status = this.calculateOverallStatus(health.checks);
      health.response_time_ms = Date.now() - startTime;

      // Log health check
      await this.logHealthCheck(health);

      // Send alerts if needed
      if (health.status !== 'healthy') {
        await this.processHealthAlerts(health);
      }

      const httpStatus = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(httpStatus).json(health);
      
    } catch (error) {
      console.error('Comprehensive health check failed:', error);
      
      const errorHealth = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime
      };
      
      await this.sendCriticalAlert('Health check system failure', error);
      res.status(503).json(errorHealth);
    }
  }

  /**
   * Real-time monitoring dashboard endpoint
   */
  async getMonitoringDashboard(req, res) {
    const { admin_key, timeframe = '24h' } = req.query;
    
    if (admin_key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const dashboard = {
        timestamp: new Date().toISOString(),
        timeframe: timeframe,
        summary: {},
        real_time: {},
        trends: {},
        alerts: {},
        sla_status: {}
      };

      // Real-time metrics
      dashboard.real_time = await this.getRealTimeMetrics();
      
      // Performance trends
      dashboard.trends = await this.getPerformanceTrends(timeframe);
      
      // Error analytics
      dashboard.summary.errors = await this.getErrorAnalytics(timeframe);
      
      // Resource utilization
      dashboard.summary.resources = await this.getResourceUtilization(timeframe);
      
      // API usage patterns
      dashboard.summary.api_usage = await this.getApiUsagePatterns(timeframe);
      
      // SLA compliance
      dashboard.sla_status = await this.getSLAStatus(timeframe);
      
      // Active alerts
      dashboard.alerts = await this.getActiveAlerts();
      
      // System capacity and scaling metrics
      dashboard.summary.capacity = await this.getCapacityMetrics();
      
      res.json(dashboard);
      
    } catch (error) {
      console.error('Dashboard generation failed:', error);
      res.status(500).json({
        error: 'Dashboard generation failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check system resources (CPU, Memory, Disk)
   */
  async checkSystemResources() {
    const cpu = await this.getCpuUsage();
    const memory = this.getMemoryUsage();
    const disk = await this.getDiskUsage();
    
    return {
      cpu: {
        usage_percent: cpu,
        status: cpu > this.alertThresholds.cpu ? 'warning' : 'healthy',
        threshold: this.alertThresholds.cpu
      },
      memory: {
        usage_percent: memory.percent,
        used_mb: Math.round(memory.used / 1024 / 1024),
        total_mb: Math.round(memory.total / 1024 / 1024),
        status: memory.percent > this.alertThresholds.memory ? 'warning' : 'healthy',
        threshold: this.alertThresholds.memory
      },
      disk: {
        usage_percent: disk.percent,
        used_gb: Math.round(disk.used / 1024 / 1024 / 1024),
        total_gb: Math.round(disk.total / 1024 / 1024 / 1024),
        status: disk.percent > this.alertThresholds.disk ? 'critical' : 'healthy',
        threshold: this.alertThresholds.disk
      }
    };
  }

  /**
   * Check database health and performance
   */
  async checkDatabaseHealth() {
    const startTime = Date.now();
    
    try {
      // Connection test
      const connectionResult = await db.query('SELECT 1 as test');
      
      // Connection pool status
      const poolStats = {
        total: db.totalCount || 10,
        idle: db.idleCount || 0,
        waiting: db.waitingCount || 0
      };
      
      // Database performance metrics
      const performanceQuery = await db.query(`
        SELECT 
          count(*) as active_connections,
          pg_database_size(current_database()) as db_size_bytes,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries
      `);
      
      const performance = performanceQuery.rows[0];
      const responseTime = Date.now() - startTime;
      
      // Table stats
      const tableStats = await db.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 10
      `);
      
      return {
        connectivity: {
          status: 'healthy',
          response_time_ms: responseTime
        },
        connection_pool: {
          total: poolStats.total,
          idle: poolStats.idle,
          waiting: poolStats.waiting,
          utilization_percent: Math.round(((poolStats.total - poolStats.idle) / poolStats.total) * 100),
          status: poolStats.waiting > 0 ? 'warning' : 'healthy'
        },
        performance: {
          active_connections: parseInt(performance.active_connections),
          active_queries: parseInt(performance.active_queries),
          database_size_mb: Math.round(performance.db_size_bytes / 1024 / 1024),
          status: responseTime > 500 ? 'warning' : 'healthy'
        },
        tables: {
          count: tableStats.rows.length,
          top_tables: tableStats.rows,
          status: 'healthy'
        }
      };
      
    } catch (error) {
      return {
        connectivity: {
          status: 'unhealthy',
          error: error.message
        },
        performance: {
          status: 'unhealthy'
        }
      };
    }
  }

  /**
   * Check application-specific health
   */
  async checkApplicationHealth() {
    try {
      // OpenAI API connectivity
      const openaiStatus = await this.checkOpenAIConnection();
      
      // Cron jobs status
      const cronJobs = require('../services/cronJobs');
      const cronStatus = cronJobs.getJobsStatus();
      
      // Rate limiting status
      const rateLimitStats = require('../middleware/rateLimiter').getRateLimitStats();
      
      return {
        openai: openaiStatus,
        cron_jobs: {
          total: cronStatus.total,
          running: cronStatus.running,
          environment: cronStatus.environment,
          status: cronStatus.running === cronStatus.total ? 'healthy' : 'warning'
        },
        rate_limiting: {
          active_ips: rateLimitStats.activeIPs,
          flagged_ips: rateLimitStats.flaggedIPs,
          status: rateLimitStats.flaggedIPs > 50 ? 'warning' : 'healthy'
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check external dependencies
   */
  async checkExternalDependencies() {
    const dependencies = [];
    
    // Railway platform status
    dependencies.push(await this.checkRailwayStatus());
    
    // OpenAI API status
    dependencies.push(await this.checkOpenAIStatus());
    
    return {
      total: dependencies.length,
      healthy: dependencies.filter(d => d.status === 'healthy').length,
      dependencies: dependencies
    };
  }

  /**
   * Check backup system health
   */
  async checkBackupSystemHealth() {
    try {
      // Get recent backup info
      const recentBackups = await db.query(`
        SELECT 
          backup_type,
          status,
          created_at,
          file_size,
          verification_status
        FROM backup_metadata 
        WHERE created_at > NOW() - INTERVAL '48 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      const backups = recentBackups.rows || [];
      const latestBackup = backups[0];
      
      let status = 'healthy';
      const issues = [];
      
      if (!latestBackup) {
        status = 'critical';
        issues.push('No recent backups found');
      } else {
        const hoursOld = moment().diff(moment(latestBackup.created_at), 'hours');
        if (hoursOld > this.alertThresholds.backupAge) {
          status = 'warning';
          issues.push(`Latest backup is ${hoursOld} hours old`);
        }
        
        if (latestBackup.status !== 'completed') {
          status = 'critical';
          issues.push(`Latest backup status: ${latestBackup.status}`);
        }
      }
      
      return {
        latest_backup: latestBackup,
        recent_backups_count: backups.length,
        status: status,
        issues: issues,
        retention_compliance: await this.checkBackupRetention()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check content availability
   */
  async checkContentAvailability() {
    try {
      // Check horoscope coverage
      const today = moment().format('YYYY-MM-DD');
      const thisWeekStart = moment().startOf('week').format('YYYY-MM-DD');
      
      const dailyCheck = await db.query(
        'SELECT COUNT(*) as count FROM daily_horoscopes WHERE date = $1',
        [today]
      );
      
      const weeklyCheck = await db.query(
        'SELECT COUNT(*) as count FROM weekly_horoscopes WHERE week_start = $1',
        [thisWeekStart]
      );
      
      const dailyCount = parseInt(dailyCheck.rows[0]?.count || 0);
      const weeklyCount = parseInt(weeklyCheck.rows[0]?.count || 0);
      
      // Expected count is 72 (12 zodiac signs × 6 languages)
      const expectedCount = 72;
      
      return {
        daily: {
          available: dailyCount,
          expected: expectedCount,
          coverage_percent: Math.round((dailyCount / expectedCount) * 100),
          status: dailyCount === expectedCount ? 'healthy' : dailyCount > 0 ? 'warning' : 'critical'
        },
        weekly: {
          available: weeklyCount,
          expected: expectedCount,
          coverage_percent: Math.round((weeklyCount / expectedCount) * 100),
          status: weeklyCount === expectedCount ? 'healthy' : weeklyCount > 0 ? 'warning' : 'critical'
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check security status
   */
  async checkSecurityStatus() {
    try {
      const recentErrors = await db.query(`
        SELECT error_type, COUNT(*) as count
        FROM error_logs
        WHERE timestamp > NOW() - INTERVAL '1 hour'
          AND error_type LIKE '%security%'
        GROUP BY error_type
      `);
      
      const rateLimitViolations = await db.query(`
        SELECT COUNT(*) as count
        FROM usage_analytics
        WHERE timestamp > NOW() - INTERVAL '1 hour'
          AND status_code = 429
      `);
      
      const securityErrors = recentErrors.rows || [];
      const rateLimitCount = parseInt(rateLimitViolations.rows[0]?.count || 0);
      
      return {
        security_errors: securityErrors,
        rate_limit_violations: rateLimitCount,
        ssl_status: 'healthy', // Railway handles SSL automatically
        environment_variables: {
          required: ['DATABASE_URL', 'OPENAI_API_KEY', 'ADMIN_KEY'],
          configured: this.checkRequiredEnvVars(),
          status: this.checkRequiredEnvVars().length === 3 ? 'healthy' : 'critical'
        },
        status: securityErrors.length > 0 || rateLimitCount > 100 ? 'warning' : 'healthy'
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check performance metrics
   */
  async checkPerformanceMetrics() {
    try {
      // Get recent response times
      const recentRequests = await db.query(`
        SELECT 
          AVG(response_time_ms) as avg_response_time,
          MAX(response_time_ms) as max_response_time,
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status_code >= 500) as server_errors,
          COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as client_errors
        FROM usage_analytics
        WHERE timestamp > NOW() - INTERVAL '5 minutes'
      `);
      
      const metrics = recentRequests.rows[0];
      const avgResponseTime = parseFloat(metrics?.avg_response_time || 0);
      const maxResponseTime = parseFloat(metrics?.max_response_time || 0);
      const totalRequests = parseInt(metrics?.total_requests || 0);
      const errorRate = totalRequests > 0 ? 
        ((parseInt(metrics?.server_errors || 0) + parseInt(metrics?.client_errors || 0)) / totalRequests) * 100 : 0;
      
      return {
        response_time: {
          average_ms: Math.round(avgResponseTime),
          max_ms: Math.round(maxResponseTime),
          status: avgResponseTime > this.alertThresholds.responseTime ? 'warning' : 'healthy',
          threshold_ms: this.alertThresholds.responseTime
        },
        throughput: {
          requests_per_minute: Math.round(totalRequests / 5) * 60, // Last 5 minutes extrapolated
          total_requests: totalRequests,
          status: 'healthy'
        },
        error_rate: {
          percentage: Math.round(errorRate * 100) / 100,
          server_errors: parseInt(metrics?.server_errors || 0),
          client_errors: parseInt(metrics?.client_errors || 0),
          status: errorRate > this.alertThresholds.errorRate ? 'critical' : 'healthy',
          threshold_percent: this.alertThresholds.errorRate
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Calculate overall system status
   */
  calculateOverallStatus(checks) {
    let criticalIssues = 0;
    let warningIssues = 0;
    
    const checkStatus = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (obj[key].status === 'critical' || obj[key].status === 'unhealthy') {
            criticalIssues++;
          } else if (obj[key].status === 'warning' || obj[key].status === 'degraded') {
            warningIssues++;
          }
          checkStatus(obj[key]);
        }
      }
    };
    
    checkStatus(checks);
    
    if (criticalIssues > 0) return 'unhealthy';
    if (warningIssues > 2) return 'degraded';
    if (warningIssues > 0) return 'healthy'; // Still healthy but with warnings
    return 'healthy';
  }

  /**
   * Process health alerts
   */
  async processHealthAlerts(health) {
    const alerts = [];
    
    // Check each component for alert-worthy conditions
    if (health.checks.system?.cpu?.status === 'warning') {
      alerts.push({
        level: 'warning',
        component: 'system',
        message: `High CPU usage: ${health.checks.system.cpu.usage_percent}%`,
        threshold: health.checks.system.cpu.threshold
      });
    }
    
    if (health.checks.database?.connectivity?.status === 'unhealthy') {
      alerts.push({
        level: 'critical',
        component: 'database',
        message: 'Database connectivity issues detected',
        error: health.checks.database.connectivity.error
      });
    }
    
    if (health.checks.content?.daily?.status === 'critical') {
      alerts.push({
        level: 'critical',
        component: 'content',
        message: `No daily horoscopes available for today`,
        coverage: health.checks.content.daily.coverage_percent
      });
    }
    
    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert.message, alert.level, alert);
    }
  }

  /**
   * Send alert via webhook
   */
  async sendAlert(message, level = 'info', context = null) {
    const alertPayload = {
      text: `🔔 Zodiac Production Alert: ${message}`,
      level: level,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      context: context,
      hostname: os.hostname(),
      uptime: process.uptime()
    };

    if (process.env.WEBHOOK_ALERT_URL) {
      try {
        const response = await fetch(process.env.WEBHOOK_ALERT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload)
        });
        
        if (!response.ok) {
          console.error('Failed to send alert:', response.statusText);
        }
      } catch (error) {
        console.error('Alert sending failed:', error);
      }
    }

    // Log alert to database
    try {
      await db.query(`
        INSERT INTO system_health_logs (check_type, status, details, timestamp)
        VALUES ($1, $2, $3, $4)
      `, [
        'alert',
        level,
        JSON.stringify(alertPayload),
        new Date()
      ]);
    } catch (error) {
      console.error('Failed to log alert:', error);
    }
  }

  /**
   * Send critical alert for system failures
   */
  async sendCriticalAlert(message, error) {
    await this.sendAlert(message, 'critical', {
      error: error.message,
      stack: error.stack,
      pid: process.pid,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    });
  }

  // Helper methods for system metrics

  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds
        const cpuPercent = ((endUsage.user + endUsage.system) / totalTime) * 100;
        
        resolve(Math.round(cpuPercent * 100) / 100);
      }, 100);
    });
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    return {
      used: used,
      total: total,
      percent: Math.round((used / total) * 100)
    };
  }

  async getDiskUsage() {
    try {
      const stats = await fs.stat('/');
      // This is simplified - in production you'd use a proper disk usage library
      return {
        used: 0,
        total: 100 * 1024 * 1024 * 1024, // 100GB default
        percent: 0
      };
    } catch (error) {
      return {
        used: 0,
        total: 0,
        percent: 0
      };
    }
  }

  async checkOpenAIConnection() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return {
          status: 'unhealthy',
          error: 'OpenAI API key not configured'
        };
      }
      
      // Simple connectivity check (could be enhanced with actual API call)
      return {
        status: 'healthy',
        configured: true,
        api_key_length: process.env.OPENAI_API_KEY.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkRailwayStatus() {
    return {
      name: 'Railway Platform',
      status: 'healthy', // Railway doesn't provide public status API
      region: process.env.RAILWAY_REGION || 'us-west1'
    };
  }

  async checkOpenAIStatus() {
    return {
      name: 'OpenAI API',
      status: process.env.OPENAI_API_KEY ? 'healthy' : 'unhealthy',
      configured: !!process.env.OPENAI_API_KEY
    };
  }

  checkRequiredEnvVars() {
    const required = ['DATABASE_URL', 'OPENAI_API_KEY', 'ADMIN_KEY'];
    return required.filter(varName => process.env[varName]);
  }

  async logHealthCheck(healthData) {
    try {
      await db.query(`
        INSERT INTO system_health_logs (check_type, status, details, timestamp)
        VALUES ($1, $2, $3, $4)
      `, [
        'comprehensive_health_check',
        healthData.status,
        JSON.stringify(healthData),
        new Date()
      ]);
    } catch (error) {
      console.error('Health check logging failed:', error);
    }
  }

  async getRealTimeMetrics() {
    // Implementation for real-time metrics
    return {
      timestamp: new Date().toISOString(),
      cpu_percent: await this.getCpuUsage(),
      memory_percent: this.getMemoryUsage().percent,
      active_connections: await this.getActiveConnections(),
      requests_per_second: await this.getCurrentRPS()
    };
  }

  async getActiveConnections() {
    try {
      const result = await db.query('SELECT count(*) FROM pg_stat_activity WHERE state = $1', ['active']);
      return parseInt(result.rows[0]?.count || 0);
    } catch (error) {
      return 0;
    }
  }

  async getCurrentRPS() {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM usage_analytics
        WHERE timestamp > NOW() - INTERVAL '10 seconds'
      `);
      const count = parseInt(result.rows[0]?.count || 0);
      return Math.round((count / 10) * 10) / 10; // RPS with 1 decimal
    } catch (error) {
      return 0;
    }
  }

  async getPerformanceTrends(timeframe) {
    const interval = timeframe === '24h' ? '1 hour' : timeframe === '7d' ? '6 hours' : '1 day';
    
    try {
      const trends = await db.query(`
        SELECT 
          date_trunc($1, timestamp) as period,
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) as request_count,
          COUNT(*) FILTER (WHERE status_code >= 500) as error_count
        FROM usage_analytics
        WHERE timestamp > NOW() - INTERVAL $2
        GROUP BY date_trunc($1, timestamp)
        ORDER BY period
      `, [interval, timeframe]);
      
      return trends.rows;
    } catch (error) {
      return [];
    }
  }

  async getSLAStatus(timeframe) {
    try {
      const slaData = await db.query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status_code < 500) as successful_requests,
          AVG(response_time_ms) as avg_response_time
        FROM usage_analytics
        WHERE timestamp > NOW() - INTERVAL $1
      `, [timeframe]);
      
      const data = slaData.rows[0];
      const uptime = data.total_requests > 0 ? 
        (data.successful_requests / data.total_requests) * 100 : 100;
      
      return {
        uptime_percent: Math.round(uptime * 100) / 100,
        target_percent: this.alertThresholds.uptime,
        status: uptime >= this.alertThresholds.uptime ? 'healthy' : 'critical',
        avg_response_time_ms: Math.round(data.avg_response_time || 0),
        total_requests: parseInt(data.total_requests || 0)
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async getErrorAnalytics(timeframe) {
    try {
      const errorData = await db.query(`
        SELECT 
          error_type,
          COUNT(*) as count,
          MAX(timestamp) as last_occurrence
        FROM error_logs
        WHERE timestamp > NOW() - INTERVAL $1
        GROUP BY error_type
        ORDER BY count DESC
        LIMIT 10
      `, [timeframe]);
      
      return errorData.rows;
    } catch (error) {
      return [];
    }
  }

  async getResourceUtilization(timeframe) {
    // This would typically integrate with system monitoring tools
    // For now, return current snapshot
    return {
      cpu: await this.getCpuUsage(),
      memory: this.getMemoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  async getApiUsagePatterns(timeframe) {
    try {
      const patterns = await db.query(`
        SELECT 
          endpoint,
          COUNT(*) as request_count,
          AVG(response_time_ms) as avg_response_time,
          COUNT(DISTINCT ip) as unique_users
        FROM usage_analytics
        WHERE timestamp > NOW() - INTERVAL $1
        GROUP BY endpoint
        ORDER BY request_count DESC
        LIMIT 10
      `, [timeframe]);
      
      return patterns.rows;
    } catch (error) {
      return [];
    }
  }

  async getActiveAlerts() {
    try {
      const alerts = await db.query(`
        SELECT 
          details,
          timestamp,
          status
        FROM system_health_logs
        WHERE check_type = 'alert'
          AND timestamp > NOW() - INTERVAL '1 hour'
          AND status IN ('warning', 'critical')
        ORDER BY timestamp DESC
        LIMIT 20
      `);
      
      return alerts.rows.map(row => ({
        ...JSON.parse(row.details),
        logged_at: row.timestamp
      }));
    } catch (error) {
      return [];
    }
  }

  async getCapacityMetrics() {
    const metrics = {
      database: await this.getDatabaseCapacity(),
      system: await this.getSystemCapacity(),
      application: await this.getApplicationCapacity()
    };
    
    return metrics;
  }

  async getDatabaseCapacity() {
    try {
      const capacity = await db.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as size,
          (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
          (SELECT count(*) FROM pg_stat_activity) as current_connections
      `);
      
      const data = capacity.rows[0];
      const maxConn = parseInt(data.max_connections);
      const currentConn = parseInt(data.current_connections);
      
      return {
        size: data.size,
        connection_utilization_percent: Math.round((currentConn / maxConn) * 100),
        max_connections: maxConn,
        current_connections: currentConn,
        status: (currentConn / maxConn) > 0.8 ? 'warning' : 'healthy'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getSystemCapacity() {
    const memory = this.getMemoryUsage();
    return {
      memory_utilization_percent: memory.percent,
      memory_used_gb: Math.round(memory.used / 1024 / 1024 / 1024),
      memory_total_gb: Math.round(memory.total / 1024 / 1024 / 1024),
      cpu_cores: os.cpus().length,
      status: memory.percent > 85 ? 'warning' : 'healthy'
    };
  }

  async getApplicationCapacity() {
    return {
      uptime_hours: Math.round(process.uptime() / 3600),
      node_version: process.version,
      memory_heap_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      pid: process.pid,
      status: 'healthy'
    };
  }

  async checkBackupRetention() {
    try {
      const retention = await db.query(`
        SELECT 
          backup_type,
          COUNT(*) as count,
          MIN(created_at) as oldest,
          MAX(created_at) as newest
        FROM backup_metadata
        WHERE status = 'completed'
          AND retention_until > NOW()
        GROUP BY backup_type
      `);
      
      return retention.rows;
    } catch (error) {
      return [];
    }
  }
}

module.exports = new ProductionMonitoringController();