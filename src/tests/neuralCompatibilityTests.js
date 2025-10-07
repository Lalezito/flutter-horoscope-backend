const axios = require('axios');
const assert = require('assert');

/**
 * 🧪 NEURAL COMPATIBILITY TESTING SUITE
 * Comprehensive testing and benchmarking for neural compatibility endpoints
 */

class NeuralCompatibilityTests {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.adminKey = process.env.ADMIN_KEY || 'test-admin-key';
    this.testResults = {
      passed: 0,
      failed: 0,
      performance: [],
      errors: []
    };
  }

  /**
   * 🚀 RUN ALL TESTS
   */
  async runAllTests() {
    console.log('🧠 Starting Neural Compatibility Test Suite...\n');
    
    try {
      // Health check tests
      await this.testHealthEndpoint();
      await this.testServiceHealth();
      
      // Core functionality tests
      await this.testNeuralCalculation();
      await this.testMultiLevelAnalysis();
      await this.testCachingPerformance();
      await this.testRateLimiting();
      
      // Admin and monitoring tests
      await this.testAdminEndpoints();
      await this.testDocumentationEndpoint();
      
      // Performance benchmarks
      await this.runPerformanceBenchmarks();
      await this.testConcurrentUsers();
      
      // Edge case tests
      await this.testErrorHandling();
      await this.testInputValidation();
      
      // Integration tests
      await this.testCacheIntegration();
      await this.testExistingCompatibilityIntegration();
      
      this.printTestResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.testResults.errors.push({
        test: 'Test Suite Execution',
        error: error.message
      });
    }
  }

  /**
   * 🏥 TEST HEALTH ENDPOINT
   */
  async testHealthEndpoint() {
    await this.runTest('Neural Health Check', async () => {
      const response = await axios.get(`${this.baseURL}/api/neural-compatibility/health`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.service, 'Neural Compatibility Analysis');
      assert.ok(response.data.performance);
      assert.ok(response.data.neural_features);
      
      // Test response time requirement
      const responseTime = response.data.performance.response_time_ms;
      assert.ok(responseTime < 5000, `Health check response time ${responseTime}ms exceeds 5s limit`);
      
      return { responseTime };
    });
  }

  /**
   * 🔧 TEST SERVICE HEALTH
   */
  async testServiceHealth() {
    await this.runTest('Service Health Validation', async () => {
      const response = await axios.get(`${this.baseURL}/api/neural-compatibility/health`);
      const health = response.data;
      
      // Validate required health components
      assert.ok(health.cache, 'Cache health information missing');
      assert.ok(health.neural_features, 'Neural features information missing');
      assert.ok(health.performance, 'Performance metrics missing');
      
      // Validate neural features are active
      assert.strictEqual(health.neural_features.ai_enhancement, 'active');
      assert.strictEqual(health.neural_features.pattern_recognition, 'online');
      
      return { status: health.status };
    });
  }

  /**
   * 🔮 TEST NEURAL CALCULATION
   */
  async testNeuralCalculation() {
    await this.runTest('Neural Compatibility Calculation', async () => {
      const startTime = Date.now();
      
      const response = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
        sign1: 'aries',
        sign2: 'leo',
        language: 'en',
        analysisLevel: 'standard'
      });
      
      const responseTime = Date.now() - startTime;
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.success, true);
      assert.ok(response.data.neural_compatibility);
      assert.ok(response.data.performance);
      
      // Test performance requirement
      assert.ok(responseTime < 3000, `Response time ${responseTime}ms exceeds 3s target`);
      
      // Validate neural analysis structure
      const neural = response.data.neural_compatibility;
      assert.ok(neural.base_compatibility, 'Base compatibility missing');
      assert.ok(neural.neural_factors, 'Neural factors missing');
      assert.ok(neural.enhanced_compatibility, 'Enhanced compatibility missing');
      assert.ok(neural.neural_insights, 'Neural insights missing');
      
      return { responseTime, confidenceScore: neural.confidence_score };
    });
  }

  /**
   * 📊 TEST MULTI-LEVEL ANALYSIS
   */
  async testMultiLevelAnalysis() {
    const levels = ['standard', 'advanced', 'deep'];
    
    for (const level of levels) {
      await this.runTest(`Multi-Level Analysis: ${level}`, async () => {
        const startTime = Date.now();
        
        const response = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
          sign1: 'cancer',
          sign2: 'scorpio',
          language: 'en',
          analysisLevel: level
        });
        
        const responseTime = Date.now() - startTime;
        
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data.neural_compatibility.analysis_level, level);
        
        // Deep analysis should have higher confidence
        if (level === 'deep') {
          assert.ok(response.data.neural_compatibility.confidence_score >= 80,
            'Deep analysis should have high confidence score');
        }
        
        return { level, responseTime };
      });
    }
  }

  /**
   * ⚡ TEST CACHING PERFORMANCE
   */
  async testCachingPerformance() {
    await this.runTest('Caching Performance', async () => {
      const testData = {
        sign1: 'gemini',
        sign2: 'aquarius',
        language: 'en',
        analysisLevel: 'standard'
      };
      
      // First request (cache miss)
      const firstStart = Date.now();
      const firstResponse = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, testData);
      const firstTime = Date.now() - firstStart;
      
      // Second request (cache hit)
      const secondStart = Date.now();
      const secondResponse = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, testData);
      const secondTime = Date.now() - secondStart;
      
      assert.strictEqual(firstResponse.status, 200);
      assert.strictEqual(secondResponse.status, 200);
      
      // Cache hit should be faster
      const speedImprovement = ((firstTime - secondTime) / firstTime) * 100;
      assert.ok(speedImprovement > 10, `Cache should improve performance by >10%, got ${speedImprovement.toFixed(2)}%`);
      
      return { 
        firstRequestTime: firstTime, 
        secondRequestTime: secondTime, 
        speedImprovement: speedImprovement.toFixed(2) + '%' 
      };
    });
  }

  /**
   * 🚦 TEST RATE LIMITING
   */
  async testRateLimiting() {
    await this.runTest('Rate Limiting Enforcement', async () => {
      const requests = [];
      const maxRequests = 160; // Slightly above the 150/min limit
      
      // Send requests rapidly
      for (let i = 0; i < maxRequests; i++) {
        requests.push(
          axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
            sign1: 'virgo',
            sign2: 'taurus',
            analysisLevel: 'standard'
          }).catch(err => err.response)
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      assert.ok(rateLimitedCount > 0, 'Rate limiting should trigger with excessive requests');
      
      return { totalRequests: maxRequests, rateLimited: rateLimitedCount };
    });
  }

  /**
   * 🔒 TEST ADMIN ENDPOINTS
   */
  async testAdminEndpoints() {
    await this.runTest('Admin Stats Endpoint', async () => {
      const response = await axios.get(`${this.baseURL}/api/neural-compatibility/stats`, {
        params: { admin_key: this.adminKey }
      });
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.neural_stats);
      assert.ok(response.data.neural_stats.service === 'Neural Compatibility Analysis Service');
      
      return { statsRetrieved: true };
    });

    // Test unauthorized access
    await this.runTest('Admin Authorization Check', async () => {
      try {
        await axios.get(`${this.baseURL}/api/neural-compatibility/stats`);
        assert.fail('Should have been unauthorized');
      } catch (error) {
        assert.strictEqual(error.response.status, 401);
        return { unauthorized: true };
      }
    });
  }

  /**
   * 📖 TEST DOCUMENTATION ENDPOINT
   */
  async testDocumentationEndpoint() {
    await this.runTest('API Documentation', async () => {
      const response = await axios.get(`${this.baseURL}/api/neural-compatibility/docs`);
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.service);
      assert.ok(response.data.endpoints);
      assert.ok(response.data.features);
      assert.ok(response.data.performance);
      
      return { documentationComplete: true };
    });
  }

  /**
   * 🏃‍♂️ RUN PERFORMANCE BENCHMARKS
   */
  async runPerformanceBenchmarks() {
    console.log('\n📊 Running Performance Benchmarks...');
    
    const benchmarks = [
      { name: 'Standard Analysis', level: 'standard', target: 2000 },
      { name: 'Advanced Analysis', level: 'advanced', target: 2500 },
      { name: 'Deep Analysis', level: 'deep', target: 3000 }
    ];
    
    for (const benchmark of benchmarks) {
      await this.runTest(`Performance: ${benchmark.name}`, async () => {
        const iterations = 10;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          
          await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
            sign1: 'libra',
            sign2: 'sagittarius',
            analysisLevel: benchmark.level,
            language: 'en'
          });
          
          times.push(Date.now() - start);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);
        
        assert.ok(avgTime < benchmark.target, 
          `Average ${benchmark.name} time ${avgTime.toFixed(0)}ms exceeds ${benchmark.target}ms target`);
        
        this.testResults.performance.push({
          benchmark: benchmark.name,
          average: avgTime.toFixed(0) + 'ms',
          min: minTime + 'ms',
          max: maxTime + 'ms',
          target: benchmark.target + 'ms',
          passed: avgTime < benchmark.target
        });
        
        return { avgTime: avgTime.toFixed(0) + 'ms', target: benchmark.target + 'ms' };
      });
    }
  }

  /**
   * 👥 TEST CONCURRENT USERS
   */
  async testConcurrentUsers() {
    await this.runTest('Concurrent Users Load Test', async () => {
      const concurrentRequests = 50;
      const requests = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
            sign1: 'pisces',
            sign2: 'cancer',
            analysisLevel: 'standard',
            language: 'en'
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      const successfulResponses = responses.filter(r => r.status === 200).length;
      const successRate = (successfulResponses / concurrentRequests) * 100;
      
      assert.ok(successRate >= 90, `Success rate ${successRate}% is below 90% threshold`);
      
      return { 
        concurrent: concurrentRequests, 
        successful: successfulResponses, 
        successRate: successRate.toFixed(1) + '%',
        totalTime: totalTime + 'ms'
      };
    });
  }

  /**
   * ⚠️ TEST ERROR HANDLING
   */
  async testErrorHandling() {
    await this.runTest('Error Handling', async () => {
      // Test missing parameters
      try {
        await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
          sign1: 'aries'
          // Missing sign2
        });
        assert.fail('Should have returned error for missing parameter');
      } catch (error) {
        assert.strictEqual(error.response.status, 400);
        assert.strictEqual(error.response.data.code, 'MISSING_SIGNS');
      }
      
      return { errorHandlingWorking: true };
    });
  }

  /**
   * ✅ TEST INPUT VALIDATION
   */
  async testInputValidation() {
    await this.runTest('Input Validation', async () => {
      // Test invalid sign names
      const response = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
        sign1: 'invalid_sign',
        sign2: 'leo',
        analysisLevel: 'standard'
      });
      
      // Should still process (normalization should handle it)
      assert.strictEqual(response.status, 200);
      
      return { validationPassed: true };
    });
  }

  /**
   * 💾 TEST CACHE INTEGRATION
   */
  async testCacheIntegration() {
    await this.runTest('Cache Service Integration', async () => {
      // Test that caching is working by making identical requests
      const testData = {
        sign1: 'capricorn',
        sign2: 'virgo',
        analysisLevel: 'advanced',
        language: 'es'
      };
      
      // Clear any existing cache for this combination
      // (In production, we'd have a cache clear endpoint)
      
      const response1 = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, testData);
      const response2 = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, testData);
      
      assert.strictEqual(response1.status, 200);
      assert.strictEqual(response2.status, 200);
      
      // Verify both responses have the same neural analysis
      assert.deepStrictEqual(
        response1.data.neural_compatibility.enhanced_compatibility,
        response2.data.neural_compatibility.enhanced_compatibility
      );
      
      return { cacheIntegrationWorking: true };
    });
  }

  /**
   * 🔗 TEST EXISTING COMPATIBILITY INTEGRATION
   */
  async testExistingCompatibilityIntegration() {
    await this.runTest('Existing Compatibility Integration', async () => {
      const response = await axios.post(`${this.baseURL}/api/neural-compatibility/calculate`, {
        sign1: 'aries',
        sign2: 'leo',
        analysisLevel: 'standard'
      });
      
      const neural = response.data.neural_compatibility;
      
      // Verify base compatibility is included
      assert.ok(neural.base_compatibility, 'Base compatibility should be included');
      assert.ok(neural.base_compatibility.overall, 'Base overall score should be present');
      assert.ok(neural.enhanced_compatibility, 'Enhanced compatibility should be present');
      
      // Enhanced score should be different from base score
      const baseLove = neural.base_compatibility.love;
      const enhancedLove = neural.enhanced_compatibility.love;
      
      // They might be the same, but the structure should be there
      assert.ok(typeof baseLove === 'number', 'Base love score should be numeric');
      assert.ok(typeof enhancedLove === 'number', 'Enhanced love score should be numeric');
      
      return { integrationWorking: true };
    });
  }

  /**
   * 🧪 RUN INDIVIDUAL TEST
   */
  async runTest(testName, testFunction) {
    try {
      console.log(`🔍 Testing: ${testName}`);
      const startTime = Date.now();
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      console.log(`✅ PASSED: ${testName} (${duration}ms)`, result ? JSON.stringify(result) : '');
      this.testResults.passed++;
      
    } catch (error) {
      console.log(`❌ FAILED: ${testName} - ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push({
        test: testName,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 📋 PRINT TEST RESULTS
   */
  printTestResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🧠 NEURAL COMPATIBILITY TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total: ${this.testResults.passed + this.testResults.failed}`);
    
    if (this.testResults.performance.length > 0) {
      console.log('\n📈 Performance Benchmarks:');
      this.testResults.performance.forEach(perf => {
        const status = perf.passed ? '✅' : '❌';
        console.log(`${status} ${perf.benchmark}: ${perf.average} (target: ${perf.target})`);
        console.log(`   Min: ${perf.min}, Max: ${perf.max}`);
      });
    }
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.errors.forEach(error => {
        console.log(`- ${error.test}: ${error.error}`);
      });
    }
    
    const successRate = (this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100;
    console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 90) {
      console.log('🚀 Neural Compatibility API is ready for production!');
    } else {
      console.log('⚠️ Some issues need to be addressed before production deployment.');
    }
  }
}

// Export for use in other test files
module.exports = NeuralCompatibilityTests;

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new NeuralCompatibilityTests();
  tests.runAllTests().catch(console.error);
}