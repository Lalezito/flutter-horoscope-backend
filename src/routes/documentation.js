const express = require("express");
const router = express.Router();
const SwaggerService = require("../services/swaggerService");
const APIVersioningService = require("../services/versioningService");
const { responseFormatterMiddleware } = require("../middleware/responseFormatter");

/**
 * 📖 COMPREHENSIVE API DOCUMENTATION ROUTES
 * Enhanced documentation endpoints with Swagger/OpenAPI integration
 */

// Apply response formatter middleware
router.use(responseFormatterMiddleware);

/**
 * 🏠 MAIN API DOCUMENTATION ENDPOINT (Enhanced)
 * GET /api/docs
 */
router.get('/api/docs', (req, res) => {
  const documentation = {
    name: 'Zodiac Backend API',
    version: '2.0.0',
    description: 'Enhanced horoscope backend with weekly predictions, neural compatibility, and production features',
    status: 'production',
    uptime: process.uptime(),
    
    // API Overview
    overview: {
      totalEndpoints: 25,
      publicEndpoints: 18,
      adminEndpoints: 7,
      supportedLanguages: ['en', 'es', 'de', 'fr', 'it', 'pt'],
      authenticationMethods: ['API Key (admin_key)'],
      responseFormat: 'JSON',
      versioning: 'Path-based (/api/v2/) and Header-based'
    },

    // Enhanced Endpoints Documentation  
    endpoints: {
      health: {
        'GET /health': {
          description: 'System health check with service status',
          public: true,
          rateLimit: 'unlimited',
          responseTime: '<100ms',
          example: 'curl http://localhost:3000/health'
        },
        'GET /ping': {
          description: 'Simple availability check',
          public: true,
          rateLimit: 'unlimited',
          responseTime: '<50ms',
          example: 'curl http://localhost:3000/ping'
        },
        'GET /api/admin/health': {
          description: 'Comprehensive admin health check',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '20/minute',
          responseTime: '<200ms',
          example: 'curl "http://localhost:3000/api/admin/health?admin_key=YOUR_KEY"'
        }
      },

      horoscopes: {
        'GET /api/coaching/getDailyHoroscope': {
          description: 'Get daily horoscope for zodiac sign',
          public: true,
          parameters: ['sign (required)', 'language (optional)'],
          rateLimit: '200/minute',
          responseTime: '<150ms',
          dataSource: 'database (generated daily at 6 AM)',
          example: 'curl "http://localhost:3000/api/coaching/getDailyHoroscope?sign=aries&language=en"'
        },
        'GET /api/coaching/getAllHoroscopes': {
          description: 'Get all daily horoscopes',
          public: true,
          parameters: ['language (optional)'],
          rateLimit: '200/minute',
          responseTime: '<300ms',
          example: 'curl "http://localhost:3000/api/coaching/getAllHoroscopes?language=en"'
        },
        'GET /api/weekly/getWeeklyHoroscope': {
          description: 'Get weekly horoscope for zodiac sign',
          public: true,
          parameters: ['sign (required)', 'language (optional)'],
          rateLimit: '200/minute',
          responseTime: '<150ms',
          dataSource: 'database (generated Monday 5:30 AM)',
          example: 'curl "http://localhost:3000/api/weekly/getWeeklyHoroscope?sign=leo&language=es"'
        },
        'GET /api/weekly/getAllWeeklyHoroscopes': {
          description: 'Get all weekly horoscopes',
          public: true,
          parameters: ['language (optional)'],
          rateLimit: '200/minute',
          responseTime: '<400ms',
          example: 'curl "http://localhost:3000/api/weekly/getAllWeeklyHoroscopes"'
        }
      },

      compatibility: {
        'GET /api/compatibility/calculate': {
          description: 'Calculate compatibility between two zodiac signs',
          public: true,
          parameters: ['sign1 (required)', 'sign2 (required)', 'language (optional)'],
          rateLimit: '200/minute',
          responseTime: '<100ms',
          algorithm: 'Traditional astrological compatibility matrix',
          example: 'curl "http://localhost:3000/api/compatibility/calculate?sign1=aries&sign2=leo&language=en"'
        },
        'GET /api/compatibility/sign/:sign': {
          description: 'Get all compatibility combinations for a zodiac sign',
          public: true,
          parameters: ['sign (path)', 'language (optional)'],
          rateLimit: '200/minute',
          responseTime: '<150ms',
          example: 'curl "http://localhost:3000/api/compatibility/sign/virgo?language=fr"'
        },
        'POST /api/compatibility/analysis': {
          description: 'Get detailed compatibility analysis',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '200/minute',
          responseTime: '<200ms',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"sign1":"gemini","sign2":"libra","language":"en","includeAdvice":true}\' http://localhost:3000/api/compatibility/analysis'
        },
        'POST /api/compatibility/insights': {
          description: 'Get compatibility insights and advice',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '200/minute',
          responseTime: '<250ms',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"sign1":"cancer","sign2":"scorpio","language":"en","type":"relationship"}\' http://localhost:3000/api/compatibility/insights'
        },
        'GET /api/compatibility/stats': {
          description: 'Get compatibility service statistics (admin)',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '20/minute',
          responseTime: '<100ms',
          example: 'curl "http://localhost:3000/api/compatibility/stats?admin_key=YOUR_KEY"'
        }
      },

      neural_compatibility: {
        'POST /api/neural-compatibility/calculate': {
          description: 'AI-enhanced compatibility analysis with neural networks',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '50/minute',
          responseTime: '<3000ms (guaranteed sub-3s)',
          confidence: '92%+ accuracy',
          algorithm: 'Advanced neural network with contextual analysis',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"sign1":"aries","sign2":"leo","analysisLevel":"standard"}\' http://localhost:3000/api/neural-compatibility/calculate'
        },
        'GET /api/neural-compatibility/history/:userId': {
          description: 'Get user neural compatibility history',
          public: true,
          parameters: ['userId (path)'],
          rateLimit: '50/minute',
          responseTime: '<200ms',
          example: 'curl http://localhost:3000/api/neural-compatibility/history/user123'
        },
        'POST /api/neural-compatibility/insights': {
          description: 'Generate contextual neural compatibility insights',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '50/minute',
          responseTime: '<2000ms',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"sign1":"taurus","sign2":"capricorn","contextFactors":{"relationshipType":"romantic"}}\' http://localhost:3000/api/neural-compatibility/insights'
        },
        'POST /api/neural-compatibility/deep-analysis': {
          description: 'Deep neural analysis (premium feature)',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '20/minute',
          responseTime: '<5000ms',
          premiumFeature: true,
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"sign1":"scorpio","sign2":"pisces","analysisLevel":"deep"}\' http://localhost:3000/api/neural-compatibility/deep-analysis'
        },
        'GET /api/neural-compatibility/health': {
          description: 'Neural service health check',
          public: true,
          rateLimit: '100/minute',
          responseTime: '<100ms',
          example: 'curl http://localhost:3000/api/neural-compatibility/health'
        },
        'GET /api/neural-compatibility/stats': {
          description: 'Neural service statistics (admin)',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '20/minute',
          responseTime: '<150ms',
          example: 'curl "http://localhost:3000/api/neural-compatibility/stats?admin_key=YOUR_KEY"'
        }
      },

      generation: {
        'POST /api/generate/daily': {
          description: 'Manually generate daily horoscopes (admin)',
          public: false,
          method: 'POST',
          authentication: 'admin_key required',
          rateLimit: '5/minute',
          responseTime: '<30000ms',
          cost: 'OpenAI API usage',
          example: 'curl -X POST "http://localhost:3000/api/generate/daily?admin_key=YOUR_KEY"'
        },
        'POST /api/generate/weekly': {
          description: 'Manually generate weekly horoscopes (admin)',
          public: false,
          method: 'POST',
          authentication: 'admin_key required',
          rateLimit: '3/minute',
          responseTime: '<45000ms',
          cost: 'OpenAI API usage',
          example: 'curl -X POST "http://localhost:3000/api/generate/weekly?admin_key=YOUR_KEY"'
        },
        'GET /api/generate/status': {
          description: 'Get generation status (admin)',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '20/minute',
          responseTime: '<200ms',
          example: 'curl "http://localhost:3000/api/generate/status?admin_key=YOUR_KEY"'
        },
        'POST /api/generate/test': {
          description: 'Test OpenAI connection (admin)',
          public: false,
          method: 'POST',
          authentication: 'admin_key required',
          rateLimit: '10/minute',
          responseTime: '<10000ms',
          example: 'curl -X POST "http://localhost:3000/api/generate/test?admin_key=YOUR_KEY"'
        }
      },

      receipts: {
        'POST /api/receipts/validate': {
          description: 'Validate App Store receipt',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '100/minute',
          responseTime: '<2000ms',
          integration: 'iOS App Store',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"receiptData":"base64_encoded_receipt","userId":"user123"}\' http://localhost:3000/api/receipts/validate'
        },
        'POST /api/receipts/subscription/status': {
          description: 'Check subscription status',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '100/minute',
          responseTime: '<1500ms',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"receiptData":"base64_encoded_receipt"}\' http://localhost:3000/api/receipts/subscription/status'
        },
        'POST /api/receipts/user/status': {
          description: 'Get user premium status',
          public: true,
          method: 'POST',
          contentType: 'application/json',
          rateLimit: '200/minute',
          responseTime: '<500ms',
          example: 'curl -X POST -H "Content-Type: application/json" -d \'{"userId":"user123"}\' http://localhost:3000/api/receipts/user/status'
        },
        'GET /api/receipts/test': {
          description: 'Test receipt validation config (admin)',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '10/minute',
          responseTime: '<1000ms',
          example: 'curl "http://localhost:3000/api/receipts/test?admin_key=YOUR_KEY"'
        }
      },

      admin: {
        'GET /api/admin/analytics': {
          description: 'System analytics (admin)',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '20/minute',
          responseTime: '<500ms',
          example: 'curl "http://localhost:3000/api/admin/analytics?admin_key=YOUR_KEY"'
        },
        'POST /api/admin/force-weekly': {
          description: 'Force weekly horoscope generation (admin)',
          public: false,
          method: 'POST',
          authentication: 'admin_key required',
          rateLimit: '3/minute',
          responseTime: '<60000ms',
          example: 'curl -X POST "http://localhost:3000/api/admin/force-weekly?admin_key=YOUR_KEY"'
        },
        'POST /api/admin/cleanup': {
          description: 'System cleanup (admin)',
          public: false,
          method: 'POST',
          authentication: 'admin_key required',
          rateLimit: '5/minute',
          responseTime: '<5000ms',
          example: 'curl -X POST "http://localhost:3000/api/admin/cleanup?admin_key=YOUR_KEY"'
        },
        'GET /api/admin/system-status': {
          description: 'Detailed system status (admin)',
          public: false,
          authentication: 'admin_key required',
          rateLimit: '20/minute',
          responseTime: '<300ms',
          example: 'curl "http://localhost:3000/api/admin/system-status?admin_key=YOUR_KEY"'
        }
      },

      monitoring: {
        'GET /api/monitoring/dashboard': {
          description: 'Real-time monitoring dashboard',
          public: true,
          rateLimit: '100/minute',
          responseTime: '<200ms',
          example: 'curl http://localhost:3000/api/monitoring/dashboard'
        },
        'GET /api/monitoring/metrics': {
          description: 'System performance metrics',
          public: true,
          rateLimit: '100/minute',
          responseTime: '<150ms',
          example: 'curl http://localhost:3000/api/monitoring/metrics'
        }
      }
    },

    // Enhanced Features List
    features: [
      'Daily and weekly horoscope management with automated generation',
      'Traditional zodiac sign compatibility analysis',
      'AI-enhanced neural compatibility analysis (sub-3s, 92%+ confidence)',
      'Multi-level neural analysis (standard/advanced/deep)',
      'Real-time neural processing with performance guarantees',
      'Automatic content generation with OpenAI GPT-4 integration',
      'App Store receipt validation for in-app purchases',
      'Production-grade monitoring and alerting systems',
      'Automatic recovery and fallback mechanisms',
      'Advanced rate limiting with adaptive thresholds',
      'Comprehensive analytics and structured logging',
      'Admin panel for system management and control',
      'Automated cron jobs for scheduled tasks',
      'Railway-optimized deployment configuration',
      'Multi-language support (6 languages: EN, ES, DE, FR, IT, PT)',
      'Real-time compatibility calculations',
      'Circuit breakers for external service protection',
      'Redis caching with in-memory fallback',
      'Firebase integration with development fallback',
      'Unified API response formats',
      'Comprehensive error handling and logging',
      'OpenAPI/Swagger documentation',
      'API versioning with backward compatibility',
      'Performance optimization and monitoring'
    ],

    // Technical Specifications
    technical: {
      architecture: 'Node.js + Express.js RESTful API',
      database: 'PostgreSQL with connection pooling',
      caching: 'Redis with in-memory fallback',
      authentication: 'API Key based (admin endpoints)',
      logging: 'Structured logging with Winston',
      monitoring: 'Real-time health checks and metrics',
      deployment: 'Railway Platform with Docker containers',
      security: 'Helmet.js, Rate limiting, CORS, HTTPS',
      errorHandling: 'Circuit breakers, graceful degradation',
      performance: 'Sub-3s neural processing, <200ms API responses',
      scalability: 'Horizontal scaling ready, stateless design'
    },

    // API Versioning Information
    versioning: APIVersioningService.getAllVersionsStatus(),

    // Documentation Links
    links: {
      swagger_ui: '/api/docs/swagger-ui',
      openapi_spec: '/api/docs/openapi.json',
      migration_guide: '/api/docs/migration',
      examples: '/api/docs/examples',
      versioning: '/api/docs/versioning',
      rate_limits: '/api/docs/rate-limits',
      error_codes: '/api/docs/error-codes'
    }
  };

  res.success(documentation, 'API documentation retrieved successfully');
});

/**
 * 📊 OPENAPI/SWAGGER SPECIFICATION
 * GET /api/docs/openapi.json
 */
router.get('/api/docs/openapi.json', (req, res) => {
  const spec = SwaggerService.generateCompleteSpec();
  res.json(spec);
});

/**
 * 🎨 SWAGGER UI INTERFACE
 * GET /api/docs/swagger-ui
 */
router.get('/api/docs/swagger-ui', (req, res) => {
  const html = SwaggerService.generateSwaggerUI();
  res.type('html').send(html);
});

/**
 * 📋 API VERSIONING INFORMATION
 * GET /api/docs/versioning
 */
router.get('/api/docs/versioning', (req, res) => {
  const versioningInfo = {
    overview: 'The Zodiac Backend API supports multiple versions for backward compatibility',
    current_version: APIVersioningService.LATEST_VERSION,
    supported_versions: APIVersioningService.SUPPORTED_VERSIONS,
    deprecated_versions: APIVersioningService.DEPRECATED_VERSIONS,
    version_details: APIVersioningService.VERSION_COMPATIBILITY,
    
    usage: {
      path_based: 'Include version in URL: /api/v2/compatibility/calculate',
      header_based: 'Use Accept header: Accept: application/json; version=2',
      custom_header: 'Use API-Version header: API-Version: v2',
      query_parameter: 'Use query param (fallback): ?api_version=v2'
    },

    migration_guides: {
      'v1_to_v2': '/api/docs/migration/v1-to-v2'
    },

    deprecation_policy: {
      notice_period: '12 months minimum before deprecation',
      sunset_period: '24 months from deprecation notice',
      migration_support: 'Full documentation and examples provided',
      backward_compatibility: 'Legacy endpoints maintained during transition'
    }
  };

  res.success(versioningInfo, 'API versioning information retrieved successfully');
});

/**
 * 🔄 MIGRATION GUIDE
 * GET /api/docs/migration/:fromVersion/:toVersion
 */
router.get('/api/docs/migration/:fromVersion/:toVersion', (req, res) => {
  const { fromVersion, toVersion } = req.params;
  const migrationGuide = APIVersioningService.generateMigrationGuide(fromVersion, toVersion);
  
  res.success(migrationGuide, `Migration guide from ${fromVersion} to ${toVersion} retrieved successfully`);
});

/**
 * ⚠️ ERROR CODES REFERENCE
 * GET /api/docs/error-codes
 */
router.get('/api/docs/error-codes', (req, res) => {
  const { ERROR_CODES } = require('../middleware/responseFormatter');
  
  const errorCodesDoc = {
    overview: 'Comprehensive error codes used throughout the Zodiac Backend API',
    format: 'All errors follow standardized format with success:false, error message, and specific error code',
    
    http_status_codes: {
      200: 'Success - Request completed successfully',
      400: 'Bad Request - Invalid parameters or request format',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Access denied',
      404: 'Not Found - Resource not found',
      409: 'Conflict - Resource conflict',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Server error occurred',
      503: 'Service Unavailable - Service temporarily unavailable'
    },

    application_error_codes: ERROR_CODES,

    error_response_format: {
      success: false,
      error: 'Human readable error message',
      code: 'MACHINE_READABLE_ERROR_CODE',
      timestamp: '2025-09-08T14:00:00.000Z',
      version: '2.0.0',
      requestId: 'req_123456789'
    },

    common_errors: [
      {
        code: 'VALIDATION_ERROR',
        description: 'Request validation failed',
        common_causes: ['Missing required parameters', 'Invalid parameter format', 'Parameter out of range'],
        resolution: 'Check API documentation for correct parameter format and requirements'
      },
      {
        code: 'RATE_LIMITED',
        description: 'Rate limit exceeded',
        common_causes: ['Too many requests in time window'],
        resolution: 'Wait before making additional requests or upgrade to higher rate limit'
      },
      {
        code: 'UNAUTHORIZED',
        description: 'Authentication required',
        common_causes: ['Missing admin_key for admin endpoints'],
        resolution: 'Provide valid admin_key parameter or header'
      }
    ]
  };

  res.success(errorCodesDoc, 'Error codes reference retrieved successfully');
});

/**
 * 🚦 RATE LIMITS DOCUMENTATION
 * GET /api/docs/rate-limits
 */
router.get('/api/docs/rate-limits', (req, res) => {
  const rateLimitsDoc = {
    overview: 'Rate limiting protects the API from abuse and ensures fair usage',
    global_limits: {
      api_endpoints: '200 requests per minute',
      neural_compatibility: '50 requests per minute',
      admin_endpoints: '20 requests per minute',
      webhook_endpoints: '10 requests per minute'
    },
    
    headers: {
      'X-RateLimit-Limit': 'Maximum requests allowed in time window',
      'X-RateLimit-Remaining': 'Requests remaining in current window',
      'X-RateLimit-Reset': 'Time when rate limit window resets',
      'Retry-After': 'Seconds to wait before retrying (when rate limited)'
    },

    rate_limit_response: {
      status: 429,
      body: {
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retryAfter: 60
      }
    },

    best_practices: [
      'Monitor rate limit headers in responses',
      'Implement exponential backoff when rate limited',
      'Cache responses when possible to reduce API calls',
      'Use batch endpoints for multiple requests',
      'Contact support for higher rate limits if needed'
    ],

    adaptive_rate_limiting: {
      description: 'Rate limits adjust based on system load and user behavior',
      benefits: ['Better performance during high load', 'Fair usage distribution', 'Automatic scaling'],
      monitoring: 'Real-time adjustment based on response times and error rates'
    }
  };

  res.success(rateLimitsDoc, 'Rate limits documentation retrieved successfully');
});

/**
 * 💡 API USAGE EXAMPLES
 * GET /api/docs/examples
 */
router.get('/api/docs/examples', (req, res) => {
  const examples = {
    overview: 'Common API usage examples with curl commands and responses',
    
    basic_examples: {
      health_check: {
        description: 'Check if API is healthy',
        request: 'curl http://localhost:3000/health',
        response: {
          status: 'healthy',
          timestamp: '2025-09-08T14:00:00.000Z',
          version: '2.0.0'
        }
      },
      
      daily_horoscope: {
        description: 'Get daily horoscope for Aries in English',
        request: 'curl "http://localhost:3000/api/coaching/getDailyHoroscope?sign=aries&language=en"',
        response: {
          sign: 'aries',
          date: '2025-09-08',
          general: 'Today brings positive energy...',
          ratings: { love: 4, work: 3, health: 5, money: 3, overall: 4 }
        }
      },

      compatibility_check: {
        description: 'Check compatibility between Aries and Leo',
        request: 'curl "http://localhost:3000/api/compatibility/calculate?sign1=aries&sign2=leo&language=en"',
        response: {
          success: true,
          data: {
            compatibility: {
              overall: 9,
              love: 10,
              friendship: 9,
              business: 9,
              percentage: 90,
              rating: 'Excellent'
            }
          }
        }
      }
    },

    advanced_examples: {
      neural_compatibility: {
        description: 'AI-enhanced compatibility analysis',
        request: 'curl -X POST -H "Content-Type: application/json" -d \'{"sign1":"gemini","sign2":"aquarius","analysisLevel":"advanced"}\' http://localhost:3000/api/neural-compatibility/calculate',
        response: {
          success: true,
          data: {
            neuralScore: 0.89,
            confidence: 0.94,
            analysisLevel: 'advanced',
            insights: ['Strong intellectual connection', 'Excellent communication potential']
          }
        }
      },

      receipt_validation: {
        description: 'Validate iOS App Store receipt',
        request: 'curl -X POST -H "Content-Type: application/json" -d \'{"receiptData":"base64_encoded_receipt","userId":"user123"}\' http://localhost:3000/api/receipts/validate',
        response: {
          success: true,
          data: {
            isValid: true,
            environment: 'production',
            bundleId: 'com.yourapp.zodiac'
          }
        }
      }
    },

    error_examples: {
      validation_error: {
        description: 'Missing required parameter',
        request: 'curl "http://localhost:3000/api/compatibility/calculate?sign1=aries"',
        response: {
          success: false,
          error: 'Both sign1 and sign2 parameters are required',
          code: 'MISSING_SIGNS',
          timestamp: '2025-09-08T14:00:00.000Z'
        }
      },

      rate_limit_error: {
        description: 'Rate limit exceeded',
        request: 'curl (after exceeding rate limit)',
        response: {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          retryAfter: 60
        }
      }
    },

    programming_language_examples: {
      javascript: {
        basic_request: `
// Using fetch API
const response = await fetch('http://localhost:3000/api/compatibility/calculate?sign1=aries&sign2=leo');
const data = await response.json();
console.log(data.data.compatibility);
        `,
        with_error_handling: `
try {
  const response = await fetch('http://localhost:3000/api/compatibility/calculate?sign1=aries&sign2=leo');
  const data = await response.json();
  
  if (data.success) {
    console.log('Compatibility:', data.data.compatibility.overall);
  } else {
    console.error('Error:', data.error, data.code);
  }
} catch (error) {
  console.error('Request failed:', error);
}
        `
      },
      
      python: {
        basic_request: `
import requests

response = requests.get('http://localhost:3000/api/compatibility/calculate', 
                       params={'sign1': 'aries', 'sign2': 'leo'})
data = response.json()

if data['success']:
    print(f"Compatibility: {data['data']['compatibility']['overall']}")
else:
    print(f"Error: {data['error']}")
        `
      }
    }
  };

  res.success(examples, 'API usage examples retrieved successfully');
});

module.exports = router;