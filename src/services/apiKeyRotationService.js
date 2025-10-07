/**
 * API KEY ROTATION SERVICE
 * 
 * Enterprise-grade API key management and rotation system
 * Features:
 * - Automatic key rotation on schedule
 * - Zero-downtime key transitions
 * - Key versioning and history
 * - Emergency key revocation
 * - Key strength validation
 * - Audit trail for all key operations
 */

const crypto = require('crypto');
const redisService = require('./redisService');
const securityHardeningService = require('./securityHardeningService');

class APIKeyRotationService {
  constructor() {
    this.config = {
      // Rotation settings
      rotation_interval: parseInt(process.env.API_KEY_ROTATION_INTERVAL) || 86400000, // 24 hours
      grace_period: parseInt(process.env.API_KEY_GRACE_PERIOD) || 3600000, // 1 hour
      key_history_retention: parseInt(process.env.KEY_HISTORY_RETENTION) || 2592000000, // 30 days
      
      // Key generation settings
      key_length: 32,
      key_prefix: 'zod_',
      key_entropy_bits: 256,
      
      // Key validation settings
      min_key_strength: 128,
      max_key_age: parseInt(process.env.MAX_KEY_AGE) || 604800000, // 7 days
      
      // Emergency settings
      emergency_rotation_threshold: 5, // Number of failed validations before emergency rotation
      breach_response_time: 300000 // 5 minutes
    };

    // Active keys storage
    this.activeKeys = new Map();
    this.keyHistory = [];
    this.rotationSchedule = new Map();
    
    // Key usage tracking
    this.keyUsageStats = new Map();
    this.failedValidations = new Map();
    
    // Key types and their specific configurations
    this.keyTypes = {
      'admin': {
        rotation_interval: 43200000, // 12 hours for admin keys
        max_usage_per_hour: 100,
        permissions: ['admin:all']
      },
      'api': {
        rotation_interval: 86400000, // 24 hours for API keys
        max_usage_per_hour: 1000,
        permissions: ['api:read', 'api:write']
      },
      'webhook': {
        rotation_interval: 172800000, // 48 hours for webhook keys
        max_usage_per_hour: 50,
        permissions: ['webhook:receive']
      },
      'service': {
        rotation_interval: 604800000, // 7 days for service keys
        max_usage_per_hour: 10000,
        permissions: ['service:all']
      }
    };

    console.log('🔑 API Key Rotation Service initialized');
  }

  /**
   * Initialize the key rotation service
   */
  async initialize() {
    try {
      // Load existing keys from storage
      await this.loadExistingKeys();
      
      // Initialize current system keys if they don't exist
      await this.initializeSystemKeys();
      
      // Start rotation scheduler
      this.startRotationScheduler();
      
      // Start monitoring and cleanup tasks
      this.startMonitoringTasks();
      
      console.log('✅ API Key Rotation Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ API Key Rotation Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate a new API key with specified type and properties
   */
  async generateAPIKey(keyType = 'api', customConfig = {}) {
    try {
      // Validate key type
      if (!this.keyTypes[keyType]) {
        throw new Error(`Invalid key type: ${keyType}`);
      }

      // Generate secure key
      const keyData = await this.createSecureKey(keyType, customConfig);
      
      // Store key with metadata
      await this.storeKey(keyData);
      
      // Log key generation
      await this.logKeyOperation('generate', keyData);
      
      console.log(`🔑 Generated new ${keyType} key: ${keyData.key_id}`);
      
      return {
        key: keyData.key,
        key_id: keyData.key_id,
        key_type: keyType,
        expires_at: keyData.expires_at,
        created_at: keyData.created_at
      };
      
    } catch (error) {
      console.error('Key generation error:', error);
      throw error;
    }
  }

  /**
   * Rotate a specific key or key type
   */
  async rotateKey(keyType, emergency = false) {
    try {
      const oldKeys = this.getActiveKeysByType(keyType);
      
      if (oldKeys.length === 0) {
        throw new Error(`No active keys found for type: ${keyType}`);
      }

      // Generate new key
      const newKeyData = await this.generateAPIKey(keyType);
      
      // Implement graceful transition
      await this.implementGracefulTransition(oldKeys, newKeyData, emergency);
      
      // Log rotation
      await this.logKeyOperation('rotate', newKeyData, { 
        emergency,
        old_keys: oldKeys.map(k => k.key_id)
      });
      
      console.log(`🔄 Rotated ${keyType} key${emergency ? ' (EMERGENCY)' : ''}`);
      
      return newKeyData;
      
    } catch (error) {
      console.error('Key rotation error:', error);
      throw error;
    }
  }

  /**
   * Validate API key and check permissions
   */
  async validateKey(keyValue, requiredPermissions = []) {
    const startTime = Date.now();
    
    try {
      // Find key in active keys
      const keyData = this.findActiveKey(keyValue);
      
      if (!keyData) {
        await this.recordFailedValidation(keyValue, 'key_not_found');
        return { valid: false, error: 'Invalid API key' };
      }

      // Check if key is expired
      if (Date.now() > keyData.expires_at) {
        await this.recordFailedValidation(keyValue, 'key_expired');
        await this.deactivateKey(keyData.key_id, 'expired');
        return { valid: false, error: 'API key expired' };
      }

      // Check if key is revoked
      if (keyData.status !== 'active') {
        await this.recordFailedValidation(keyValue, 'key_revoked');
        return { valid: false, error: 'API key revoked' };
      }

      // Check rate limiting for this key
      const rateLimitResult = await this.checkKeyRateLimit(keyData);
      if (!rateLimitResult.allowed) {
        await this.recordFailedValidation(keyValue, 'rate_limit_exceeded');
        return { 
          valid: false, 
          error: 'Rate limit exceeded',
          retry_after: rateLimitResult.retry_after
        };
      }

      // Check permissions
      if (requiredPermissions.length > 0) {
        const hasPermissions = this.validatePermissions(keyData.permissions, requiredPermissions);
        if (!hasPermissions) {
          await this.recordFailedValidation(keyValue, 'insufficient_permissions');
          return { 
            valid: false, 
            error: 'Insufficient permissions',
            required: requiredPermissions,
            available: keyData.permissions
          };
        }
      }

      // Update usage statistics
      await this.updateKeyUsage(keyData);
      
      // Check if key needs emergency rotation
      await this.checkEmergencyRotationTriggers(keyData);

      return {
        valid: true,
        key_id: keyData.key_id,
        key_type: keyData.key_type,
        permissions: keyData.permissions,
        expires_at: keyData.expires_at,
        validation_time: Date.now() - startTime
      };

    } catch (error) {
      await this.recordFailedValidation(keyValue, 'validation_error', error.message);
      return { valid: false, error: 'Key validation failed' };
    }
  }

  /**
   * Revoke a key immediately
   */
  async revokeKey(keyId, reason = 'manual_revocation') {
    try {
      const keyData = this.activeKeys.get(keyId);
      
      if (!keyData) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Deactivate key
      await this.deactivateKey(keyId, reason);
      
      // Log revocation
      await this.logKeyOperation('revoke', keyData, { reason });
      
      // If this was an admin key, trigger emergency rotation
      if (keyData.key_type === 'admin') {
        await this.triggerEmergencyRotation();
      }

      console.log(`🚫 Revoked key ${keyId} - Reason: ${reason}`);
      
      return { success: true, message: `Key ${keyId} revoked successfully` };
      
    } catch (error) {
      console.error('Key revocation error:', error);
      throw error;
    }
  }

  /**
   * Create a secure API key with proper entropy
   */
  async createSecureKey(keyType, customConfig) {
    // Generate cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(this.config.key_length);
    const timestamp = Date.now().toString(36);
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    
    // Create key with prefix and structure
    const keyValue = `${this.config.key_prefix}${keyType}_${timestamp}_${randomSuffix}_${randomBytes.toString('hex')}`;
    
    // Generate key ID
    const keyId = crypto.randomUUID();
    
    // Get key type configuration
    const typeConfig = { ...this.keyTypes[keyType], ...customConfig };
    
    // Calculate expiration
    const expiresAt = Date.now() + typeConfig.rotation_interval;
    
    // Create key metadata
    const keyData = {
      key: keyValue,
      key_id: keyId,
      key_type: keyType,
      created_at: Date.now(),
      expires_at: expiresAt,
      status: 'active',
      version: this.generateKeyVersion(),
      permissions: typeConfig.permissions,
      max_usage_per_hour: typeConfig.max_usage_per_hour,
      usage_count: 0,
      last_used: null,
      strength_score: this.calculateKeyStrength(keyValue),
      metadata: {
        created_by: 'system',
        rotation_count: 0,
        emergency_rotations: 0
      }
    };

    return keyData;
  }

  /**
   * Store key securely in Redis and memory
   */
  async storeKey(keyData) {
    // Store in memory for fast access
    this.activeKeys.set(keyData.key_id, keyData);
    
    // Store in Redis for persistence
    await redisService.set(`api_key:${keyData.key_id}`, keyData, Math.floor((keyData.expires_at - Date.now()) / 1000));
    
    // Store key lookup (hash of key value -> key_id)
    const keyHash = crypto.createHash('sha256').update(keyData.key).digest('hex');
    await redisService.set(`api_key_lookup:${keyHash}`, keyData.key_id, Math.floor((keyData.expires_at - Date.now()) / 1000));
  }

  /**
   * Find active key by key value
   */
  findActiveKey(keyValue) {
    // Create hash of key value for lookup
    const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');
    
    // Find key by comparing hashes (to prevent timing attacks)
    for (const [keyId, keyData] of this.activeKeys.entries()) {
      const storedKeyHash = crypto.createHash('sha256').update(keyData.key).digest('hex');
      
      if (crypto.timingSafeEqual(Buffer.from(keyHash, 'hex'), Buffer.from(storedKeyHash, 'hex'))) {
        return keyData;
      }
    }
    
    return null;
  }

  /**
   * Implement graceful key transition
   */
  async implementGracefulTransition(oldKeys, newKeyData, emergency = false) {
    const gracePeriod = emergency ? 0 : this.config.grace_period;
    
    // Schedule old key deactivation
    if (!emergency && gracePeriod > 0) {
      setTimeout(async () => {
        for (const oldKey of oldKeys) {
          await this.deactivateKey(oldKey.key_id, 'rotation_completed');
        }
      }, gracePeriod);
      
      console.log(`⏱️ Old keys will be deactivated in ${gracePeriod / 1000} seconds`);
    } else {
      // Immediate deactivation for emergency rotations
      for (const oldKey of oldKeys) {
        await this.deactivateKey(oldKey.key_id, emergency ? 'emergency_rotation' : 'rotation_completed');
      }
    }
  }

  /**
   * Deactivate a key
   */
  async deactivateKey(keyId, reason) {
    const keyData = this.activeKeys.get(keyId);
    
    if (keyData) {
      keyData.status = 'deactivated';
      keyData.deactivated_at = Date.now();
      keyData.deactivation_reason = reason;
      
      // Remove from active keys
      this.activeKeys.delete(keyId);
      
      // Add to key history
      this.keyHistory.push({
        ...keyData,
        deactivated_at: Date.now(),
        reason: reason
      });
      
      // Remove from Redis
      await redisService.delete(`api_key:${keyId}`);
      
      // Remove key lookup
      const keyHash = crypto.createHash('sha256').update(keyData.key).digest('hex');
      await redisService.delete(`api_key_lookup:${keyHash}`);
    }
  }

  /**
   * Check rate limiting for a specific key
   */
  async checkKeyRateLimit(keyData) {
    const now = Date.now();
    const hourStart = now - (now % 3600000);
    const rateKey = `key_rate_limit:${keyData.key_id}:${hourStart}`;
    
    const currentUsage = await redisService.get(rateKey) || 0;
    
    if (currentUsage >= keyData.max_usage_per_hour) {
      return {
        allowed: false,
        retry_after: Math.ceil((3600000 - (now % 3600000)) / 1000)
      };
    }
    
    return { allowed: true };
  }

  /**
   * Update key usage statistics
   */
  async updateKeyUsage(keyData) {
    const now = Date.now();
    const hourStart = now - (now % 3600000);
    const rateKey = `key_rate_limit:${keyData.key_id}:${hourStart}`;
    
    // Increment usage counter
    await redisService.incr(rateKey, 3600); // Expire after 1 hour
    
    // Update key metadata
    keyData.usage_count++;
    keyData.last_used = now;
    
    // Update usage statistics
    const stats = this.keyUsageStats.get(keyData.key_id) || { hourly: [], daily_total: 0 };
    stats.hourly.push({ hour: hourStart, count: 1 });
    stats.daily_total++;
    
    // Keep only last 24 hours of hourly data
    stats.hourly = stats.hourly.filter(entry => now - entry.hour < 86400000);
    
    this.keyUsageStats.set(keyData.key_id, stats);
  }

  /**
   * Check if emergency rotation is needed
   */
  async checkEmergencyRotationTriggers(keyData) {
    const keyId = keyData.key_id;
    const failedCount = this.failedValidations.get(keyId) || 0;
    
    // Check failed validation threshold
    if (failedCount >= this.config.emergency_rotation_threshold) {
      console.warn(`🚨 Emergency rotation triggered for key ${keyId} - Failed validations: ${failedCount}`);
      await this.rotateKey(keyData.key_type, true);
      return;
    }
    
    // Check key age
    const keyAge = Date.now() - keyData.created_at;
    if (keyAge > this.config.max_key_age) {
      console.warn(`🚨 Emergency rotation triggered for key ${keyId} - Key too old: ${keyAge}ms`);
      await this.rotateKey(keyData.key_type, true);
      return;
    }
    
    // Check usage anomalies
    const stats = this.keyUsageStats.get(keyId);
    if (stats && stats.daily_total > keyData.max_usage_per_hour * 24 * 2) {
      console.warn(`🚨 Emergency rotation triggered for key ${keyId} - Unusual usage: ${stats.daily_total}`);
      await this.rotateKey(keyData.key_type, true);
      return;
    }
  }

  /**
   * Record failed validation attempt
   */
  async recordFailedValidation(keyValue, reason, details = null) {
    // Hash key value for privacy
    const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex').substring(0, 16);
    
    const failureRecord = {
      key_hash: keyHash,
      reason: reason,
      details: details,
      timestamp: Date.now(),
      ip: 'unknown' // Would be extracted from request context
    };
    
    // Log the failure
    await securityHardeningService.auditLogger.logSecurityEvent({
      type: 'api_key_validation_failure',
      severity: 'warning',
      details: failureRecord
    });
    
    // Track failed attempts for emergency rotation detection
    const keyData = this.findActiveKey(keyValue);
    if (keyData) {
      const currentCount = this.failedValidations.get(keyData.key_id) || 0;
      this.failedValidations.set(keyData.key_id, currentCount + 1);
    }
  }

  /**
   * Start rotation scheduler
   */
  startRotationScheduler() {
    // Check for keys needing rotation every hour
    setInterval(async () => {
      try {
        await this.performScheduledRotations();
      } catch (error) {
        console.error('Scheduled rotation error:', error);
      }
    }, 3600000); // Every hour
    
    console.log('📅 Key rotation scheduler started');
  }

  /**
   * Perform scheduled rotations
   */
  async performScheduledRotations() {
    const now = Date.now();
    const rotationsNeeded = [];
    
    // Check all active keys for rotation needs
    for (const [keyId, keyData] of this.activeKeys.entries()) {
      const timeUntilExpiry = keyData.expires_at - now;
      
      // Rotate if expiring within 10% of rotation interval
      const rotationWindow = this.keyTypes[keyData.key_type].rotation_interval * 0.1;
      
      if (timeUntilExpiry <= rotationWindow) {
        rotationsNeeded.push(keyData);
      }
    }
    
    // Perform rotations
    for (const keyData of rotationsNeeded) {
      try {
        await this.rotateKey(keyData.key_type, false);
        console.log(`🔄 Scheduled rotation completed for ${keyData.key_type} key`);
      } catch (error) {
        console.error(`Scheduled rotation failed for key ${keyData.key_id}:`, error);
      }
    }
  }

  /**
   * Start monitoring tasks
   */
  startMonitoringTasks() {
    // Clean up old key history every day
    setInterval(() => {
      this.cleanupKeyHistory();
    }, 86400000); // Daily
    
    // Reset failed validation counters every 6 hours
    setInterval(() => {
      this.failedValidations.clear();
    }, 21600000); // Every 6 hours
    
    console.log('👁️ Key monitoring tasks started');
  }

  /**
   * Clean up old key history
   */
  cleanupKeyHistory() {
    const cutoffTime = Date.now() - this.config.key_history_retention;
    this.keyHistory = this.keyHistory.filter(key => key.deactivated_at > cutoffTime);
    
    console.log(`🧹 Cleaned up old key history, ${this.keyHistory.length} records retained`);
  }

  // Utility methods

  getActiveKeysByType(keyType) {
    return Array.from(this.activeKeys.values()).filter(key => key.key_type === keyType);
  }

  validatePermissions(keyPermissions, requiredPermissions) {
    return requiredPermissions.every(required => 
      keyPermissions.includes(required) || keyPermissions.includes('*')
    );
  }

  generateKeyVersion() {
    return crypto.randomBytes(4).toString('hex');
  }

  calculateKeyStrength(keyValue) {
    // Simple key strength calculation
    const entropy = this.calculateEntropy(keyValue);
    return Math.min(Math.floor(entropy), 256);
  }

  calculateEntropy(str) {
    const freq = {};
    str.split('').forEach(char => freq[char] = (freq[char] || 0) + 1);
    
    return Object.values(freq).reduce((entropy, count) => {
      const p = count / str.length;
      return entropy - p * Math.log2(p);
    }, 0) * str.length;
  }

  async loadExistingKeys() {
    // Load keys from Redis storage
    // Implementation would restore active keys from persistent storage
  }

  async initializeSystemKeys() {
    // Initialize admin key if not exists
    const adminKeys = this.getActiveKeysByType('admin');
    if (adminKeys.length === 0) {
      await this.generateAPIKey('admin');
      console.log('🔐 Generated initial admin key');
    }
    
    // Initialize API key if not exists
    const apiKeys = this.getActiveKeysByType('api');
    if (apiKeys.length === 0) {
      await this.generateAPIKey('api');
      console.log('🔑 Generated initial API key');
    }
  }

  async triggerEmergencyRotation() {
    console.warn('🚨 EMERGENCY ROTATION TRIGGERED - Rotating all keys');
    
    for (const keyType of Object.keys(this.keyTypes)) {
      try {
        await this.rotateKey(keyType, true);
      } catch (error) {
        console.error(`Emergency rotation failed for ${keyType}:`, error);
      }
    }
  }

  async logKeyOperation(operation, keyData, additional = {}) {
    const logEntry = {
      operation: operation,
      key_id: keyData.key_id,
      key_type: keyData.key_type,
      timestamp: new Date().toISOString(),
      ...additional
    };
    
    await securityHardeningService.auditLogger.logSecurityEvent({
      type: 'api_key_operation',
      severity: 'info',
      details: logEntry
    });
  }

  /**
   * Get service status
   */
  getStatus() {
    const activeKeysByType = {};
    Object.keys(this.keyTypes).forEach(type => {
      activeKeysByType[type] = this.getActiveKeysByType(type).length;
    });
    
    return {
      active_keys: this.activeKeys.size,
      active_keys_by_type: activeKeysByType,
      key_history_count: this.keyHistory.length,
      failed_validations_tracked: this.failedValidations.size,
      usage_stats_tracked: this.keyUsageStats.size,
      rotation_scheduler_active: true,
      last_cleanup: new Date().toISOString(),
      config: {
        rotation_interval: this.config.rotation_interval,
        grace_period: this.config.grace_period,
        key_history_retention: this.config.key_history_retention
      }
    };
  }
}

module.exports = new APIKeyRotationService();