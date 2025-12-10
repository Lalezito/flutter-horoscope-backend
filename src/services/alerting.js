// Alerting Service v2.0
// Enterprise-grade alerting with deduplication, escalation, and recovery tracking

const logger = require('./loggingService');
const axios = require('axios');

// Alert severity levels with priority
const SEVERITY_PRIORITY = {
  critical: 1,
  warning: 2,
  info: 3
};

class AlertingService {
  constructor() {
    this.channels = new Map();
    this.alertHistory = [];
    this.activeAlerts = new Map(); // Track ongoing issues
    this.resolvedAlerts = [];
    this.MAX_HISTORY = 500;
    this.MAX_RESOLVED = 100;
    this.rateLimits = new Map();
    this.RATE_LIMIT_WINDOW = 300000; // 5 minutes
    this.MAX_ALERTS_PER_WINDOW = 10;
    this.deduplicationWindow = 60000; // 1 minute - avoid duplicate alerts
    this.recentAlertHashes = new Map();
    this.escalationRules = [];
    this.suppressedAlerts = new Set(); // Manually suppressed alert types
    this.maintenanceMode = false;
    this.stats = {
      totalSent: 0,
      totalSuppressed: 0,
      totalDeduplicated: 0,
      byChannel: {},
      bySeverity: { critical: 0, warning: 0, info: 0 }
    };
  }

  /**
   * Register an alert channel with retry support
   */
  registerChannel(name, sendFn, options = {}) {
    this.channels.set(name, {
      send: sendFn,
      enabled: options.enabled !== false,
      severityFilter: options.severityFilter || ['critical', 'warning', 'info'],
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000,
      timeout: options.timeout || 5000,
      priority: options.priority || 10, // Lower = higher priority
      failureCount: 0,
      lastFailure: null,
      circuitOpen: false
    });

    this.stats.byChannel[name] = { sent: 0, failed: 0 };

    logger.getLogger().info(`Alert channel registered: ${name}`, {
      severityFilter: options.severityFilter,
      retries: options.retries
    });
  }

  /**
   * Generate hash for alert deduplication
   */
  generateAlertHash(alert) {
    const key = `${alert.type}:${alert.severity}:${alert.checkName || ''}:${alert.error || ''}`;
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  /**
   * Check if alert is duplicate (sent recently)
   */
  isDuplicate(alert) {
    const hash = this.generateAlertHash(alert);
    const lastSent = this.recentAlertHashes.get(hash);

    if (lastSent && Date.now() - lastSent < this.deduplicationWindow) {
      this.stats.totalDeduplicated++;
      return true;
    }

    this.recentAlertHashes.set(hash, Date.now());

    // Cleanup old hashes periodically
    if (this.recentAlertHashes.size > 1000) {
      const now = Date.now();
      for (const [key, time] of this.recentAlertHashes) {
        if (now - time > this.deduplicationWindow * 2) {
          this.recentAlertHashes.delete(key);
        }
      }
    }

    return false;
  }

  /**
   * Check rate limit for alert type
   */
  checkRateLimit(alertType) {
    const now = Date.now();
    const key = alertType;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const alerts = this.rateLimits.get(key);
    const recentAlerts = alerts.filter(time => now - time < this.RATE_LIMIT_WINDOW);

    if (recentAlerts.length >= this.MAX_ALERTS_PER_WINDOW) {
      logger.getLogger().warn(`Alert rate limit exceeded for ${alertType}`, {
        count: recentAlerts.length,
        window: this.RATE_LIMIT_WINDOW
      });
      return false;
    }

    recentAlerts.push(now);
    this.rateLimits.set(key, recentAlerts);

    return true;
  }

  /**
   * Add escalation rule
   */
  addEscalationRule(rule) {
    this.escalationRules.push({
      name: rule.name,
      condition: rule.condition, // Function: (alert, activeAlerts) => boolean
      escalateTo: rule.escalateTo, // Array of channel names
      afterMinutes: rule.afterMinutes || 15,
      maxEscalations: rule.maxEscalations || 3
    });

    logger.getLogger().info(`Escalation rule added: ${rule.name}`);
  }

  /**
   * Check and process escalations
   */
  async processEscalations() {
    const now = Date.now();

    for (const [alertId, activeAlert] of this.activeAlerts) {
      for (const rule of this.escalationRules) {
        const minutesSinceCreated = (now - activeAlert.createdAt) / 60000;

        if (
          minutesSinceCreated >= rule.afterMinutes &&
          activeAlert.escalationCount < rule.maxEscalations &&
          rule.condition(activeAlert, this.activeAlerts)
        ) {
          activeAlert.escalationCount++;
          activeAlert.lastEscalation = now;

          const escalationAlert = {
            ...activeAlert,
            type: `ESCALATION_${activeAlert.type}`,
            message: `[ESCALATION ${activeAlert.escalationCount}] ${activeAlert.message}`,
            severity: 'critical',
            originalAlert: alertId
          };

          // Send to escalation channels
          for (const channelName of rule.escalateTo) {
            const channel = this.channels.get(channelName);
            if (channel && channel.enabled) {
              await this.sendToChannel(channelName, channel, escalationAlert);
            }
          }

          logger.getLogger().warn(`Alert escalated: ${alertId}`, {
            rule: rule.name,
            escalationCount: activeAlert.escalationCount
          });
        }
      }
    }
  }

  /**
   * Send alert to all enabled channels
   */
  async sendAlert(alert) {
    // Check maintenance mode
    if (this.maintenanceMode) {
      logger.getLogger().info('Alert suppressed (maintenance mode)', {
        type: alert.type
      });
      this.stats.totalSuppressed++;
      return { sent: false, reason: 'maintenance_mode' };
    }

    // Check if alert type is suppressed
    if (this.suppressedAlerts.has(alert.type)) {
      this.stats.totalSuppressed++;
      return { sent: false, reason: 'suppressed' };
    }

    // Check for duplicates
    if (this.isDuplicate(alert)) {
      return { sent: false, reason: 'duplicate' };
    }

    // Rate limiting
    if (!this.checkRateLimit(alert.type)) {
      return { sent: false, reason: 'rate_limited' };
    }

    // Enrich alert with metadata
    const enrichedAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alert,
      timestamp: alert.timestamp || new Date().toISOString(),
      hostname: process.env.HOSTNAME || process.env.RAILWAY_SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '2.2.0',
      sentAt: new Date().toISOString()
    };

    // Add to history
    this.alertHistory.unshift(enrichedAlert);
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(0, this.MAX_HISTORY);
    }

    // Track as active alert (for escalations)
    if (enrichedAlert.severity === 'critical' || enrichedAlert.severity === 'warning') {
      this.activeAlerts.set(enrichedAlert.id, {
        ...enrichedAlert,
        createdAt: Date.now(),
        escalationCount: 0
      });
    }

    // Sort channels by priority
    const sortedChannels = Array.from(this.channels.entries())
      .filter(([, channel]) => channel.enabled && channel.severityFilter.includes(enrichedAlert.severity))
      .sort((a, b) => a[1].priority - b[1].priority);

    // Send to all matching channels in parallel
    const results = await Promise.allSettled(
      sortedChannels.map(([name, channel]) =>
        this.sendToChannelWithRetry(name, channel, enrichedAlert)
      )
    );

    // Update stats
    this.stats.totalSent++;
    this.stats.bySeverity[enrichedAlert.severity]++;

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

    return {
      sent: true,
      alertId: enrichedAlert.id,
      channelsSent: successCount,
      channelsTotal: sortedChannels.length
    };
  }

  /**
   * Send alert to a specific channel with retry logic
   */
  async sendToChannelWithRetry(name, channel, alert) {
    // Check circuit breaker
    if (channel.circuitOpen) {
      const timeSinceFailure = Date.now() - channel.lastFailure;
      if (timeSinceFailure < 60000) { // 1 minute circuit timeout
        logger.getLogger().debug(`Channel ${name} circuit open, skipping`);
        return false;
      }
      // Try to close circuit
      channel.circuitOpen = false;
      channel.failureCount = 0;
    }

    for (let attempt = 1; attempt <= channel.retries; attempt++) {
      try {
        await Promise.race([
          channel.send(alert),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), channel.timeout)
          )
        ]);

        channel.failureCount = 0;
        this.stats.byChannel[name].sent++;

        logger.getLogger().info(`Alert sent to ${name}`, {
          type: alert.type,
          severity: alert.severity,
          attempt
        });

        return true;
      } catch (error) {
        channel.failureCount++;
        channel.lastFailure = Date.now();

        if (attempt < channel.retries) {
          logger.getLogger().warn(`Alert channel ${name} failed, retrying`, {
            attempt,
            maxRetries: channel.retries,
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, channel.retryDelay * attempt));
        } else {
          // Open circuit after max retries
          if (channel.failureCount >= 3) {
            channel.circuitOpen = true;
            logger.getLogger().error(`Alert channel ${name} circuit opened after ${channel.failureCount} failures`);
          }

          this.stats.byChannel[name].failed++;
          logger.logError(error, {
            context: 'alert_channel_failed',
            channel: name,
            alertType: alert.type
          });
        }
      }
    }

    return false;
  }

  /**
   * Resolve/acknowledge an active alert
   */
  resolveAlert(alertId, resolution = {}) {
    const alert = this.activeAlerts.get(alertId);

    if (alert) {
      const resolvedAlert = {
        ...alert,
        resolvedAt: new Date().toISOString(),
        resolution: resolution.message || 'Resolved',
        resolvedBy: resolution.resolvedBy || 'system',
        duration: Date.now() - alert.createdAt
      };

      this.resolvedAlerts.unshift(resolvedAlert);
      if (this.resolvedAlerts.length > this.MAX_RESOLVED) {
        this.resolvedAlerts = this.resolvedAlerts.slice(0, this.MAX_RESOLVED);
      }

      this.activeAlerts.delete(alertId);

      logger.getLogger().info(`Alert resolved: ${alertId}`, {
        duration: resolvedAlert.duration,
        resolution: resolution.message
      });

      // Send recovery notification
      if (alert.severity === 'critical') {
        this.sendAlert({
          type: `RECOVERED_${alert.type}`,
          severity: 'info',
          message: `✅ Issue resolved: ${alert.message}`,
          originalAlertId: alertId,
          duration: resolvedAlert.duration
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Resolve all alerts matching a type
   */
  resolveAlertsByType(alertType, resolution = {}) {
    let resolved = 0;

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.type === alertType) {
        this.resolveAlert(alertId, resolution);
        resolved++;
      }
    }

    return resolved;
  }

  /**
   * Get alert history with filtering
   */
  getAlertHistory(options = {}) {
    let alerts = [...this.alertHistory];

    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }

    if (options.type) {
      alerts = alerts.filter(a => a.type.includes(options.type));
    }

    if (options.since) {
      const sinceDate = new Date(options.since);
      alerts = alerts.filter(a => new Date(a.sentAt) >= sinceDate);
    }

    const limit = options.limit || 50;
    return alerts.slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get resolved alerts
   */
  getResolvedAlerts(limit = 50) {
    return this.resolvedAlerts.slice(0, limit);
  }

  /**
   * Get alerting statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeAlerts: this.activeAlerts.size,
      channels: Array.from(this.channels.entries()).map(([name, channel]) => ({
        name,
        enabled: channel.enabled,
        circuitOpen: channel.circuitOpen,
        failureCount: channel.failureCount,
        stats: this.stats.byChannel[name]
      })),
      maintenanceMode: this.maintenanceMode,
      suppressedTypes: Array.from(this.suppressedAlerts)
    };
  }

  /**
   * Clear alert history
   */
  clearHistory() {
    this.alertHistory = [];
    logger.getLogger().info('Alert history cleared');
  }

  /**
   * Enable/disable a channel
   */
  setChannelEnabled(name, enabled) {
    const channel = this.channels.get(name);
    if (channel) {
      channel.enabled = enabled;
      if (enabled) {
        channel.circuitOpen = false;
        channel.failureCount = 0;
      }
      logger.getLogger().info(`Alert channel ${name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Suppress/unsuppress alert type
   */
  suppressAlertType(type, suppress = true) {
    if (suppress) {
      this.suppressedAlerts.add(type);
      logger.getLogger().info(`Alert type suppressed: ${type}`);
    } else {
      this.suppressedAlerts.delete(type);
      logger.getLogger().info(`Alert type unsuppressed: ${type}`);
    }
  }

  /**
   * Enable/disable maintenance mode
   */
  setMaintenanceMode(enabled) {
    this.maintenanceMode = enabled;
    logger.getLogger().info(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);

    if (!enabled) {
      // Send "maintenance ended" notification
      this.sendAlert({
        type: 'MAINTENANCE_ENDED',
        severity: 'info',
        message: 'Maintenance mode ended, normal alerting resumed'
      });
    }
  }

  /**
   * Test all channels
   */
  async testChannels() {
    const results = {};

    for (const [name, channel] of this.channels) {
      try {
        const testAlert = {
          type: 'CHANNEL_TEST',
          severity: 'info',
          message: `Test alert for channel: ${name}`,
          timestamp: new Date().toISOString(),
          test: true
        };

        await Promise.race([
          channel.send(testAlert),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), channel.timeout)
          )
        ]);

        results[name] = { success: true };
      } catch (error) {
        results[name] = { success: false, error: error.message };
      }
    }

    return results;
  }
}

// Create singleton instance
const alertingService = new AlertingService();

/**
 * Configure default alert channels
 */
function configureDefaultChannels() {
  // Console logging (always enabled, highest priority)
  alertingService.registerChannel('console', async (alert) => {
    const emoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    }[alert.severity] || '📢';

    const separator = '═'.repeat(60);
    console.error(`\n${separator}`);
    console.error(`${emoji} [ALERT] ${alert.type.toUpperCase()}`);
    console.error(`Severity: ${alert.severity.toUpperCase()}`);
    console.error(`Time: ${alert.timestamp}`);
    console.error(`Message: ${alert.message || 'No message'}`);
    if (alert.error) console.error(`Error: ${alert.error}`);
    if (alert.checkName) console.error(`Check: ${alert.checkName}`);
    console.error(separator + '\n');
  }, {
    enabled: true,
    priority: 1,
    retries: 1
  });

  // Webhook alerts (if configured)
  if (process.env.ALERT_WEBHOOK_URL) {
    alertingService.registerChannel('webhook', async (alert) => {
      await axios.post(
        process.env.ALERT_WEBHOOK_URL,
        {
          text: `${alert.severity === 'critical' ? '🚨' : '⚠️'} Backend Alert: ${alert.type}`,
          alert: {
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            hostname: alert.hostname,
            environment: alert.environment
          },
          metadata: {
            version: alert.version,
            sentAt: alert.sentAt
          }
        },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-Alert-Severity': alert.severity,
            'X-Alert-Type': alert.type
          }
        }
      );
    }, {
      enabled: true,
      severityFilter: ['critical', 'warning'],
      priority: 5,
      retries: 3,
      retryDelay: 2000
    });
  }

  // Slack alerts (if configured)
  if (process.env.SLACK_WEBHOOK_URL) {
    alertingService.registerChannel('slack', async (alert) => {
      const emoji = {
        critical: ':rotating_light:',
        warning: ':warning:',
        info: ':information_source:'
      }[alert.severity] || ':mega:';

      const color = {
        critical: '#FF0000',
        warning: '#FFA500',
        info: '#36A64F'
      }[alert.severity] || '#808080';

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${alert.type.toUpperCase()}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${alert.severity.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Environment:*\n${alert.environment}` },
            { type: 'mrkdwn', text: `*Host:*\n${alert.hostname}` },
            { type: 'mrkdwn', text: `*Time:*\n${alert.timestamp}` }
          ]
        }
      ];

      if (alert.message) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Message:*\n${alert.message}` }
        });
      }

      if (alert.error) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${alert.error}\`\`\`` }
        });
      }

      await axios.post(
        process.env.SLACK_WEBHOOK_URL,
        {
          blocks,
          attachments: [{
            color,
            footer: `Zodiac Backend v${alert.version}`,
            ts: Math.floor(Date.now() / 1000)
          }]
        },
        { timeout: 5000 }
      );
    }, {
      enabled: true,
      severityFilter: ['critical', 'warning'],
      priority: 3,
      retries: 3,
      retryDelay: 1000
    });
  }

  // Discord alerts (if configured)
  if (process.env.DISCORD_WEBHOOK_URL) {
    alertingService.registerChannel('discord', async (alert) => {
      const color = {
        critical: 0xFF0000,
        warning: 0xFFA500,
        info: 0x36A64F
      }[alert.severity] || 0x808080;

      const emoji = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️'
      }[alert.severity] || '📢';

      await axios.post(
        process.env.DISCORD_WEBHOOK_URL,
        {
          content: alert.severity === 'critical' ? '@here' : null,
          embeds: [{
            title: `${emoji} ${alert.type.toUpperCase()}`,
            description: alert.message || 'No message',
            color,
            fields: [
              { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
              { name: 'Environment', value: alert.environment, inline: true },
              { name: 'Host', value: alert.hostname, inline: true },
              ...(alert.error ? [{ name: 'Error', value: `\`\`\`${alert.error.substring(0, 1000)}\`\`\`` }] : [])
            ],
            timestamp: alert.timestamp,
            footer: { text: `Zodiac Backend v${alert.version}` }
          }]
        },
        { timeout: 5000 }
      );
    }, {
      enabled: true,
      severityFilter: ['critical', 'warning'],
      priority: 4,
      retries: 3,
      retryDelay: 1000
    });
  }

  // Telegram alerts (if configured)
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    alertingService.registerChannel('telegram', async (alert) => {
      const emoji = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️'
      }[alert.severity] || '📢';

      const message = [
        `${emoji} <b>${alert.type.toUpperCase()}</b>`,
        '',
        `<b>Severity:</b> ${alert.severity.toUpperCase()}`,
        `<b>Environment:</b> ${alert.environment}`,
        `<b>Time:</b> ${alert.timestamp}`,
        '',
        `<b>Message:</b> ${alert.message || 'No message'}`,
        ...(alert.error ? [`\n<b>Error:</b>\n<code>${alert.error.substring(0, 500)}</code>`] : [])
      ].join('\n');

      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_notification: alert.severity === 'info'
        },
        { timeout: 5000 }
      );
    }, {
      enabled: true,
      severityFilter: ['critical', 'warning'],
      priority: 2,
      retries: 3,
      retryDelay: 1000
    });
  }

  // Email alerts via SendGrid (if configured)
  if (process.env.SENDGRID_API_KEY && process.env.ALERT_EMAIL) {
    alertingService.registerChannel('email', async (alert) => {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const severityColor = {
        critical: '#FF0000',
        warning: '#FFA500',
        info: '#36A64F'
      }[alert.severity] || '#808080';

      await sgMail.send({
        to: process.env.ALERT_EMAIL.split(','), // Support multiple recipients
        from: process.env.SENDGRID_FROM_EMAIL || 'alerts@zodiacapp.com',
        subject: `[${alert.severity.toUpperCase()}] ${alert.type} - Zodiac Backend`,
        text: `
Alert ID: ${alert.id}
Type: ${alert.type}
Severity: ${alert.severity}
Timestamp: ${alert.timestamp}
Environment: ${alert.environment}
Host: ${alert.hostname}
Version: ${alert.version}

Message: ${alert.message || 'No message'}

${alert.error ? `Error: ${alert.error}` : ''}

---
This is an automated alert from Zodiac Backend.
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .alert-box { border-left: 4px solid ${severityColor}; padding: 15px; margin: 20px 0; background: #f9f9f9; }
    .severity { display: inline-block; padding: 3px 10px; border-radius: 3px; color: white; background: ${severityColor}; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .label { font-weight: bold; width: 120px; color: #666; }
    .error-box { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; font-family: monospace; white-space: pre-wrap; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h2>🚨 Zodiac Backend Alert</h2>

  <div class="alert-box">
    <h3 style="margin-top: 0;">${alert.type}</h3>
    <span class="severity">${alert.severity.toUpperCase()}</span>
  </div>

  <table>
    <tr><td class="label">Alert ID:</td><td>${alert.id}</td></tr>
    <tr><td class="label">Environment:</td><td>${alert.environment}</td></tr>
    <tr><td class="label">Host:</td><td>${alert.hostname}</td></tr>
    <tr><td class="label">Timestamp:</td><td>${alert.timestamp}</td></tr>
    <tr><td class="label">Version:</td><td>${alert.version}</td></tr>
  </table>

  <h3>Message</h3>
  <p>${alert.message || 'No message provided'}</p>

  ${alert.error ? `
  <h3>Error Details</h3>
  <div class="error-box">${alert.error}</div>
  ` : ''}

  <div class="footer">
    <p>This is an automated alert from Zodiac Backend Monitoring System.</p>
    <p>Alert ID: ${alert.id}</p>
  </div>
</body>
</html>
        `
      });
    }, {
      enabled: true,
      severityFilter: ['critical'], // Only critical alerts via email
      priority: 10, // Lowest priority (slowest channel)
      retries: 2,
      retryDelay: 3000
    });
  }

  // Add default escalation rule
  alertingService.addEscalationRule({
    name: 'critical_unresolved',
    condition: (alert) => alert.severity === 'critical',
    escalateTo: ['email', 'telegram', 'slack'],
    afterMinutes: 15,
    maxEscalations: 3
  });

  logger.getLogger().info('Alert channels configured', {
    channels: Array.from(alertingService.channels.keys()),
    escalationRules: alertingService.escalationRules.length
  });
}

// Start escalation processor
let escalationInterval = null;

function startEscalationProcessor(intervalMs = 60000) {
  if (escalationInterval) {
    clearInterval(escalationInterval);
  }

  escalationInterval = setInterval(() => {
    alertingService.processEscalations().catch(error => {
      logger.logError(error, { context: 'escalation_processor' });
    });
  }, intervalMs);

  logger.getLogger().info('Escalation processor started', { interval: intervalMs });
}

function stopEscalationProcessor() {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
    logger.getLogger().info('Escalation processor stopped');
  }
}

// Helper functions for common alert types
const alertHelpers = {
  critical: (type, message, extra = {}) => alertingService.sendAlert({
    type,
    severity: 'critical',
    message,
    ...extra
  }),

  warning: (type, message, extra = {}) => alertingService.sendAlert({
    type,
    severity: 'warning',
    message,
    ...extra
  }),

  info: (type, message, extra = {}) => alertingService.sendAlert({
    type,
    severity: 'info',
    message,
    ...extra
  }),

  healthCheckFailed: (checkName, error) => alertingService.sendAlert({
    type: 'HEALTH_CHECK_FAILED',
    severity: 'critical',
    message: `Health check '${checkName}' failed`,
    checkName,
    error: error?.message || error
  }),

  databaseError: (error, context = {}) => alertingService.sendAlert({
    type: 'DATABASE_ERROR',
    severity: 'critical',
    message: 'Database connection error',
    error: error?.message || error,
    ...context
  }),

  highMemoryUsage: (percentage, details = {}) => alertingService.sendAlert({
    type: 'HIGH_MEMORY_USAGE',
    severity: percentage > 90 ? 'critical' : 'warning',
    message: `Memory usage at ${percentage}%`,
    ...details
  }),

  serviceRecovered: (serviceName) => alertingService.sendAlert({
    type: `${serviceName.toUpperCase()}_RECOVERED`,
    severity: 'info',
    message: `✅ ${serviceName} has recovered and is operational`
  })
};

module.exports = {
  alertingService,
  configureDefaultChannels,
  startEscalationProcessor,
  stopEscalationProcessor,
  alertHelpers
};
