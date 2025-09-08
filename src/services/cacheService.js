const redis = require('redis');
const logger = require('./loggingService');

/**
 * 🚀 REDIS CACHING SERVICE - PRODUCTION READY
 * Distributed caching with Redis for enhanced performance
 */
class CacheService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.defaultTTL = 3600; // 1 hour default TTL
    this.keyPrefix = 'zodiac:';
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    if (this.connected) {
      return;
    }

    try {
      // Check if Redis is configured
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
      
      if (!redisUrl && process.env.NODE_ENV === 'production') {
        logger.getLogger().warn('Redis not configured for production environment');
        this.initializeMockMode();
        return;
      }

      if (!redisUrl) {
        logger.getLogger().info('Redis not configured, using mock cache');
        this.initializeMockMode();
        return;
      }

      // Create Redis client
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.logError(new Error('Redis max reconnection attempts reached'));
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.getLogger().info('🔌 Redis client connecting...');
      });

      this.client.on('ready', () => {
        this.connected = true;
        logger.getLogger().info('✅ Redis client ready and connected');
      });

      this.client.on('error', (error) => {
        logger.logError(error, { service: 'redis', event: 'connection_error' });
        this.connected = false;
      });

      this.client.on('end', () => {
        logger.getLogger().warn('❌ Redis connection ended');
        this.connected = false;
      });

      this.client.on('reconnecting', () => {
        logger.getLogger().info('🔄 Redis client reconnecting...');
      });

      // Connect to Redis
      await this.client.connect();
      
    } catch (error) {
      logger.logError(error, { service: 'redis', event: 'initialization_failed' });
      this.initializeMockMode();
    }
  }

  /**
   * Initialize mock mode for development/fallback
   */
  initializeMockMode() {
    this.mockCache = new Map();
    this.connected = true;
    this.isMockMode = true;
    
    // Cleanup old mock cache entries periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.mockCache.entries()) {
        if (entry.expiry && entry.expiry < now) {
          this.mockCache.delete(key);
        }
      }
    }, 60000); // Clean up every minute

    logger.getLogger().info('🔧 Cache service running in mock mode');
  }

  /**
   * Generate cache key with prefix
   */
  key(keyName) {
    return `${this.keyPrefix}${keyName}`;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.connected) await this.initialize();

    try {
      const fullKey = this.key(key);
      
      if (this.isMockMode) {
        const entry = this.mockCache.get(fullKey);
        if (!entry) return null;
        
        if (entry.expiry && entry.expiry < Date.now()) {
          this.mockCache.delete(fullKey);
          return null;
        }
        
        logger.logPerformance('cache_hit', 1, { key, mode: 'mock' });
        return entry.value;
      }

      const value = await this.client.get(fullKey);
      if (value) {
        logger.logPerformance('cache_hit', 1, { key, mode: 'redis' });
        return JSON.parse(value);
      }
      
      logger.logPerformance('cache_miss', 1, { key });
      return null;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'get', key });
      return null; // Return null on cache errors to prevent app crashes
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.connected) await this.initialize();

    try {
      const fullKey = this.key(key);
      
      if (this.isMockMode) {
        const expiry = ttl > 0 ? Date.now() + (ttl * 1000) : null;
        this.mockCache.set(fullKey, { value, expiry });
        logger.logPerformance('cache_set', 1, { key, ttl, mode: 'mock' });
        return true;
      }

      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.client.setEx(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }
      
      logger.logPerformance('cache_set', 1, { key, ttl, mode: 'redis' });
      return true;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'set', key, ttl });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key) {
    if (!this.connected) await this.initialize();

    try {
      const fullKey = this.key(key);
      
      if (this.isMockMode) {
        const deleted = this.mockCache.delete(fullKey);
        logger.logPerformance('cache_delete', 1, { key, deleted, mode: 'mock' });
        return deleted;
      }

      const result = await this.client.del(fullKey);
      logger.logPerformance('cache_delete', 1, { key, deleted: result > 0, mode: 'redis' });
      return result > 0;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'delete', key });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.connected) await this.initialize();

    try {
      const fullKey = this.key(key);
      
      if (this.isMockMode) {
        const entry = this.mockCache.get(fullKey);
        if (!entry) return false;
        
        if (entry.expiry && entry.expiry < Date.now()) {
          this.mockCache.delete(fullKey);
          return false;
        }
        
        return true;
      }

      const result = await this.client.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'exists', key });
      return false;
    }
  }

  /**
   * Set expiry for existing key
   */
  async expire(key, ttl) {
    if (!this.connected) await this.initialize();

    try {
      const fullKey = this.key(key);
      
      if (this.isMockMode) {
        const entry = this.mockCache.get(fullKey);
        if (entry) {
          entry.expiry = Date.now() + (ttl * 1000);
          return true;
        }
        return false;
      }

      const result = await this.client.expire(fullKey, ttl);
      return result > 0;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'expire', key, ttl });
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key, amount = 1, ttl = this.defaultTTL) {
    if (!this.connected) await this.initialize();

    try {
      const fullKey = this.key(key);
      
      if (this.isMockMode) {
        let entry = this.mockCache.get(fullKey);
        if (!entry) {
          const expiry = ttl > 0 ? Date.now() + (ttl * 1000) : null;
          entry = { value: 0, expiry };
          this.mockCache.set(fullKey, entry);
        }
        entry.value += amount;
        return entry.value;
      }

      const result = await this.client.incrBy(fullKey, amount);
      if (ttl > 0) {
        await this.client.expire(fullKey, ttl);
      }
      return result;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'increment', key, amount });
      return null;
    }
  }

  /**
   * Clear all cache keys with prefix
   */
  async clear() {
    if (!this.connected) await this.initialize();

    try {
      if (this.isMockMode) {
        let deletedCount = 0;
        for (const key of this.mockCache.keys()) {
          if (key.startsWith(this.keyPrefix)) {
            this.mockCache.delete(key);
            deletedCount++;
          }
        }
        logger.getLogger().info(`Cleared ${deletedCount} cache entries (mock mode)`);
        return deletedCount;
      }

      const keys = await this.client.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        logger.getLogger().info(`Cleared ${result} cache entries`);
        return result;
      }
      return 0;
    } catch (error) {
      logger.logError(error, { service: 'cache', operation: 'clear' });
      return 0;
    }
  }

  /**
   * Cache horoscope data
   */
  async cacheHoroscope(sign, type, data, ttl = 3600) {
    const key = `horoscope:${type}:${sign}:${new Date().toISOString().split('T')[0]}`;
    return this.set(key, data, ttl);
  }

  /**
   * Get cached horoscope
   */
  async getCachedHoroscope(sign, type) {
    const key = `horoscope:${type}:${sign}:${new Date().toISOString().split('T')[0]}`;
    return this.get(key);
  }

  /**
   * Cache API rate limit data
   */
  async cacheRateLimit(ip, endpoint, ttl = 3600) {
    const key = `ratelimit:${ip}:${endpoint.replace(/\//g, ':')}`;
    return this.increment(key, 1, ttl);
  }

  /**
   * Get rate limit count
   */
  async getRateLimit(ip, endpoint) {
    const key = `ratelimit:${ip}:${endpoint.replace(/\//g, ':')}`;
    const count = await this.get(key);
    return count || 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (this.isMockMode) {
      return {
        connected: this.connected,
        mode: 'mock',
        keys: this.mockCache.size,
        memory: 'N/A'
      };
    }

    return {
      connected: this.connected,
      mode: 'redis',
      client: this.client ? 'initialized' : 'not_initialized'
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (this.isMockMode) {
        return {
          healthy: true,
          mode: 'mock',
          latency: '< 1ms',
          keys: this.mockCache.size
        };
      }

      if (!this.connected || !this.client) {
        return {
          healthy: false,
          mode: 'redis',
          error: 'Not connected'
        };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        mode: 'redis',
        latency: `${latency}ms`,
        connected: this.connected
      };
    } catch (error) {
      return {
        healthy: false,
        mode: this.isMockMode ? 'mock' : 'redis',
        error: error.message
      };
    }
  }

  /**
   * Gracefully close connection
   */
  async close() {
    if (this.client && this.connected) {
      await this.client.quit();
      logger.getLogger().info('Redis connection closed');
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
module.exports = cacheService;