/**
 * Artillery Load Test Processor
 * Custom functions for advanced load testing scenarios
 */

module.exports = {
  // Set up test context and variables
  setUpTest: function(requestParams, context, ee, next) {
    // Generate unique session ID for tracking
    context.vars.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up authentication headers if needed
    if (process.env.API_KEY) {
      context.vars.apiKey = process.env.API_KEY;
    }
    
    // Initialize performance tracking
    context.vars.startTime = Date.now();
    
    return next();
  },

  // Log response times for custom analysis
  logResponseTime: function(requestParams, response, context, ee, next) {
    const responseTime = Date.now() - context.vars.requestStartTime;
    
    // Emit custom metrics
    ee.emit('customStat', {
      stat: 'response_time',
      value: responseTime,
      endpoint: requestParams.url || 'unknown',
      statusCode: response.statusCode
    });
    
    // Log slow requests
    if (responseTime > 2000) {
      console.log(`🐌 Slow request detected: ${requestParams.url} took ${responseTime}ms`);
    }
    
    return next();
  },

  // Track errors and their types
  trackErrors: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 400) {
      // Categorize error types
      let errorType = 'unknown_error';
      
      if (response.statusCode >= 400 && response.statusCode < 500) {
        errorType = 'client_error';
      } else if (response.statusCode >= 500) {
        errorType = 'server_error';
      }
      
      if (response.statusCode === 429) {
        errorType = 'rate_limit';
      } else if (response.statusCode === 503) {
        errorType = 'service_unavailable';
      } else if (response.statusCode === 504) {
        errorType = 'timeout';
      }
      
      // Emit custom error metrics
      ee.emit('customStat', {
        stat: 'error_type',
        value: 1,
        type: errorType,
        endpoint: requestParams.url,
        statusCode: response.statusCode
      });
      
      // Log detailed error information
      console.log(`❌ Error ${response.statusCode}: ${errorType} on ${requestParams.url}`);
      
      if (response.body) {
        try {
          const errorBody = JSON.parse(response.body);
          if (errorBody.error) {
            console.log(`   Error details: ${errorBody.error}`);
          }
        } catch (e) {
          // Body is not JSON, ignore
        }
      }
    }
    
    return next();
  },

  // Custom think time based on user behavior patterns
  dynamicThinkTime: function(context, next) {
    // Simulate realistic user behavior
    const userType = Math.random();
    let thinkTime = 1000; // Default 1 second
    
    if (userType < 0.3) {
      // Fast users (30%)
      thinkTime = Math.random() * 500 + 200; // 200-700ms
    } else if (userType < 0.8) {
      // Normal users (50%)
      thinkTime = Math.random() * 2000 + 1000; // 1-3 seconds
    } else {
      // Slow users (20%)
      thinkTime = Math.random() * 5000 + 3000; // 3-8 seconds
    }
    
    context.vars.thinkTime = Math.round(thinkTime);
    
    return next();
  },

  // Generate realistic zodiac sign preferences (some signs are more popular)
  getPopularZodiacSign: function(context, next) {
    const popularSigns = {
      'leo': 15,        // Most popular
      'scorpio': 12,
      'gemini': 10,
      'aries': 10,
      'libra': 8,
      'cancer': 8,
      'aquarius': 7,
      'pisces': 7,
      'sagittarius': 6,
      'virgo': 6,
      'taurus': 6,
      'capricorn': 5    // Least popular
    };
    
    // Weighted random selection
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (const [sign, weight] of Object.entries(popularSigns)) {
      cumulative += weight;
      if (rand <= cumulative) {
        context.vars.zodiacSign = sign;
        break;
      }
    }
    
    return next();
  },

  // Simulate different language preferences based on geographic distribution
  getRealisticLanguage: function(context, next) {
    const languageDistribution = {
      'en': 60,  // English - most common
      'es': 20,  // Spanish
      'fr': 8,   // French
      'de': 5,   // German
      'it': 4,   // Italian
      'pt': 3    // Portuguese
    };
    
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (const [lang, weight] of Object.entries(languageDistribution)) {
      cumulative += weight;
      if (rand <= cumulative) {
        context.vars.language = lang;
        break;
      }
    }
    
    return next();
  },

  // Set request start time for response time tracking
  setRequestStartTime: function(requestParams, context, ee, next) {
    context.vars.requestStartTime = Date.now();
    return next();
  },

  // Validate response data structure
  validateResponse: function(requestParams, response, context, ee, next) {
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.body);
        
        // Validate horoscope response structure
        if (requestParams.url.includes('/getDailyHoroscope')) {
          if (!data.horoscope || !data.sign || !data.date) {
            console.log(`⚠️ Invalid daily horoscope response structure: ${requestParams.url}`);
            ee.emit('customStat', {
              stat: 'validation_error',
              value: 1,
              type: 'invalid_structure',
              endpoint: 'daily_horoscope'
            });
          }
        }
        
        if (requestParams.url.includes('/getWeeklyHoroscope')) {
          if (!data.horoscope || !data.sign || !data.week_start) {
            console.log(`⚠️ Invalid weekly horoscope response structure: ${requestParams.url}`);
            ee.emit('customStat', {
              stat: 'validation_error',
              value: 1,
              type: 'invalid_structure',
              endpoint: 'weekly_horoscope'
            });
          }
        }
        
        // Check for empty content
        if (data.horoscope && data.horoscope.length < 50) {
          console.log(`⚠️ Suspiciously short horoscope content: ${data.horoscope.length} chars`);
          ee.emit('customStat', {
            stat: 'content_quality',
            value: 1,
            type: 'short_content',
            length: data.horoscope.length
          });
        }
        
      } catch (error) {
        console.log(`❌ Response parsing error: ${error.message}`);
        ee.emit('customStat', {
          stat: 'validation_error',
          value: 1,
          type: 'parsing_error',
          endpoint: requestParams.url
        });
      }
    }
    
    return next();
  },

  // Memory and performance monitoring
  checkMemoryUsage: function(context, next) {
    const memUsage = process.memoryUsage();
    
    // Log high memory usage
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      console.log(`🧠 High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    // Store in context for potential use
    context.vars.memoryUsage = memUsage;
    
    return next();
  },

  // Generate test report summary
  generateTestSummary: function(stats, done) {
    const summary = {
      test_completed_at: new Date().toISOString(),
      total_requests: stats.requestsCompleted || 0,
      total_errors: stats.errors || 0,
      error_rate: stats.requestsCompleted > 0 ? 
        ((stats.errors || 0) / stats.requestsCompleted * 100).toFixed(2) + '%' : '0%',
      average_response_time: stats.latency ? 
        Math.round(stats.latency.median) + 'ms' : 'N/A',
      p95_response_time: stats.latency ? 
        Math.round(stats.latency.p95) + 'ms' : 'N/A',
      p99_response_time: stats.latency ? 
        Math.round(stats.latency.p99) + 'ms' : 'N/A',
      requests_per_second: stats.rps ? 
        Math.round(stats.rps.mean) : 'N/A'
    };
    
    console.log('\n📊 Load Test Summary:');
    console.log('======================');
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`${key.replace(/_/g, ' ').toUpperCase()}: ${value}`);
    });
    
    // Write summary to file for CI/CD processing
    const fs = require('fs');
    fs.writeFileSync('load-test-summary.json', JSON.stringify(summary, null, 2));
    
    done();
  },

  // Advanced scenario: Simulate realistic user journey
  simulateUserJourney: function(context, next) {
    // Set user journey type
    const journeyTypes = [
      'quick_check',      // 40% - Just check daily horoscope
      'deep_dive',        // 30% - Check daily + weekly
      'browser',          // 20% - Browse multiple signs
      'comparison'        // 10% - Compare compatibility
    ];
    
    const weights = [40, 30, 20, 10];
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < journeyTypes.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        context.vars.userJourney = journeyTypes[i];
        break;
      }
    }
    
    // Set journey-specific variables
    switch (context.vars.userJourney) {
      case 'quick_check':
        context.vars.maxRequests = 1;
        context.vars.avgThinkTime = 500;
        break;
      case 'deep_dive':
        context.vars.maxRequests = 3;
        context.vars.avgThinkTime = 2000;
        break;
      case 'browser':
        context.vars.maxRequests = 5;
        context.vars.avgThinkTime = 1500;
        break;
      case 'comparison':
        context.vars.maxRequests = 4;
        context.vars.avgThinkTime = 3000;
        break;
    }
    
    return next();
  }
};