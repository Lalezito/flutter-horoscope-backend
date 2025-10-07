#!/usr/bin/env node

/**
 * 📊 COMPREHENSIVE PERFORMANCE BENCHMARK SUITE
 * Performance optimization specialist - comprehensive API performance analysis
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';
const TEST_ITERATIONS = 100;
const CONCURRENT_REQUESTS = 50;

class PerformanceBenchmark {
  constructor() {
    this.results = {
      endpoints: {},
      memory: [],
      concurrency: {},
      baseline: {},
      recommendations: []
    };
    this.startTime = Date.now();
  }

  /**
   * 🏃‍♂️ RUN COMPREHENSIVE BENCHMARK SUITE
   */
  async runBenchmark() {
    console.log('🚀 Starting Comprehensive Performance Benchmark Suite');
    console.log('═════════════════════════════════════════════════════');
    
    try {
      // 1. Baseline Health Check
      await this.testBaseline();
      
      // 2. Individual Endpoint Performance
      await this.testEndpoints();
      
      // 3. Database Query Performance
      await this.testDatabasePerformance();
      
      // 4. Cache Performance
      await this.testCachePerformance();
      
      // 5. Memory Usage Analysis
      await this.testMemoryUsage();
      
      // 6. Concurrent Request Handling
      await this.testConcurrency();
      
      // 7. Rate Limiting Overhead
      await this.testRateLimitingOverhead();
      
      // 8. Generate Performance Report
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * 📏 TEST BASELINE PERFORMANCE
   */
  async testBaseline() {
    console.log('\\n1️⃣ Testing Baseline Performance...');
    
    const endpoints = [
      { name: 'health', path: '/health', method: 'GET' },
      { name: 'ping', path: '/ping', method: 'GET' },
      { name: 'docs', path: '/api/docs', method: 'GET' }
    ];
    
    for (const endpoint of endpoints) {
      const times = [];
      
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        try {
          const response = await axios({
            method: endpoint.method,
            url: `${BASE_URL}${endpoint.path}`,
            timeout: 5000
          });
          
          const responseTime = performance.now() - start;
          times.push({
            time: responseTime,
            status: response.status,
            size: JSON.stringify(response.data).length
          });
        } catch (error) {
          times.push({
            time: performance.now() - start,
            status: error.response?.status || 500,
            error: error.message
          });
        }
      }
      
      const avgTime = times.reduce((sum, t) => sum + t.time, 0) / times.length;
      const minTime = Math.min(...times.map(t => t.time));
      const maxTime = Math.max(...times.map(t => t.time));
      
      this.results.baseline[endpoint.name] = {
        avg_ms: Math.round(avgTime * 100) / 100,
        min_ms: Math.round(minTime * 100) / 100,
        max_ms: Math.round(maxTime * 100) / 100,
        success_rate: times.filter(t => t.status < 400).length / times.length * 100,
        tests: times.length
      };
      
      console.log(`   ${endpoint.name}: ${Math.round(avgTime)}ms avg (${minTime.toFixed(1)}-${maxTime.toFixed(1)}ms)`);
    }
  }

  /**
   * 🎯 TEST API ENDPOINTS PERFORMANCE
   */
  async testEndpoints() {
    console.log('\\n2️⃣ Testing API Endpoints Performance...');
    
    const apiEndpoints = [
      { 
        name: 'daily_horoscope', 
        path: '/api/coaching/getDailyHoroscope?sign=aries&language=en',
        method: 'GET'
      },
      {
        name: 'all_horoscopes',
        path: '/api/coaching/getAllHoroscopes?language=en',
        method: 'GET'
      },
      {
        name: 'weekly_horoscope',
        path: '/api/weekly/getWeeklyHoroscope?sign=leo&language=en',
        method: 'GET'
      },
      {
        name: 'compatibility_basic',
        path: '/api/compatibility/calculate?sign1=aries&sign2=leo',
        method: 'GET'
      },
      {
        name: 'neural_health',
        path: '/api/neural-compatibility/health',
        method: 'GET'
      }
    ];
    
    for (const endpoint of apiEndpoints) {
      await this.benchmarkEndpoint(endpoint);
    }
  }

  /**
   * 🏋️‍♂️ BENCHMARK INDIVIDUAL ENDPOINT
   */
  async benchmarkEndpoint(endpoint) {
    const times = [];
    const errors = [];
    
    console.log(`   Testing ${endpoint.name}...`);
    
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.path}`,
          timeout: 10000,
          data: endpoint.data || undefined
        });
        
        const responseTime = performance.now() - start;
        times.push({
          time: responseTime,
          status: response.status,
          size: JSON.stringify(response.data).length,
          cached: response.data?.cached || false
        });
        
      } catch (error) {
        const responseTime = performance.now() - start;
        errors.push({
          time: responseTime,
          status: error.response?.status || 500,
          error: error.message
        });
      }
      
      // Small delay to avoid overwhelming the server
      if (i % 10 === 0) await this.sleep(10);
    }
    
    // Calculate statistics
    const allTimes = times.map(t => t.time);
    const avgTime = allTimes.reduce((sum, t) => sum + t, 0) / allTimes.length;
    const p95Time = this.percentile(allTimes, 95);
    const p99Time = this.percentile(allTimes, 99);
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    
    this.results.endpoints[endpoint.name] = {
      avg_ms: Math.round(avgTime * 100) / 100,
      min_ms: Math.round(minTime * 100) / 100,
      max_ms: Math.round(maxTime * 100) / 100,
      p95_ms: Math.round(p95Time * 100) / 100,
      p99_ms: Math.round(p99Time * 100) / 100,
      success_rate: (times.length / TEST_ITERATIONS) * 100,
      error_rate: (errors.length / TEST_ITERATIONS) * 100,
      cache_hit_rate: (times.filter(t => t.cached).length / times.length) * 100,
      total_requests: TEST_ITERATIONS,
      successful_requests: times.length,
      failed_requests: errors.length
    };
    
    const performance_grade = avgTime < 100 ? 'A+' : avgTime < 500 ? 'A' : avgTime < 1000 ? 'B' : 'C';
    console.log(`     ✅ ${Math.round(avgTime)}ms avg, P95: ${Math.round(p95Time)}ms, Success: ${times.length}/${TEST_ITERATIONS} [${performance_grade}]`);
  }

  /**
   * 🗄️ TEST DATABASE PERFORMANCE
   */
  async testDatabasePerformance() {
    console.log('\\n3️⃣ Testing Database Performance...');
    
    // Test database-heavy endpoints multiple times
    const dbEndpoints = [
      { name: 'db_all_horoscopes', path: '/api/coaching/getAllHoroscopes?language=en' },
      { name: 'db_all_weekly', path: '/api/weekly/getAllWeeklyHoroscopes?language=en' }
    ];
    
    for (const endpoint of dbEndpoints) {
      const times = [];
      
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        try {
          await axios.get(`${BASE_URL}${endpoint.path}`);
          times.push(performance.now() - start);
        } catch (error) {
          console.warn(`DB test error: ${error.message}`);
        }
      }
      
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      console.log(`   ${endpoint.name}: ${Math.round(avgTime)}ms avg (${times.length} successful queries)`);
    }
  }

  /**
   * 💾 TEST CACHE PERFORMANCE
   */
  async testCachePerformance() {
    console.log('\\n4️⃣ Testing Cache Performance...');
    
    const testSign = 'aries';
    const testLang = 'en';
    
    // First request (cache miss)
    const start1 = performance.now();
    await axios.get(`${BASE_URL}/api/coaching/getDailyHoroscope?sign=${testSign}&language=${testLang}`);
    const firstRequestTime = performance.now() - start1;
    
    // Second request (should be cached)
    const start2 = performance.now();
    await axios.get(`${BASE_URL}/api/coaching/getDailyHoroscope?sign=${testSign}&language=${testLang}`);
    const secondRequestTime = performance.now() - start2;
    
    const cacheImprovement = ((firstRequestTime - secondRequestTime) / firstRequestTime) * 100;
    
    console.log(`   Cache miss: ${Math.round(firstRequestTime)}ms`);
    console.log(`   Cache hit: ${Math.round(secondRequestTime)}ms`);
    console.log(`   Improvement: ${Math.round(cacheImprovement)}%`);
    
    this.results.cache = {
      miss_time_ms: Math.round(firstRequestTime),
      hit_time_ms: Math.round(secondRequestTime),
      improvement_percent: Math.round(cacheImprovement)
    };
  }

  /**
   * 🧠 TEST MEMORY USAGE
   */
  async testMemoryUsage() {
    console.log('\\n5️⃣ Testing Memory Usage...');
    
    const initialMemory = await this.getMemoryUsage();
    console.log(`   Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    
    // Generate load
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(axios.get(`${BASE_URL}/api/coaching/getDailyHoroscope?sign=aries&language=en`));
    }
    await Promise.all(promises);
    
    const peakMemory = await this.getMemoryUsage();
    console.log(`   Peak memory: ${Math.round(peakMemory.heapUsed / 1024 / 1024)}MB`);
    
    // Wait for potential cleanup
    await this.sleep(2000);
    const finalMemory = await this.getMemoryUsage();
    console.log(`   Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    
    this.results.memory = {
      initial_mb: Math.round(initialMemory.heapUsed / 1024 / 1024),
      peak_mb: Math.round(peakMemory.heapUsed / 1024 / 1024),
      final_mb: Math.round(finalMemory.heapUsed / 1024 / 1024),
      growth_mb: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)
    };
  }

  /**
   * ⚡ TEST CONCURRENCY PERFORMANCE
   */
  async testConcurrency() {
    console.log('\\n6️⃣ Testing Concurrent Request Handling...');
    
    const concurrencyLevels = [10, 25, 50, 100];
    
    for (const concurrent of concurrencyLevels) {
      console.log(`   Testing ${concurrent} concurrent requests...`);
      
      const start = performance.now();
      const promises = [];
      
      for (let i = 0; i < concurrent; i++) {
        promises.push(
          axios.get(`${BASE_URL}/api/coaching/getDailyHoroscope?sign=aries&language=en`)
            .catch(error => ({ error: error.message }))
        );
      }
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - start;
      const successful = results.filter(r => !r.error).length;
      const avgResponseTime = totalTime; // Total time for all concurrent requests
      
      this.results.concurrency[concurrent] = {
        total_time_ms: Math.round(totalTime),
        successful_requests: successful,
        failed_requests: concurrent - successful,
        success_rate: (successful / concurrent) * 100,
        requests_per_second: Math.round((concurrent / totalTime) * 1000)
      };
      
      console.log(`     ${successful}/${concurrent} successful, ${Math.round(totalTime)}ms total, ${Math.round((concurrent/totalTime)*1000)} req/s`);
    }
  }

  /**
   * 🛡️ TEST RATE LIMITING OVERHEAD
   */
  async testRateLimitingOverhead() {
    console.log('\\n7️⃣ Testing Rate Limiting Overhead...');
    
    // Test rapid requests to measure rate limiting overhead
    const times = [];
    
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      try {
        await axios.get(`${BASE_URL}/ping`);
        times.push(performance.now() - start);
      } catch (error) {
        // Rate limited requests
        times.push(performance.now() - start);
      }
      
      // Very small delay to test rate limiting
      await this.sleep(5);
    }
    
    const avgOverhead = times.reduce((sum, t) => sum + t, 0) / times.length;
    console.log(`   Average rate limiting overhead: ${Math.round(avgOverhead)}ms`);
    
    this.results.rate_limiting_overhead_ms = Math.round(avgOverhead);
  }

  /**
   * 📊 GENERATE COMPREHENSIVE PERFORMANCE REPORT
   */
  async generateReport() {
    console.log('\\n8️⃣ Generating Performance Report...');
    
    const totalTime = Date.now() - this.startTime;
    
    console.log('\\n' + '═'.repeat(80));
    console.log('📈 COMPREHENSIVE PERFORMANCE AUDIT REPORT');
    console.log('═'.repeat(80));
    
    console.log('\\n🏆 OVERALL PERFORMANCE SUMMARY:');
    console.log(`   • Benchmark Duration: ${Math.round(totalTime/1000)}s`);
    console.log(`   • Total Endpoints Tested: ${Object.keys(this.results.endpoints).length}`);
    console.log(`   • Total Requests: ${TEST_ITERATIONS * Object.keys(this.results.endpoints).length}`);
    
    console.log('\\n⚡ BASELINE PERFORMANCE:');
    Object.entries(this.results.baseline).forEach(([name, stats]) => {
      const grade = stats.avg_ms < 10 ? 'A+' : stats.avg_ms < 50 ? 'A' : stats.avg_ms < 100 ? 'B' : 'C';
      console.log(`   • ${name}: ${stats.avg_ms}ms avg, ${stats.success_rate}% success [${grade}]`);
    });
    
    console.log('\\n🎯 API ENDPOINT PERFORMANCE:');
    Object.entries(this.results.endpoints).forEach(([name, stats]) => {
      const grade = stats.avg_ms < 100 ? 'A+' : stats.avg_ms < 500 ? 'A' : stats.avg_ms < 1000 ? 'B' : 'C';
      console.log(`   • ${name}: ${stats.avg_ms}ms avg, P95: ${stats.p95_ms}ms, Success: ${stats.success_rate}% [${grade}]`);
    });
    
    console.log('\\n💾 CACHE PERFORMANCE:');
    console.log(`   • Cache Miss: ${this.results.cache.miss_time_ms}ms`);
    console.log(`   • Cache Hit: ${this.results.cache.hit_time_ms}ms`);
    console.log(`   • Performance Improvement: ${this.results.cache.improvement_percent}%`);
    
    console.log('\\n🧠 MEMORY ANALYSIS:');
    console.log(`   • Initial: ${this.results.memory.initial_mb}MB`);
    console.log(`   • Peak: ${this.results.memory.peak_mb}MB`);
    console.log(`   • Final: ${this.results.memory.final_mb}MB`);
    console.log(`   • Growth: ${this.results.memory.growth_mb}MB`);
    
    console.log('\\n⚡ CONCURRENCY PERFORMANCE:');
    Object.entries(this.results.concurrency).forEach(([level, stats]) => {
      console.log(`   • ${level} concurrent: ${stats.requests_per_second} req/s, ${stats.success_rate}% success`);
    });
    
    console.log('\\n🛡️ RATE LIMITING:');
    console.log(`   • Average Overhead: ${this.results.rate_limiting_overhead_ms}ms`);
    
    // Generate recommendations
    this.generateRecommendations();
    
    console.log('\\n💡 OPTIMIZATION RECOMMENDATIONS:');
    this.results.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    
    console.log('\\n' + '═'.repeat(80));
    console.log('✅ Performance audit completed successfully!');
    console.log('═'.repeat(80));
  }

  /**
   * 🎯 GENERATE OPTIMIZATION RECOMMENDATIONS
   */
  generateRecommendations() {
    const recs = [];
    
    // Analyze baseline performance
    const healthAvg = this.results.baseline.health?.avg_ms || 0;
    if (healthAvg > 50) {
      recs.push(`Health endpoint averaging ${healthAvg}ms - consider optimizing health checks`);
    }
    
    // Analyze API performance
    Object.entries(this.results.endpoints).forEach(([name, stats]) => {
      if (stats.avg_ms > 1000) {
        recs.push(`${name} endpoint averaging ${stats.avg_ms}ms - requires immediate optimization`);
      } else if (stats.avg_ms > 500) {
        recs.push(`${name} endpoint averaging ${stats.avg_ms}ms - consider optimization`);
      }
      
      if (stats.error_rate > 5) {
        recs.push(`${name} endpoint has ${stats.error_rate}% error rate - investigate failures`);
      }
    });
    
    // Cache analysis
    if (this.results.cache.improvement_percent < 30) {
      recs.push(`Cache improvement only ${this.results.cache.improvement_percent}% - optimize caching strategy`);
    }
    
    // Memory analysis
    if (this.results.memory.growth_mb > 10) {
      recs.push(`Memory growth of ${this.results.memory.growth_mb}MB detected - investigate memory leaks`);
    }
    
    // Concurrency analysis
    const maxConcurrency = Math.max(...Object.keys(this.results.concurrency).map(Number));
    const maxConcurrencyStats = this.results.concurrency[maxConcurrency];
    if (maxConcurrencyStats.success_rate < 95) {
      recs.push(`Concurrency issues at ${maxConcurrency} requests - success rate ${maxConcurrencyStats.success_rate}%`);
    }
    
    // Rate limiting
    if (this.results.rate_limiting_overhead_ms > 10) {
      recs.push(`Rate limiting overhead ${this.results.rate_limiting_overhead_ms}ms - optimize middleware`);
    }
    
    // General recommendations
    recs.push('Implement response compression for large payloads');
    recs.push('Add database connection pooling optimization');
    recs.push('Consider implementing Redis for distributed caching');
    recs.push('Add APM monitoring for real-time performance tracking');
    recs.push('Implement circuit breakers for external API calls');
    
    this.results.recommendations = recs;
  }

  // UTILITY METHODS
  
  async getMemoryUsage() {
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      return response.data.memory;
    } catch (error) {
      return { heapUsed: 0, heapTotal: 0 };
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Run the benchmark if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runBenchmark().catch(console.error);
}

module.exports = PerformanceBenchmark;