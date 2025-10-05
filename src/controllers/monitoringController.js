const db = require("../config/db");
const recoveryController = require("./recoveryController");
const moment = require('moment');

// Variables para seguimiento de MCP
let mcpMetrics = {
  serverStatus: 'not_initialized',
  toolsCalled: 0,
  resourcesAccessed: 0,
  promptsUsed: 0,
  lastActivity: null
};

class MonitoringController {
  /**
   * Comprehensive health check endpoint
   */
  async healthCheck(req, res) {
    try {
      const health = await recoveryController.systemHealthCheck();
      
      // Add additional API-specific checks
      health.checks.api_status = {
        status: 'ok',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      };
      
      // Add MCP server status
      health.checks.mcp_status = this.getMcpMetrics();
      
      // Set appropriate HTTP status based on health
      let httpStatus = 200;
      if (health.status === 'error') httpStatus = 503;
      else if (health.status === 'warning') httpStatus = 200;
      
      res.status(httpStatus).json(health);
      
      // Log health check result
      this.logHealthCheck(health);
      
    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Analytics dashboard endpoint
   */
  async getAnalytics(req, res) {
    const { admin_key } = req.query;
    
    if (admin_key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const analytics = await this.generateAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to generate analytics',
        message: error.message
      });
    }
  }

  /**
   * Log API usage for analytics
   */
  async logUsage(req, res, next) {
    const startTime = Date.now();
    
    // Capture response details
    const originalSend = res.send;
    res.send = function(data) {
      const responseTime = Date.now() - startTime;
      
      // Log usage asynchronously
      setImmediate(async () => {
        try {
          await db.query(`
            INSERT INTO usage_analytics (ip, endpoint, method, timestamp, user_agent, response_time_ms, status_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            req.ip || req.connection.remoteAddress || 'unknown',
            req.originalUrl || req.path,
            req.method,
            new Date(),
            req.get('User-Agent') || 'unknown',
            responseTime,
            res.statusCode
          ]);
        } catch (error) {
          console.error('Analytics logging failed:', error);
        }
      });
      
      originalSend.call(this, data);
    };
    
    next();
  }

  /**
   * Log health check results
   */
  async logHealthCheck(healthData) {
    try {
      await db.query(`
        INSERT INTO system_health_logs (check_type, status, details, timestamp)
        VALUES ($1, $2, $3, $4)
      `, [
        'comprehensive_health_check',
        healthData.status,
        JSON.stringify(healthData.checks),
        new Date()
      ]);
    } catch (error) {
      console.error('Health check logging failed:', error);
    }
  }

  /**
   * Log errors for debugging and monitoring
   */
  async logError(errorType, errorMessage, stackTrace = null, context = null) {
    try {
      await db.query(`
        INSERT INTO error_logs (error_type, error_message, stack_trace, context, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        errorType,
        errorMessage,
        stackTrace,
        context ? JSON.stringify(context) : null,
        new Date()
      ]);
    } catch (error) {
      console.error('Error logging failed:', error);
    }
  }

  /**
   * Generate analytics summary
   */
  async generateAnalytics() {
    const analytics = {
      timestamp: new Date().toISOString(),
      period: 'last_7_days',
      summary: {}
    };

    try {
      // API usage stats
      const usageStats = await db.query(`
        SELECT 
          DATE(timestamp) as date,
          endpoint,
          COUNT(*) as requests,
          AVG(response_time_ms) as avg_response_time,
          COUNT(DISTINCT ip) as unique_ips
        FROM usage_analytics 
        WHERE timestamp > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(timestamp), endpoint
        ORDER BY date DESC, requests DESC
      `);
      
      analytics.summary.api_usage = usageStats.rows;

      // Most popular endpoints
      const popularEndpoints = await db.query(`
        SELECT 
          endpoint,
          COUNT(*) as total_requests,
          AVG(response_time_ms) as avg_response_time,
          COUNT(DISTINCT ip) as unique_users
        FROM usage_analytics 
        WHERE timestamp > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY endpoint
        ORDER BY total_requests DESC
        LIMIT 10
      `);
      
      analytics.summary.popular_endpoints = popularEndpoints.rows;

      // Error frequency
      const errorStats = await db.query(`
        SELECT 
          error_type,
          COUNT(*) as occurrences,
          MAX(timestamp) as last_occurrence
        FROM error_logs 
        WHERE timestamp > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY error_type
        ORDER BY occurrences DESC
      `);
      
      analytics.summary.error_stats = errorStats.rows;

      // Health check trends
      const healthStats = await db.query(`
        SELECT 
          DATE(timestamp) as date,
          status,
          COUNT(*) as count
        FROM system_health_logs 
        WHERE timestamp > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(timestamp), status
        ORDER BY date DESC
      `);
      
      analytics.summary.health_trends = healthStats.rows;

      // Content coverage stats
      const coverageStats = await db.query(`
        SELECT 
          'daily' as type,
          DATE(date) as content_date,
          COUNT(*) as available_horoscopes
        FROM daily_horoscopes 
        WHERE date > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(date)
        
        UNION ALL
        
        SELECT 
          'weekly' as type,
          week_start as content_date,
          COUNT(*) as available_horoscopes
        FROM weekly_horoscopes 
        WHERE week_start > CURRENT_DATE - INTERVAL '4 weeks'
        GROUP BY week_start
        ORDER BY content_date DESC
      `);
      
      analytics.summary.content_coverage = coverageStats.rows;

      // Add MCP metrics
      analytics.summary.mcp_metrics = this.getMcpMetrics();

    } catch (error) {
      analytics.error = error.message;
    }

    return analytics;
  }

  /**
   * Send alert to external webhook (Discord, Slack, etc.)
   */
  async sendAlert(message, type = 'warning', context = null) {
    if (!process.env.WEBHOOK_ALERT_URL) {
      console.log(`Alert (${type}): ${message}`);
      return;
    }

    try {
      const alertPayload = {
        text: `🚨 Zodiac Backend Alert: ${message}`,
        type: type,
        timestamp: new Date().toISOString(),
        context: context
      };

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
      // Log the error for debugging
      this.logError('alert_failure', error.message, error.stack, { originalMessage: message, type });
    }
  }

  /**
   * Automated monitoring checks (to be called periodically)
   */
  async performAutomatedChecks() {
    try {
      const health = await recoveryController.systemHealthCheck();
      
      // Alert on errors
      if (health.status === 'error') {
        await this.sendAlert(
          'System health check failed - immediate attention required',
          'error',
          health.checks
        );
      }
      
      // Alert on low coverage
      if (health.checks.weekly_coverage && health.checks.weekly_coverage.percentage < 90) {
        await this.sendAlert(
          `Weekly horoscope coverage low: ${health.checks.weekly_coverage.percentage}%`,
          'warning',
          health.checks.weekly_coverage
        );
      }
      
      if (health.checks.daily_coverage && health.checks.daily_coverage.percentage < 90) {
        await this.sendAlert(
          `Daily horoscope coverage low: ${health.checks.daily_coverage.percentage}%`,
          'error',
          health.checks.daily_coverage
        );
      }

      console.log('Automated monitoring check completed:', health.status);
      
    } catch (error) {
      console.error('Automated monitoring check failed:', error);
      await this.sendAlert(
        'Automated monitoring system failure',
        'error',
        { error: error.message }
      );
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupAnalytics() {
    try {
      // Keep only last 30 days of usage analytics
      const usageCleanup = await db.query(`
        DELETE FROM usage_analytics 
        WHERE timestamp < CURRENT_DATE - INTERVAL '30 days'
      `);

      // Keep only last 90 days of health logs
      const healthCleanup = await db.query(`
        DELETE FROM system_health_logs 
        WHERE timestamp < CURRENT_DATE - INTERVAL '90 days'
      `);

      // Keep only last 30 days of error logs
      const errorCleanup = await db.query(`
        DELETE FROM error_logs 
        WHERE timestamp < CURRENT_DATE - INTERVAL '30 days'
      `);

      console.log('Analytics cleanup completed:', {
        usage_deleted: usageCleanup.rowCount,
        health_deleted: healthCleanup.rowCount,
        errors_deleted: errorCleanup.rowCount
      });

    } catch (error) {
      console.error('Analytics cleanup failed:', error);
      this.logError('cleanup_failure', error.message, error.stack);
    }
  }

  /**
   * Update MCP server status
   */
  updateMcpServerStatus(status) {
    mcpMetrics.serverStatus = status;
    mcpMetrics.lastActivity = new Date().toISOString();
  }

  /**
   * Increment MCP tools counter
   */
  incrementMcpToolsCalled() {
    mcpMetrics.toolsCalled++;
    mcpMetrics.lastActivity = new Date().toISOString();
  }

  /**
   * Increment MCP resources counter
   */
  incrementMcpResourcesAccessed() {
    mcpMetrics.resourcesAccessed++;
    mcpMetrics.lastActivity = new Date().toISOString();
  }

  /**
   * Increment MCP prompts counter
   */
  incrementMcpPromptsUsed() {
    mcpMetrics.promptsUsed++;
    mcpMetrics.lastActivity = new Date().toISOString();
  }

  /**
   * Get current MCP metrics
   */
  getMcpMetrics() {
    return { ...mcpMetrics };
  }

  /**
   * Reset MCP metrics
   */
  resetMcpMetrics() {
    mcpMetrics = {
      serverStatus: 'not_initialized',
      toolsCalled: 0,
      resourcesAccessed: 0,
      promptsUsed: 0,
      lastActivity: null
    };
  }
}

module.exports = new MonitoringController();