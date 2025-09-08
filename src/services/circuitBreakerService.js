const CircuitBreaker = require('opossum');
const logger = require('./loggingService');

/**
 * 🔌 CIRCUIT BREAKER SERVICE - PRODUCTION READY
 * Implements circuit breaker pattern for external API reliability
 */
class CircuitBreakerService {
  constructor() {
    this.breakers = new Map();
    this.defaultOptions = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50, // Trip when 50% of requests fail
      resetTimeout: 30000, // Try again after 30 seconds
      rollingCountTimeout: 60000, // 1 minute rolling window
      rollingCountBuckets: 10, // 10 buckets in rolling window
      volumeThreshold: 5, // Minimum requests before evaluating
      capacity: 100, // Maximum concurrent requests
      errorFilter: (err) => {
        // Don't trip on 4xx client errors, only server errors
        return err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || 
               (err.response && err.response.status >= 500);
      }
    };
  }

  /**
   * Create or get a circuit breaker for a service
   */
  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      const breakerOptions = { ...this.defaultOptions, ...options };
      const breaker = new CircuitBreaker(null, breakerOptions);
      
      // Event handlers
      breaker.on('open', () => {
        logger.logSecurity('CIRCUIT_BREAKER_OPEN', {
          service: serviceName,
          message: 'Circuit breaker opened due to failures'
        });
      });
      
      breaker.on('halfOpen', () => {
        logger.getLogger().info('Circuit breaker half-open', { service: serviceName });
      });
      
      breaker.on('close', () => {
        logger.getLogger().info('Circuit breaker closed', { service: serviceName });
      });
      
      breaker.on('reject', () => {
        logger.logError(new Error('Circuit breaker rejected request'), {
          service: serviceName,
          reason: 'circuit_breaker_open'
        });
      });

      breaker.on('timeout', () => {
        logger.logError(new Error('Circuit breaker timeout'), {
          service: serviceName,
          timeout: breakerOptions.timeout
        });
      });

      breaker.on('failure', (error) => {
        logger.logError(error, {
          service: serviceName,
          reason: 'circuit_breaker_failure'
        });
      });

      this.breakers.set(serviceName, breaker);
    }
    
    return this.breakers.get(serviceName);
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(serviceName, asyncFunction, options = {}) {
    const breaker = this.getBreaker(serviceName, options);
    
    try {
      const result = await breaker.fire(asyncFunction);
      logger.logExternalAPI(serviceName, 'SUCCESS', {
        circuitBreakerState: breaker.state,
        stats: breaker.stats
      });
      return result;
    } catch (error) {
      logger.logError(error, {
        service: serviceName,
        circuitBreakerState: breaker.state,
        stats: breaker.stats
      });
      throw error;
    }
  }

  /**
   * OpenAI API with circuit breaker
   */
  async executeOpenAI(apiCall, options = {}) {
    const openAIOptions = {
      timeout: 30000, // 30 seconds for AI calls
      errorThresholdPercentage: 40, // More sensitive for AI
      resetTimeout: 60000, // 1 minute reset
      volumeThreshold: 3, // Lower threshold for AI calls
      ...options
    };

    return this.execute('openai', apiCall, openAIOptions);
  }

  /**
   * Database operations with circuit breaker
   */
  async executeDatabase(dbCall, options = {}) {
    const dbOptions = {
      timeout: 5000, // 5 seconds for DB
      errorThresholdPercentage: 60, // Less sensitive for DB
      resetTimeout: 15000, // 15 seconds reset
      volumeThreshold: 10,
      ...options
    };

    return this.execute('database', dbCall, dbOptions);
  }

  /**
   * Firebase operations with circuit breaker
   */
  async executeFirebase(firebaseCall, options = {}) {
    const firebaseOptions = {
      timeout: 15000, // 15 seconds for Firebase
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds reset
      volumeThreshold: 5,
      ...options
    };

    return this.execute('firebase', firebaseCall, firebaseOptions);
  }

  /**
   * HTTP requests with circuit breaker
   */
  async executeHTTP(httpCall, options = {}) {
    const httpOptions = {
      timeout: 10000, // 10 seconds for HTTP
      errorThresholdPercentage: 50,
      resetTimeout: 20000, // 20 seconds reset
      volumeThreshold: 5,
      ...options
    };

    return this.execute('http', httpCall, httpOptions);
  }

  /**
   * Get circuit breaker status for all services
   */
  getStatus() {
    const status = {};
    
    for (const [serviceName, breaker] of this.breakers) {
      status[serviceName] = {
        state: breaker.state,
        stats: {
          requests: breaker.stats.requests,
          successes: breaker.stats.successes,
          failures: breaker.stats.failures,
          rejects: breaker.stats.rejects,
          timeouts: breaker.stats.timeouts,
          percentiles: breaker.stats.percentiles
        },
        enabled: breaker.enabled,
        closed: breaker.closed,
        opened: breaker.opened,
        halfOpen: breaker.halfOpen
      };
    }
    
    return status;
  }

  /**
   * Reset a specific circuit breaker
   */
  reset(serviceName) {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.close();
      logger.getLogger().info('Circuit breaker reset', { service: serviceName });
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    let resetCount = 0;
    for (const [serviceName, breaker] of this.breakers) {
      breaker.close();
      resetCount++;
    }
    logger.getLogger().info('All circuit breakers reset', { count: resetCount });
    return resetCount;
  }

  /**
   * Health check for circuit breakers
   */
  healthCheck() {
    const status = this.getStatus();
    const openBreakerCount = Object.values(status).filter(s => s.state === 'open').length;
    const halfOpenBreakerCount = Object.values(status).filter(s => s.state === 'halfOpen').length;
    
    return {
      healthy: openBreakerCount === 0,
      totalBreakers: Object.keys(status).length,
      openBreakers: openBreakerCount,
      halfOpenBreakers: halfOpenBreakerCount,
      status
    };
  }
}

// Export singleton instance
const circuitBreakerService = new CircuitBreakerService();
module.exports = circuitBreakerService;