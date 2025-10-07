#!/usr/bin/env node

/**
 * PRODUCTION DEPLOYMENT CHECKLIST VALIDATOR
 * 
 * Validates all production requirements before deployment
 * Ensures security, compliance, and operational readiness
 */

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

class ProductionDeploymentChecker {
  constructor() {
    this.checks = [];
    this.warnings = [];
    this.errors = [];
    this.critical = [];
    
    this.requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'ADMIN_KEY',
      'OPENAI_API_KEY',
      'MASTER_ENCRYPTION_KEY',
      'JWT_SECRET',
      'SESSION_SECRET'
    ];
    
    this.securityEnvVars = [
      'FORCE_HTTPS',
      'ALLOWED_ORIGINS',
      'ENABLE_SECURITY_HEADERS',
      'CSRF_SECRET'
    ];
    
    this.monitoringEnvVars = [
      'WEBHOOK_ALERT_URL',
      'ENABLE_MONITORING',
      'ALERT_EMAIL'
    ];
  }

  /**
   * Run all production readiness checks
   */
  async runChecks() {
    console.log('🚀 Running Production Deployment Checklist...\n');
    
    try {
      // Core system checks
      await this.checkEnvironmentConfiguration();
      await this.checkSecurityConfiguration();
      await this.checkDatabaseConfiguration();
      await this.checkExternalServices();
      await this.checkMonitoringAndAlerting();
      await this.checkBackupSystems();
      await this.checkComplianceSettings();
      await this.checkPerformanceSettings();
      await this.checkNetworkSecurity();
      await this.checkOperationalReadiness();
      
      // Generate report
      this.generateReport();
      
      // Determine if ready for production
      const isReady = this.critical.length === 0 && this.errors.length === 0;
      
      if (isReady) {
        console.log('\n🎉 ALL CHECKS PASSED - READY FOR PRODUCTION DEPLOYMENT! 🎉');
        process.exit(0);
      } else {
        console.log('\n❌ DEPLOYMENT BLOCKED - CRITICAL ISSUES FOUND');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Deployment checker failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check environment configuration
   */
  async checkEnvironmentConfiguration() {
    console.log('📋 Checking Environment Configuration...');
    
    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      this.critical.push('NODE_ENV must be set to "production"');
    } else {
      this.addCheck('✅ NODE_ENV correctly set to production');
    }
    
    // Check required environment variables
    for (const varName of this.requiredEnvVars) {
      if (!process.env[varName]) {
        this.critical.push(`Missing required environment variable: ${varName}`);
      } else {
        this.addCheck(`✅ ${varName} is configured`);
      }
    }
    
    // Validate secret strength
    await this.validateSecretStrength();
    
    console.log('');
  }

  /**
   * Check security configuration
   */
  async checkSecurityConfiguration() {
    console.log('🛡️ Checking Security Configuration...');
    
    // Check security environment variables
    for (const varName of this.securityEnvVars) {
      if (!process.env[varName]) {
        this.errors.push(`Missing security setting: ${varName}`);
      } else {
        this.addCheck(`✅ ${varName} is configured`);
      }
    }
    
    // Check CORS configuration
    if (process.env.ALLOWED_ORIGINS === '*') {
      this.critical.push('CORS wildcard origin (*) is not allowed in production');
    } else if (!process.env.ALLOWED_ORIGINS) {
      this.critical.push('ALLOWED_ORIGINS must be configured with specific domains');
    } else {
      this.addCheck('✅ CORS origins properly configured');
    }
    
    // Check HTTPS enforcement
    if (process.env.FORCE_HTTPS !== 'true') {
      this.critical.push('HTTPS enforcement must be enabled in production (FORCE_HTTPS=true)');
    } else {
      this.addCheck('✅ HTTPS enforcement enabled');
    }
    
    // Check admin key strength
    if (process.env.ADMIN_KEY && process.env.ADMIN_KEY.length < 32) {
      this.critical.push('ADMIN_KEY must be at least 32 characters long');
    }
    
    console.log('');
  }

  /**
   * Check database configuration
   */
  async checkDatabaseConfiguration() {
    console.log('🗄️ Checking Database Configuration...');
    
    if (!process.env.DATABASE_URL) {
      this.critical.push('DATABASE_URL is required');
      return;
    }
    
    try {
      // Parse database URL
      const dbUrl = new URL(process.env.DATABASE_URL);
      
      if (dbUrl.protocol !== 'postgresql:' && dbUrl.protocol !== 'postgres:') {
        this.errors.push('Database URL must be a PostgreSQL connection string');
      } else {
        this.addCheck('✅ PostgreSQL database URL format is valid');
      }
      
      // Check SSL requirement for production
      if (!dbUrl.searchParams.get('sslmode') && !dbUrl.search.includes('ssl=true')) {
        this.warnings.push('Database connection should use SSL in production');
      } else {
        this.addCheck('✅ Database SSL configuration detected');
      }
      
      // Check database connectivity (if possible)
      // This would require database connection logic
      this.addCheck('ℹ️ Database connectivity check skipped (requires connection)');
      
    } catch (error) {
      this.critical.push('DATABASE_URL format is invalid');
    }
    
    console.log('');
  }

  /**
   * Check external services
   */
  async checkExternalServices() {
    console.log('🌐 Checking External Services...');
    
    // Check OpenAI API
    if (!process.env.OPENAI_API_KEY) {
      this.critical.push('OPENAI_API_KEY is required for horoscope generation');
    } else if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      this.errors.push('OPENAI_API_KEY format appears invalid (should start with sk-)');
    } else {
      this.addCheck('✅ OpenAI API key format is valid');
      
      // Test OpenAI API connectivity
      try {
        await this.testOpenAIConnectivity();
      } catch (error) {
        this.errors.push(`OpenAI API test failed: ${error.message}`);
      }
    }
    
    // Check Redis configuration (if enabled)
    if (process.env.ENABLE_REDIS === 'true') {
      if (!process.env.REDIS_HOST) {
        this.errors.push('REDIS_HOST is required when Redis is enabled');
      } else {
        this.addCheck('✅ Redis configuration present');
      }
    }
    
    console.log('');
  }

  /**
   * Check monitoring and alerting
   */
  async checkMonitoringAndAlerting() {
    console.log('📊 Checking Monitoring and Alerting...');
    
    for (const varName of this.monitoringEnvVars) {
      if (!process.env[varName]) {
        this.warnings.push(`Monitoring setting not configured: ${varName}`);
      } else {
        this.addCheck(`✅ ${varName} is configured`);
      }
    }
    
    // Test webhook connectivity
    if (process.env.WEBHOOK_ALERT_URL) {
      try {
        await this.testWebhookConnectivity(process.env.WEBHOOK_ALERT_URL);
        this.addCheck('✅ Alert webhook connectivity verified');
      } catch (error) {
        this.warnings.push(`Alert webhook test failed: ${error.message}`);
      }
    }
    
    console.log('');
  }

  /**
   * Check backup systems
   */
  async checkBackupSystems() {
    console.log('💾 Checking Backup Systems...');
    
    if (process.env.ENABLE_AUTOMATED_BACKUPS !== 'true') {
      this.warnings.push('Automated backups are not enabled');
    } else {
      this.addCheck('✅ Automated backups enabled');
    }
    
    // Check backup storage configuration
    if (process.env.BACKUP_S3_BUCKET) {
      if (!process.env.BACKUP_S3_ACCESS_KEY || !process.env.BACKUP_S3_SECRET_KEY) {
        this.errors.push('S3 backup credentials incomplete');
      } else {
        this.addCheck('✅ S3 backup storage configured');
      }
    }
    
    // Check backup encryption
    if (!process.env.BACKUP_ENCRYPTION_KEY) {
      this.warnings.push('Backup encryption key not set');
    } else {
      this.addCheck('✅ Backup encryption configured');
    }
    
    console.log('');
  }

  /**
   * Check compliance settings
   */
  async checkComplianceSettings() {
    console.log('⚖️ Checking Compliance Settings...');
    
    // GDPR compliance
    if (process.env.GDPR_COMPLIANCE_ENABLED === 'true') {
      this.addCheck('✅ GDPR compliance enabled');
      
      if (!process.env.DATA_RETENTION_DAYS) {
        this.warnings.push('DATA_RETENTION_DAYS should be set for GDPR compliance');
      }
      
      if (!process.env.PRIVACY_POLICY_URL) {
        this.warnings.push('PRIVACY_POLICY_URL should be set for GDPR compliance');
      }
    }
    
    // CCPA compliance
    if (process.env.CCPA_COMPLIANCE_ENABLED === 'true') {
      this.addCheck('✅ CCPA compliance enabled');
    }
    
    // Legal URLs
    const legalUrls = ['PRIVACY_POLICY_URL', 'TERMS_OF_SERVICE_URL'];
    for (const urlVar of legalUrls) {
      if (!process.env[urlVar]) {
        this.warnings.push(`Legal URL not configured: ${urlVar}`);
      }
    }
    
    console.log('');
  }

  /**
   * Check performance settings
   */
  async checkPerformanceSettings() {
    console.log('⚡ Checking Performance Settings...');
    
    // Check rate limiting
    if (!process.env.GLOBAL_RATE_LIMIT) {
      this.warnings.push('Global rate limiting not configured');
    } else {
      this.addCheck('✅ Rate limiting configured');
    }
    
    // Check caching
    if (process.env.ENABLE_REDIS === 'true') {
      this.addCheck('✅ Redis caching enabled');
    } else {
      this.warnings.push('Redis caching not enabled - may impact performance');
    }
    
    // Check load balancing
    if (process.env.ENABLE_LOAD_BALANCER === 'true') {
      this.addCheck('✅ Load balancing enabled');
    }
    
    console.log('');
  }

  /**
   * Check network security
   */
  async checkNetworkSecurity() {
    console.log('🌐 Checking Network Security...');
    
    // Check trusted proxies
    if (!process.env.TRUSTED_PROXIES) {
      this.warnings.push('Trusted proxies not configured');
    } else {
      this.addCheck('✅ Trusted proxies configured');
    }
    
    // Check security headers
    if (process.env.ENABLE_SECURITY_HEADERS !== 'true') {
      this.errors.push('Security headers should be enabled in production');
    } else {
      this.addCheck('✅ Security headers enabled');
    }
    
    console.log('');
  }

  /**
   * Check operational readiness
   */
  async checkOperationalReadiness() {
    console.log('🔧 Checking Operational Readiness...');
    
    // Check logging configuration
    if (process.env.ENABLE_MONITORING !== 'true') {
      this.warnings.push('Application monitoring not enabled');
    } else {
      this.addCheck('✅ Application monitoring enabled');
    }
    
    // Check emergency configuration
    if (!process.env.EMERGENCY_CONTACT_EMAIL) {
      this.warnings.push('Emergency contact not configured');
    } else {
      this.addCheck('✅ Emergency contact configured');
    }
    
    // Check timezone
    if (!process.env.TZ) {
      this.warnings.push('Timezone not explicitly set');
    } else {
      this.addCheck(`✅ Timezone set to ${process.env.TZ}`);
    }
    
    console.log('');
  }

  /**
   * Validate secret strength
   */
  async validateSecretStrength() {
    const secrets = [
      'ADMIN_KEY',
      'MASTER_ENCRYPTION_KEY',
      'JWT_SECRET',
      'SESSION_SECRET'
    ];
    
    for (const secretName of secrets) {
      const secret = process.env[secretName];
      if (!secret) continue;
      
      if (secret.length < 32) {
        this.critical.push(`${secretName} must be at least 32 characters long`);
      }
      
      if (!/[a-zA-Z]/.test(secret) || !/[0-9]/.test(secret)) {
        this.warnings.push(`${secretName} should contain both letters and numbers`);
      }
      
      // Check for common weak patterns
      if (/^(password|secret|key|admin)/i.test(secret)) {
        this.errors.push(`${secretName} appears to use a weak pattern`);
      }
    }
  }

  /**
   * Test OpenAI API connectivity
   */
  async testOpenAIConnectivity() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'User-Agent': 'Zodiac-Production-Check/1.0'
        },
        timeout: 10000
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
  }

  /**
   * Test webhook connectivity
   */
  async testWebhookConnectivity(webhookUrl) {
    return new Promise((resolve, reject) => {
      const url = new URL(webhookUrl);
      
      const testPayload = JSON.stringify({
        text: 'Production deployment checklist test',
        timestamp: new Date().toISOString(),
        test: true
      });
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(testPayload),
          'User-Agent': 'Zodiac-Production-Check/1.0'
        },
        timeout: 10000
      };
      
      const req = (url.protocol === 'https:' ? https : require('http')).request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.write(testPayload);
      req.end();
    });
  }

  /**
   * Add a successful check
   */
  addCheck(message) {
    this.checks.push(message);
    console.log(message);
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 PRODUCTION DEPLOYMENT CHECKLIST REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n✅ Successful Checks: ${this.checks.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`🚨 Critical Issues: ${this.critical.length}`);
    
    if (this.critical.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES (MUST FIX BEFORE DEPLOYMENT):');
      this.critical.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (SHOULD FIX BEFORE DEPLOYMENT):');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (RECOMMENDED TO FIX):');
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    // Generate deployment summary
    const summary = {
      timestamp: new Date().toISOString(),
      ready_for_production: this.critical.length === 0 && this.errors.length === 0,
      total_checks: this.checks.length,
      warnings: this.warnings.length,
      errors: this.errors.length,
      critical_issues: this.critical.length,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '2.0.0'
    };
    
    // Write detailed report
    const reportFile = 'production-readiness-report.json';
    fs.writeFileSync(reportFile, JSON.stringify({
      summary,
      checks: this.checks,
      warnings: this.warnings,
      errors: this.errors,
      critical_issues: this.critical
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.critical.length === 0 && this.errors.length === 0) {
      console.log('   ✅ All critical checks passed - ready for production!');
      console.log('   📋 Review warnings and consider addressing them');
      console.log('   🔄 Run this checklist again after any configuration changes');
    } else {
      console.log('   🚫 Fix all critical issues and errors before deploying');
      console.log('   🔧 Review the production environment template');
      console.log('   ✅ Re-run this checklist after making changes');
    }
  }
}

// CLI execution
if (require.main === module) {
  const checker = new ProductionDeploymentChecker();
  checker.runChecks().catch(error => {
    console.error('💥 Deployment checker failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionDeploymentChecker;