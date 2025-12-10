// Resilience Configuration
// Comprehensive error handling, retry logic, and circuit breakers

const logger = require('../services/loggingService');

/**
 * Database retry configuration
 */
const DB_RETRY_CONFIG = {
  maxRetries: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'EPIPE',
    'EAI_AGAIN',
    'connection timeout',
    'Connection terminated unexpectedly'
  ]
};

/**
 * Redis retry configuration
 */
const REDIS_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 10000,
  backoffMultiplier: 2
};

/**
 * External API retry configuration (OpenAI, Firebase, etc.)
 */
const API_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 15000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

/**
 * Generic retry function with exponential backoff
 */
async function retryWithBackoff(
  fn,
  config = DB_RETRY_CONFIG,
  context = 'operation'
) {
  let lastError;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = config.retryableErrors
        ? config.retryableErrors.some(errCode =>
            error.code === errCode ||
            error.message?.includes(errCode)
          )
        : true;

      // Check if status code is retryable (for HTTP errors)
      const isRetryableStatus = config.retryableStatusCodes
        ? config.retryableStatusCodes.includes(error.response?.status)
        : false;

      if (!isRetryable && !isRetryableStatus) {
        // Non-retryable error, throw immediately
        throw error;
      }

      if (attempt < config.maxRetries) {
        logger.getLogger().warn(`${context} failed, retrying (${attempt}/${config.maxRetries})`, {
          error: error.message,
          delay,
          attempt
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  logger.logError(lastError, {
    context,
    retriesExhausted: true,
    maxRetries: config.maxRetries
  });
  throw lastError;
}

/**
 * Database query with automatic retry
 */
async function resilientDatabaseQuery(queryFn, context = 'database query') {
  return retryWithBackoff(queryFn, DB_RETRY_CONFIG, context);
}

/**
 * Redis operation with automatic retry
 */
async function resilientRedisOperation(redisFn, context = 'redis operation') {
  return retryWithBackoff(redisFn, REDIS_RETRY_CONFIG, context);
}

/**
 * External API call with automatic retry
 */
async function resilientAPICall(apiFn, context = 'API call') {
  return retryWithBackoff(apiFn, API_RETRY_CONFIG, context);
}

/**
 * Graceful degradation wrapper
 * Returns fallback value if operation fails
 */
async function withFallback(fn, fallbackValue, context = 'operation') {
  try {
    return await fn();
  } catch (error) {
    logger.getLogger().warn(`${context} failed, using fallback`, {
      error: error.message,
      fallback: fallbackValue
    });
    return fallbackValue;
  }
}

/**
 * Circuit breaker state
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn) {
    // Check if circuit should be reset
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.getLogger().info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        logger.getLogger().info(`Circuit breaker ${this.name} CLOSED after recovery`);
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.getLogger().error(`Circuit breaker ${this.name} OPEN after ${this.failures} failures`);
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Global circuit breakers for critical services
 */
const circuitBreakers = {
  database: new CircuitBreaker('database', {
    failureThreshold: 10,
    resetTimeout: 30000
  }),
  redis: new CircuitBreaker('redis', {
    failureThreshold: 5,
    resetTimeout: 20000
  }),
  openai: new CircuitBreaker('openai', {
    failureThreshold: 3,
    resetTimeout: 60000
  }),
  firebase: new CircuitBreaker('firebase', {
    failureThreshold: 5,
    resetTimeout: 30000
  })
};

/**
 * Health check with timeout
 */
async function healthCheckWithTimeout(checkFn, timeout = 5000) {
  return Promise.race([
    checkFn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), timeout)
    )
  ]);
}

module.exports = {
  DB_RETRY_CONFIG,
  REDIS_RETRY_CONFIG,
  API_RETRY_CONFIG,
  retryWithBackoff,
  resilientDatabaseQuery,
  resilientRedisOperation,
  resilientAPICall,
  withFallback,
  CircuitBreaker,
  circuitBreakers,
  healthCheckWithTimeout
};