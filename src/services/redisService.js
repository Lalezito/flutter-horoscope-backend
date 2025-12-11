/**
 * REDIS SERVICE FOR HORIZONTAL SCALING
 * 
 * Features:
 * - Distributed rate limiting
 * - Session management
 * - Cache management
 * - Real-time metrics
 * - Message queuing
 * - Pub/Sub for real-time notifications
 * - Distributed locks
 */

const redis = require('redis');
const moment = require('moment');

class RedisService {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      database: process.env.REDIS_DATABASE || 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'zodiac:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };
    
    this.keyPatterns = {
      rateLimit: 'rate_limit:',
      cache: 'cache:',
      session: 'session:',
      metrics: 'metrics:',
      lock: 'lock:',
      queue: 'queue:',
      pubsub: 'pubsub:'
    };
  }

  /**
   * Initialize Redis connection with fallback
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Redis service...');
      
      // Check if Redis is required (production scaling)
      if (!this.isRedisRequired()) {
        console.log('📝 Redis not required - using in-memory fallback');
        return this.initializeFallback();
      }
      
      // Create Redis client
      this.client = redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          reconnectStrategy: (retries) => this.getReconnectDelay(retries)
        },
        password: this.config.password,
        database: this.config.database,
        keyPrefix: this.config.keyPrefix
      });
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Connect to Redis
      await this.client.connect();
      
      // Create pub/sub clients
      await this.initializePubSub();
      
      // Verify connection
      await this.verifyConnection();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ Redis service initialized successfully');
      return { status: 'connected', fallback: false };
      
    } catch (error) {
      console.warn('⚠️ Redis connection failed, using fallback:', error.message);
      return this.initializeFallback();
    }
  }

  /**
   * Initialize in-memory fallback for development/single instance
   */
  initializeFallback() {
    this.fallbackStorage = new Map();
    this.isConnected = false;
    
    console.log('📦 Initialized in-memory fallback storage');
    return { status: 'fallback', fallback: true };
  }

  /**
   * Setup Redis event handlers
   */
  setupEventHandlers() {
    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });
    
    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });
    
    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });
    
    this.client.on('reconnecting', () => {
      console.log('🔄 Redis client reconnecting...');
      this.reconnectAttempts++;
    });
    
    this.client.on('end', () => {
      console.log('🔌 Redis client connection ended');
      this.isConnected = false;
    });
  }

  /**
   * Initialize pub/sub clients
   */
  async initializePubSub() {
    // Subscriber client
    this.subscriber = this.client.duplicate();
    await this.subscriber.connect();
    
    // Publisher client  
    this.publisher = this.client.duplicate();
    await this.publisher.connect();
    
    console.log('📡 Redis pub/sub clients initialized');
  }

  /**
   * Verify Redis connection
   */
  async verifyConnection() {
    const testKey = `${this.keyPatterns.cache}connection_test`;
    const testValue = Date.now().toString();
    
    await this.client.setEx(testKey, 10, testValue);
    const retrieved = await this.client.get(testKey);
    
    if (retrieved !== testValue) {
      throw new Error('Redis connection verification failed');
    }
    
    await this.client.del(testKey);
  }

  /**
   * DISTRIBUTED RATE LIMITING
   */
  async checkRateLimit(identifier, limit, windowSeconds) {
    const key = `${this.keyPatterns.rateLimit}${identifier}`;
    
    if (!this.isConnected) {
      return this.checkRateLimitFallback(identifier, limit, windowSeconds);
    }
    
    try {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        // First request in window
        await this.client.expire(key, windowSeconds);
      }
      
      const ttl = await this.client.ttl(key);
      
      return {
        count: current,
        limit: limit,
        remaining: Math.max(0, limit - current),
        reset: Date.now() + (ttl * 1000),
        allowed: current <= limit
      };
      
    } catch (error) {
      console.error('Redis rate limit check failed:', error);
      return this.checkRateLimitFallback(identifier, limit, windowSeconds);
    }
  }

  /**
   * Fallback rate limiting using in-memory storage
   */
  checkRateLimitFallback(identifier, limit, windowSeconds) {
    if (!this.fallbackStorage.has(identifier)) {
      this.fallbackStorage.set(identifier, {
        count: 0,
        resetTime: Date.now() + (windowSeconds * 1000)
      });
    }
    
    const data = this.fallbackStorage.get(identifier);
    
    if (Date.now() > data.resetTime) {
      data.count = 0;
      data.resetTime = Date.now() + (windowSeconds * 1000);
    }
    
    data.count++;
    
    return {
      count: data.count,
      limit: limit,
      remaining: Math.max(0, limit - data.count),
      reset: data.resetTime,
      allowed: data.count <= limit
    };
  }

  /**
   * DISTRIBUTED CACHING
   */
  async get(key, fallbackFunction = null) {
    const fullKey = `${this.keyPatterns.cache}${key}`;
    
    try {
      if (this.isConnected) {
        const value = await this.client.get(fullKey);
        if (value !== null) {
          return JSON.parse(value);
        }
      } else if (this.fallbackStorage?.has(fullKey)) {
        const data = this.fallbackStorage.get(fullKey);
        if (Date.now() < data.expires) {
          return data.value;
        } else {
          this.fallbackStorage.delete(fullKey);
        }
      }
      
      // If fallback function provided and no cached value
      if (fallbackFunction && typeof fallbackFunction === 'function') {
        const result = await fallbackFunction();
        await this.set(key, result, 300); // Default 5 minutes
        return result;
      }
      
      return null;
      
    } catch (error) {
      console.error('Cache get error:', error);
      
      if (fallbackFunction && typeof fallbackFunction === 'function') {
        return await fallbackFunction();
      }
      
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    const fullKey = `${this.keyPatterns.cache}${key}`;

    try {
      if (this.isConnected) {
        await this.client.setEx(fullKey, ttlSeconds, JSON.stringify(value));
      } else {
        // Fallback storage
        if (!this.fallbackStorage) this.fallbackStorage = new Map();
        this.fallbackStorage.set(fullKey, {
          value: value,
          expires: Date.now() + (ttlSeconds * 1000)
        });
      }

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Alias for set() - for compatibility with existing code
   */
  async setex(key, ttlSeconds, value) {
    return await this.set(key, value, ttlSeconds);
  }

  async delete(key) {
    const fullKey = `${this.keyPatterns.cache}${key}`;
    
    try {
      if (this.isConnected) {
        await this.client.del(fullKey);
      } else if (this.fallbackStorage?.has(fullKey)) {
        this.fallbackStorage.delete(fullKey);
      }
      
      return true;
      
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * DISTRIBUTED SESSIONS
   */
  async getSession(sessionId) {
    const key = `${this.keyPatterns.session}${sessionId}`;
    return await this.get(key);
  }

  async setSession(sessionId, sessionData, ttlSeconds = 3600) {
    const key = `${this.keyPatterns.session}${sessionId}`;
    return await this.set(key, sessionData, ttlSeconds);
  }

  async deleteSession(sessionId) {
    const key = `${this.keyPatterns.session}${sessionId}`;
    return await this.delete(key);
  }

  /**
   * DISTRIBUTED METRICS COLLECTION
   */
  async recordMetric(metricName, value, timestamp = null) {
    const time = timestamp || Date.now();
    const key = `${this.keyPatterns.metrics}${metricName}`;
    
    try {
      if (this.isConnected) {
        // Use Redis sorted set for time-series data
        await this.client.zAdd(key, [{ score: time, value: JSON.stringify({ value, timestamp: time }) }]);
        
        // Keep only last 24 hours of data
        const oneDayAgo = time - (24 * 60 * 60 * 1000);
        await this.client.zRemRangeByScore(key, 0, oneDayAgo);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Metric recording error:', error);
      return false;
    }
  }

  async getMetrics(metricName, fromTime = null, toTime = null) {
    const key = `${this.keyPatterns.metrics}${metricName}`;
    const from = fromTime || (Date.now() - (24 * 60 * 60 * 1000)); // Default last 24h
    const to = toTime || Date.now();
    
    try {
      if (this.isConnected) {
        const results = await this.client.zRangeByScore(key, from, to);
        return results.map(result => JSON.parse(result));
      }
      
      return [];
      
    } catch (error) {
      console.error('Get metrics error:', error);
      return [];
    }
  }

  /**
   * DISTRIBUTED LOCKS
   */
  async acquireLock(lockName, ttlSeconds = 30, retryDelayMs = 100, maxRetries = 10) {
    const key = `${this.keyPatterns.lock}${lockName}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    if (!this.isConnected) {
      return { acquired: false, reason: 'Redis not connected' };
    }
    
    try {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await this.client.setNX(key, lockValue);
        
        if (result) {
          await this.client.expire(key, ttlSeconds);
          
          return {
            acquired: true,
            lockValue: lockValue,
            ttl: ttlSeconds
          };
        }
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
      
      return { acquired: false, reason: 'Max retries exceeded' };
      
    } catch (error) {
      console.error('Lock acquisition error:', error);
      return { acquired: false, reason: error.message };
    }
  }

  async releaseLock(lockName, lockValue) {
    const key = `${this.keyPatterns.lock}${lockName}`;
    
    if (!this.isConnected) return false;
    
    try {
      // Lua script to ensure we only delete our own lock
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(luaScript, { keys: [key], arguments: [lockValue] });
      return result === 1;
      
    } catch (error) {
      console.error('Lock release error:', error);
      return false;
    }
  }

  /**
   * MESSAGE QUEUE OPERATIONS
   */
  async enqueue(queueName, message, priority = 0) {
    const key = `${this.keyPatterns.queue}${queueName}`;
    
    if (!this.isConnected) return false;
    
    try {
      const messageData = {
        id: `${Date.now()}-${Math.random()}`,
        payload: message,
        timestamp: Date.now(),
        priority: priority,
        attempts: 0
      };
      
      // Use sorted set with priority as score
      await this.client.zAdd(key, [{ score: priority, value: JSON.stringify(messageData) }]);
      
      // Publish notification
      await this.publish(`queue:${queueName}:new`, messageData.id);
      
      return messageData.id;
      
    } catch (error) {
      console.error('Enqueue error:', error);
      return false;
    }
  }

  async dequeue(queueName, count = 1) {
    const key = `${this.keyPatterns.queue}${queueName}`;
    
    if (!this.isConnected) return [];
    
    try {
      // Get highest priority messages (highest score first)
      const messages = await this.client.zRevRange(key, 0, count - 1);
      
      if (messages.length === 0) return [];
      
      // Remove retrieved messages from queue
      await this.client.zRem(key, messages);
      
      return messages.map(msg => JSON.parse(msg));
      
    } catch (error) {
      console.error('Dequeue error:', error);
      return [];
    }
  }

  /**
   * PUB/SUB OPERATIONS
   */
  async publish(channel, message) {
    const fullChannel = `${this.keyPatterns.pubsub}${channel}`;
    
    if (!this.isConnected || !this.publisher) return false;
    
    try {
      const messageData = {
        channel: channel,
        message: message,
        timestamp: Date.now(),
        source: process.env.INSTANCE_ID || 'unknown'
      };
      
      await this.publisher.publish(fullChannel, JSON.stringify(messageData));
      return true;
      
    } catch (error) {
      console.error('Publish error:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    const fullChannel = `${this.keyPatterns.pubsub}${channel}`;
    
    if (!this.isConnected || !this.subscriber) return false;
    
    try {
      await this.subscriber.subscribe(fullChannel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          console.error('Message parse error:', error);
        }
      });
      
      return true;
      
    } catch (error) {
      console.error('Subscribe error:', error);
      return false;
    }
  }

  /**
   * HEALTH CHECK AND MONITORING
   */
  async getHealthStatus() {
    const health = {
      connected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'fallback',
      reconnect_attempts: this.reconnectAttempts,
      config: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      }
    };
    
    if (this.isConnected) {
      try {
        const info = await this.client.info('memory');
        const keyCount = await this.client.dbSize();
        
        health.memory_info = this.parseRedisInfo(info);
        health.key_count = keyCount;
        health.latency = await this.measureLatency();
        
      } catch (error) {
        health.error = error.message;
      }
    }
    
    if (!this.isConnected && this.fallbackStorage) {
      health.fallback_storage_size = this.fallbackStorage.size;
    }
    
    return health;
  }

  async measureLatency() {
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  /**
   * Ping Redis to check if connection is alive
   * Used by health checks in other services
   */
  async ping() {
    // If using fallback (in-memory), return success
    if (this.fallbackStorage) {
      return 'PONG (fallback)';
    }

    // If Redis client exists and connected
    if (this.isConnected && this.client) {
      try {
        return await this.client.ping();
      } catch (error) {
        console.error('Redis ping failed:', error.message);
        throw error;
      }
    }

    // If neither connected nor fallback initialized, initialize fallback now
    // This can happen if ping() is called before initialize()
    console.warn('Redis ping called before initialization, initializing fallback...');
    this.initializeFallback();
    return 'PONG (late-init fallback)';
  }

  parseRedisInfo(infoString) {
    const lines = infoString.split('\r\n');
    const info = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          info[key] = value;
        }
      }
    });
    
    return info;
  }

  /**
   * CLEANUP AND MAINTENANCE
   */
  async cleanup() {
    try {
      // Clean expired entries in fallback storage
      if (this.fallbackStorage) {
        const now = Date.now();
        for (const [key, data] of this.fallbackStorage.entries()) {
          if (data.expires && now > data.expires) {
            this.fallbackStorage.delete(key);
          }
        }
      }
      
      // Clean old metrics (keep only 7 days)
      if (this.isConnected) {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const metricKeys = await this.client.keys(`${this.keyPatterns.metrics}*`);
        
        for (const key of metricKeys) {
          await this.client.zRemRangeByScore(key, 0, sevenDaysAgo);
        }
      }
      
      console.log('🧹 Redis cleanup completed');
      
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }
  }

  /**
   * UTILITY METHODS
   */
  isRedisRequired() {
    // Redis is only required when a real Redis URL is configured (not localhost)
    // In Railway without Redis addon, we use in-memory fallback
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
    const redisHost = process.env.REDIS_HOST;

    // If REDIS_URL contains a real host (not localhost), use Redis
    if (redisUrl && !redisUrl.includes('localhost') && !redisUrl.includes('127.0.0.1')) {
      return true;
    }

    // If REDIS_HOST is set to something other than localhost, use Redis
    if (redisHost && redisHost !== 'localhost' && redisHost !== '127.0.0.1') {
      return true;
    }

    // Explicit enable flag
    if (process.env.ENABLE_REDIS === 'true') {
      return true;
    }

    // Default: use fallback (in-memory)
    return false;
  }

  getReconnectDelay(retries) {
    if (retries > this.maxReconnectAttempts) {
      console.error(`❌ Max Redis reconnect attempts (${this.maxReconnectAttempts}) exceeded`);
      return null; // Stop reconnecting
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, retries), 30000);
  }

  /**
   * GRACEFUL SHUTDOWN
   */
  async disconnect() {
    console.log('🔌 Disconnecting Redis clients...');
    
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      
      if (this.publisher) {
        await this.publisher.quit();
      }
      
      if (this.client) {
        await this.client.quit();
      }
      
      this.isConnected = false;
      console.log('✅ Redis clients disconnected gracefully');
      
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }
}

// Export singleton instance
module.exports = new RedisService();