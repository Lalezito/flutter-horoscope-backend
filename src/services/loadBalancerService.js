/**
 * LOAD BALANCER SERVICE FOR HORIZONTAL SCALING
 * 
 * Features:
 * - Health-based load balancing
 * - Request routing and failover
 * - Performance monitoring per instance
 * - Circuit breaker pattern
 * - Sticky sessions support
 * - Auto-scaling recommendations
 */

const redisService = require('./redisService');
const axios = require('axios');
const crypto = require('crypto');

class LoadBalancerService {
  constructor() {
    this.instances = new Map();
    this.algorithms = {
      ROUND_ROBIN: 'round_robin',
      LEAST_CONNECTIONS: 'least_connections',
      LEAST_RESPONSE_TIME: 'least_response_time',
      WEIGHTED_ROUND_ROBIN: 'weighted_round_robin',
      HEALTH_BASED: 'health_based'
    };
    
    this.currentAlgorithm = this.algorithms.HEALTH_BASED;
    this.roundRobinIndex = 0;
    
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000,   // 5 seconds
      maxFailures: 3,             // Mark unhealthy after 3 failures
      recoveryRequests: 2,        // Mark healthy after 2 successes
      stickySessionTTL: 3600,     // 1 hour
      circuitBreakerThreshold: 50, // 50% error rate
      circuitBreakerTimeout: 60000 // 1 minute
    };
    
    this.healthCheckTimer = null;
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0
    };
  }

  /**
   * Initialize load balancer with instance discovery
   */
  async initialize() {
    console.log('⚖️ Initializing Load Balancer Service...');
    
    try {
      // Discover available instances
      await this.discoverInstances();
      
      // Start health checking
      this.startHealthChecking();
      
      // Initialize metrics collection
      await this.initializeMetrics();
      
      console.log(`✅ Load balancer initialized with ${this.instances.size} instances`);
      return {
        status: 'initialized',
        instances: this.instances.size,
        algorithm: this.currentAlgorithm
      };
      
    } catch (error) {
      console.error('Load balancer initialization failed:', error);
      throw error;
    }
  }

  /**
   * Discover and register service instances
   */
  async discoverInstances() {
    // Register current instance
    await this.registerInstance({
      id: this.getCurrentInstanceId(),
      host: process.env.HOST || 'localhost',
      port: process.env.PORT || 3000,
      weight: 1,
      tags: ['primary', 'zodiac-backend']
    });
    
    // Discover other instances from environment or service registry
    const externalInstances = this.parseExternalInstances();
    for (const instance of externalInstances) {
      await this.registerInstance(instance);
    }
    
    console.log(`🔍 Discovered ${this.instances.size} service instances`);
  }

  /**
   * Register a service instance
   */
  async registerInstance(instanceConfig) {
    const {
      id,
      host,
      port,
      weight = 1,
      tags = [],
      healthCheckPath = '/health'
    } = instanceConfig;
    
    const instance = {
      id: id,
      url: `http://${host}:${port}`,
      host: host,
      port: port,
      weight: weight,
      tags: tags,
      healthCheckPath: healthCheckPath,
      
      // Health status
      healthy: true,
      failureCount: 0,
      successCount: 0,
      lastHealthCheck: null,
      
      // Performance metrics
      connections: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      
      // Circuit breaker
      circuitBreaker: {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failures: 0,
        lastFailure: null,
        nextAttempt: null
      },
      
      // Registration time
      registeredAt: new Date().toISOString()
    };
    
    this.instances.set(id, instance);
    
    // Store in Redis for service discovery
    await this.storeInstanceInRegistry(instance);
    
    console.log(`📋 Registered instance: ${id} at ${instance.url}`);
    return instance;
  }

  /**
   * Unregister a service instance
   */
  async unregisterInstance(instanceId) {
    if (this.instances.has(instanceId)) {
      this.instances.delete(instanceId);
      
      // Remove from Redis registry
      await redisService.delete(`service_registry:${instanceId}`);
      
      console.log(`❌ Unregistered instance: ${instanceId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Select the best instance for a request using configured algorithm
   */
  async selectInstance(request = {}) {
    const healthyInstances = this.getHealthyInstances();
    
    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }
    
    // Check for sticky session
    if (request.sessionId) {
      const stickyInstance = await this.getStickySessionInstance(request.sessionId);
      if (stickyInstance && healthyInstances.includes(stickyInstance)) {
        return stickyInstance;
      }
    }
    
    let selectedInstance;
    
    switch (this.currentAlgorithm) {
      case this.algorithms.ROUND_ROBIN:
        selectedInstance = this.selectRoundRobin(healthyInstances);
        break;
        
      case this.algorithms.LEAST_CONNECTIONS:
        selectedInstance = this.selectLeastConnections(healthyInstances);
        break;
        
      case this.algorithms.LEAST_RESPONSE_TIME:
        selectedInstance = this.selectLeastResponseTime(healthyInstances);
        break;
        
      case this.algorithms.WEIGHTED_ROUND_ROBIN:
        selectedInstance = this.selectWeightedRoundRobin(healthyInstances);
        break;
        
      case this.algorithms.HEALTH_BASED:
        selectedInstance = this.selectHealthBased(healthyInstances);
        break;
        
      default:
        selectedInstance = healthyInstances[0];
    }
    
    // Set sticky session if provided
    if (request.sessionId && selectedInstance) {
      await this.setStickySession(request.sessionId, selectedInstance.id);
    }
    
    return selectedInstance;
  }

  /**
   * Proxy request to selected instance
   */
  async proxyRequest(request) {
    const startTime = Date.now();
    let selectedInstance;
    
    try {
      selectedInstance = await this.selectInstance(request);
      
      // Increment connection count
      selectedInstance.connections++;
      
      // Build target URL
      const targetUrl = `${selectedInstance.url}${request.path}${request.query ? '?' + request.query : ''}`;
      
      // Prepare request options
      const requestOptions = {
        method: request.method || 'GET',
        url: targetUrl,
        headers: {
          ...request.headers,
          'X-Forwarded-For': request.ip,
          'X-Load-Balancer': this.getCurrentInstanceId(),
          'X-Target-Instance': selectedInstance.id
        },
        data: request.body,
        timeout: request.timeout || 30000,
        validateStatus: () => true // Don't throw on HTTP error status
      };
      
      // Make the request
      const response = await axios(requestOptions);
      const responseTime = Date.now() - startTime;
      
      // Update instance metrics
      await this.updateInstanceMetrics(selectedInstance.id, {
        responseTime: responseTime,
        statusCode: response.status,
        success: response.status < 500
      });
      
      // Update global metrics
      this.updateGlobalMetrics(responseTime, response.status < 500);
      
      return {
        success: true,
        statusCode: response.status,
        headers: response.headers,
        data: response.data,
        responseTime: responseTime,
        instanceId: selectedInstance.id
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update instance metrics on error
      if (selectedInstance) {
        await this.updateInstanceMetrics(selectedInstance.id, {
          responseTime: responseTime,
          statusCode: 500,
          success: false,
          error: error.message
        });
      }
      
      // Update global metrics
      this.updateGlobalMetrics(responseTime, false);
      
      // Try failover
      if (selectedInstance && this.instances.size > 1) {
        console.warn(`Request failed on ${selectedInstance.id}, attempting failover...`);
        return this.handleFailover(request, selectedInstance.id, error);
      }
      
      throw error;
      
    } finally {
      // Decrement connection count
      if (selectedInstance) {
        selectedInstance.connections = Math.max(0, selectedInstance.connections - 1);
      }
    }
  }

  /**
   * Handle request failover to another instance
   */
  async handleFailover(originalRequest, failedInstanceId, originalError) {
    try {
      // Mark instance as temporarily unavailable
      const failedInstance = this.instances.get(failedInstanceId);
      if (failedInstance) {
        failedInstance.failureCount++;
        if (failedInstance.failureCount >= this.config.maxFailures) {
          failedInstance.healthy = false;
          console.warn(`Instance ${failedInstanceId} marked as unhealthy`);
        }
      }
      
      // Exclude failed instance from selection
      const healthyInstances = this.getHealthyInstances()
        .filter(instance => instance.id !== failedInstanceId);
      
      if (healthyInstances.length === 0) {
        throw new Error('No healthy instances available for failover');
      }
      
      // Retry request with different instance
      const retryRequest = {
        ...originalRequest,
        sessionId: null // Don't use sticky session for failover
      };
      
      return await this.proxyRequest(retryRequest);
      
    } catch (failoverError) {
      console.error('Failover attempt failed:', failoverError);
      throw originalError; // Return original error
    }
  }

  /**
   * Load balancing algorithms
   */
  selectRoundRobin(instances) {
    const instance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex++;
    return instance;
  }

  selectLeastConnections(instances) {
    return instances.reduce((min, current) => 
      current.connections < min.connections ? current : min
    );
  }

  selectLeastResponseTime(instances) {
    return instances.reduce((min, current) => 
      current.averageResponseTime < min.averageResponseTime ? current : min
    );
  }

  selectWeightedRoundRobin(instances) {
    // Simple weighted selection based on instance weight
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0]; // Fallback
  }

  selectHealthBased(instances) {
    // Score based on health, response time, and load
    const scoredInstances = instances.map(instance => {
      let score = 100;
      
      // Penalize high response times
      if (instance.averageResponseTime > 1000) {
        score -= 30;
      } else if (instance.averageResponseTime > 500) {
        score -= 15;
      }
      
      // Penalize high connection count
      if (instance.connections > 10) {
        score -= 20;
      } else if (instance.connections > 5) {
        score -= 10;
      }
      
      // Penalize recent failures
      if (instance.failureCount > 0) {
        score -= instance.failureCount * 10;
      }
      
      // Boost for successful requests
      score += instance.successCount;
      
      return { instance, score };
    });
    
    // Select instance with highest score
    const best = scoredInstances.reduce((max, current) => 
      current.score > max.score ? current : max
    );
    
    return best.instance;
  }

  /**
   * Health checking
   */
  startHealthChecking() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    console.log(`❤️ Health checking started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  async performHealthChecks() {
    const promises = Array.from(this.instances.values()).map(instance => 
      this.checkInstanceHealth(instance)
    );
    
    await Promise.allSettled(promises);
  }

  async checkInstanceHealth(instance) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(
        `${instance.url}${instance.healthCheckPath}`,
        {
          timeout: this.config.healthCheckTimeout,
          headers: {
            'User-Agent': 'LoadBalancer-HealthCheck/1.0'
          }
        }
      );
      
      const responseTime = Date.now() - startTime;
      instance.lastResponseTime = responseTime;
      instance.lastHealthCheck = new Date().toISOString();
      
      if (response.status === 200) {
        instance.successCount++;
        
        // Mark as healthy if it was unhealthy and has enough successful checks
        if (!instance.healthy && instance.successCount >= this.config.recoveryRequests) {
          instance.healthy = true;
          instance.failureCount = 0;
          console.log(`✅ Instance ${instance.id} recovered and marked as healthy`);
        }
        
      } else {
        throw new Error(`Health check returned status ${response.status}`);
      }
      
    } catch (error) {
      instance.failureCount++;
      instance.lastHealthCheck = new Date().toISOString();
      
      // Mark as unhealthy if failure threshold exceeded
      if (instance.healthy && instance.failureCount >= this.config.maxFailures) {
        instance.healthy = false;
        console.warn(`⚠️ Instance ${instance.id} marked as unhealthy: ${error.message}`);
        
        // Send alert
        await this.sendHealthAlert(instance, error.message);
      }
    }
  }

  /**
   * Sticky sessions
   */
  async setStickySession(sessionId, instanceId) {
    const key = `sticky_session:${sessionId}`;
    await redisService.set(key, instanceId, this.config.stickySessionTTL);
  }

  async getStickySessionInstance(sessionId) {
    const key = `sticky_session:${sessionId}`;
    const instanceId = await redisService.get(key);
    
    if (instanceId && this.instances.has(instanceId)) {
      return this.instances.get(instanceId);
    }
    
    return null;
  }

  /**
   * Metrics and monitoring
   */
  async updateInstanceMetrics(instanceId, metrics) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    instance.totalRequests++;
    instance.lastResponseTime = metrics.responseTime;
    
    // Update average response time (sliding window)
    instance.averageResponseTime = 
      (instance.averageResponseTime * 0.9) + (metrics.responseTime * 0.1);
    
    if (!metrics.success) {
      instance.totalErrors++;
    }
    
    // Store metrics in Redis for monitoring
    await redisService.recordMetric(
      `instance_${instanceId}_response_time`,
      metrics.responseTime
    );
    
    await redisService.recordMetric(
      `instance_${instanceId}_requests`,
      1
    );
    
    if (!metrics.success) {
      await redisService.recordMetric(
        `instance_${instanceId}_errors`,
        1
      );
    }
  }

  updateGlobalMetrics(responseTime, success) {
    this.metrics.totalRequests++;
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * 0.95) + (responseTime * 0.05);
    
    if (!success) {
      this.metrics.totalErrors++;
    }
  }

  async initializeMetrics() {
    // Initialize metrics collection
    setInterval(async () => {
      await this.collectMetrics();
    }, 60000); // Collect every minute
  }

  async collectMetrics() {
    // Calculate requests per second
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = await redisService.getMetrics('global_requests', oneMinuteAgo, now);
    this.metrics.requestsPerSecond = recentRequests.length / 60;
    
    // Store global metrics
    await redisService.recordMetric('global_requests', this.metrics.totalRequests);
    await redisService.recordMetric('global_errors', this.metrics.totalErrors);
    await redisService.recordMetric('average_response_time', this.metrics.averageResponseTime);
  }

  /**
   * Auto-scaling recommendations
   */
  async getScalingRecommendations() {
    const healthyInstances = this.getHealthyInstances();
    const totalLoad = healthyInstances.reduce((sum, instance) => sum + instance.connections, 0);
    const avgLoad = totalLoad / healthyInstances.length;
    const avgResponseTime = healthyInstances.reduce((sum, instance) => sum + instance.averageResponseTime, 0) / healthyInstances.length;
    
    const recommendations = [];
    
    // Scale up recommendations
    if (avgLoad > 8) {
      recommendations.push({
        action: 'SCALE_UP',
        reason: 'High average load per instance',
        priority: 'HIGH',
        current_instances: healthyInstances.length,
        suggested_instances: Math.ceil(healthyInstances.length * 1.5)
      });
    }
    
    if (avgResponseTime > 2000) {
      recommendations.push({
        action: 'SCALE_UP',
        reason: 'High average response time',
        priority: 'MEDIUM',
        current_instances: healthyInstances.length,
        suggested_instances: healthyInstances.length + 1
      });
    }
    
    // Scale down recommendations
    if (avgLoad < 2 && healthyInstances.length > 2) {
      recommendations.push({
        action: 'SCALE_DOWN',
        reason: 'Low average load per instance',
        priority: 'LOW',
        current_instances: healthyInstances.length,
        suggested_instances: Math.max(2, Math.floor(healthyInstances.length * 0.8))
      });
    }
    
    return recommendations;
  }

  /**
   * Utility methods
   */
  getHealthyInstances() {
    return Array.from(this.instances.values()).filter(instance => instance.healthy);
  }

  getCurrentInstanceId() {
    return process.env.INSTANCE_ID || crypto.randomUUID();
  }

  parseExternalInstances() {
    const instancesEnv = process.env.LOAD_BALANCER_INSTANCES || '';
    if (!instancesEnv) return [];
    
    return instancesEnv.split(',').map(instanceStr => {
      const [host, port] = instanceStr.split(':');
      return {
        id: `external-${host}-${port}`,
        host: host,
        port: parseInt(port) || 3000,
        weight: 1,
        tags: ['external']
      };
    });
  }

  async storeInstanceInRegistry(instance) {
    const key = `service_registry:${instance.id}`;
    await redisService.set(key, instance, 300); // 5 minutes TTL
  }

  async sendHealthAlert(instance, error) {
    // This would integrate with your alerting system
    console.warn(`🚨 Health alert for instance ${instance.id}: ${error}`);
  }

  /**
   * Status and monitoring
   */
  async getLoadBalancerStatus() {
    const instances = Array.from(this.instances.values());
    const healthyCount = instances.filter(i => i.healthy).length;
    
    return {
      algorithm: this.currentAlgorithm,
      total_instances: instances.length,
      healthy_instances: healthyCount,
      unhealthy_instances: instances.length - healthyCount,
      global_metrics: this.metrics,
      instances: instances.map(i => ({
        id: i.id,
        url: i.url,
        healthy: i.healthy,
        connections: i.connections,
        total_requests: i.totalRequests,
        total_errors: i.totalErrors,
        average_response_time: Math.round(i.averageResponseTime),
        failure_count: i.failureCount,
        last_health_check: i.lastHealthCheck
      })),
      scaling_recommendations: await this.getScalingRecommendations()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('⏹️ Shutting down load balancer...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Drain connections gracefully
    const healthyInstances = this.getHealthyInstances();
    const maxWait = 30000; // 30 seconds max
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const activeConnections = healthyInstances.reduce((sum, i) => sum + i.connections, 0);
      
      if (activeConnections === 0) {
        break;
      }
      
      console.log(`⏳ Waiting for ${activeConnections} active connections to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Load balancer shutdown complete');
  }
}

module.exports = new LoadBalancerService();