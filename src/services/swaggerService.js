/**
 * 📖 COMPREHENSIVE SWAGGER/OPENAPI DOCUMENTATION SERVICE
 * Generates complete API documentation for the Zodiac Backend
 * Version: 2.0.0
 */

class SwaggerDocumentationService {

  /**
   * 🚀 GENERATE COMPLETE OPENAPI SPECIFICATION
   */
  static generateCompleteSpec() {
    return {
      openapi: "3.0.0",
      info: {
        title: "Zodiac Backend API",
        version: "2.0.0",
        description: `
# Enhanced Zodiac Backend API

A comprehensive horoscope and zodiac compatibility API with advanced neural analysis, 
multi-language support, and production-grade features.

## Key Features

- **Daily & Weekly Horoscopes**: AI-generated horoscopes in 6 languages
- **Zodiac Compatibility**: Traditional + Neural-enhanced compatibility analysis
- **Neural AI Processing**: Sub-3s response times with 92%+ confidence
- **Premium Features**: App Store integration with receipt validation
- **Production Ready**: Circuit breakers, rate limiting, monitoring
- **Multi-Language**: English, Spanish, German, French, Italian, Portuguese

## Authentication

Most endpoints are public. Admin endpoints require the \`admin_key\` parameter or 
\`X-Admin-Key\` header.

## Rate Limiting

- **API Endpoints**: 200 requests/minute
- **Neural Compatibility**: 50 requests/minute  
- **Admin Endpoints**: 20 requests/minute
- **Webhooks**: 10 requests/minute

## Response Format

All responses follow a standardized format:

\`\`\`json
{
  "success": true,
  "data": {...},
  "timestamp": "2025-09-08T14:00:00.000Z",
  "version": "2.0.0",
  "requestId": "req_123456789",
  "meta": {
    "performance": {
      "responseTime": 150,
      "cacheHit": false,
      "confidence": 0.92
    }
  }
}
\`\`\`
        `,
        contact: {
          name: "Zodiac API Support",
          email: "api@zodiacbackend.com"
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT"
        }
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development server"
        },
        {
          url: "https://zodiac-backend.railway.app",
          description: "Production server"
        }
      ],
      tags: [
        {
          name: "Health",
          description: "System health and status endpoints"
        },
        {
          name: "Horoscopes",
          description: "Daily and weekly horoscope endpoints"
        },
        {
          name: "Compatibility",
          description: "Traditional zodiac compatibility analysis"
        },
        {
          name: "Neural Compatibility", 
          description: "AI-enhanced neural compatibility analysis"
        },
        {
          name: "Generation",
          description: "Content generation management (Admin)"
        },
        {
          name: "Receipts",
          description: "App Store receipt validation"
        },
        {
          name: "Admin",
          description: "Administrative endpoints (Admin)"
        },
        {
          name: "Monitoring",
          description: "System monitoring and analytics"
        }
      ],
      paths: this.generatePaths(),
      components: this.generateComponents(),
      security: [
        {
          AdminKeyAuth: []
        }
      ]
    };
  }

  /**
   * 🛣️ GENERATE API PATHS
   */
  static generatePaths() {
    return {
      // HEALTH ENDPOINTS
      "/health": {
        get: {
          tags: ["Health"],
          summary: "System health check",
          description: "Get comprehensive system health status",
          responses: {
            200: {
              description: "System is healthy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" }
                }
              }
            },
            503: {
              description: "System is degraded or unhealthy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" }
                }
              }
            }
          }
        }
      },
      "/ping": {
        get: {
          tags: ["Health"],
          summary: "Simple ping endpoint",
          description: "Basic availability check",
          responses: {
            200: {
              description: "Service is available",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      timestamp: { type: "string", format: "date-time" },
                      version: { type: "string", example: "2.0.0" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // COMPATIBILITY ENDPOINTS
      "/api/compatibility/calculate": {
        get: {
          tags: ["Compatibility"],
          summary: "Calculate compatibility between two zodiac signs",
          description: "Get compatibility score and analysis between two zodiac signs",
          parameters: [
            {
              name: "sign1",
              in: "query",
              required: true,
              schema: { $ref: "#/components/schemas/ZodiacSign" },
              description: "First zodiac sign"
            },
            {
              name: "sign2", 
              in: "query",
              required: true,
              schema: { $ref: "#/components/schemas/ZodiacSign" },
              description: "Second zodiac sign"
            },
            {
              name: "language",
              in: "query",
              schema: { $ref: "#/components/schemas/Language" },
              description: "Response language (default: en)"
            }
          ],
          responses: {
            200: {
              description: "Compatibility calculated successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CompatibilityResponse" }
                }
              }
            },
            400: {
              description: "Missing required parameters",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },
      "/api/compatibility/sign/{sign}": {
        get: {
          tags: ["Compatibility"],
          summary: "Get all compatibility combinations for a sign",
          description: "Get compatibility scores with all other zodiac signs",
          parameters: [
            {
              name: "sign",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ZodiacSign" },
              description: "Target zodiac sign"
            },
            {
              name: "language",
              in: "query", 
              schema: { $ref: "#/components/schemas/Language" },
              description: "Response language (default: en)"
            }
          ],
          responses: {
            200: {
              description: "Sign compatibilities retrieved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SignCompatibilitiesResponse" }
                }
              }
            }
          }
        }
      },

      // NEURAL COMPATIBILITY ENDPOINTS
      "/api/neural-compatibility/calculate": {
        post: {
          tags: ["Neural Compatibility"],
          summary: "AI-enhanced compatibility analysis",
          description: "Advanced neural network compatibility analysis with contextual insights",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NeuralCompatibilityRequest" }
              }
            }
          },
          responses: {
            200: {
              description: "Neural compatibility analysis completed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NeuralCompatibilityResponse" }
                }
              }
            }
          }
        }
      },
      "/api/neural-compatibility/health": {
        get: {
          tags: ["Neural Compatibility"],
          summary: "Neural service health check",
          description: "Check neural compatibility service status and performance",
          responses: {
            200: {
              description: "Neural service is healthy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NeuralHealthResponse" }
                }
              }
            }
          }
        }
      },

      // HOROSCOPE ENDPOINTS
      "/api/coaching/getDailyHoroscope": {
        get: {
          tags: ["Horoscopes"],
          summary: "Get daily horoscope",
          description: "Retrieve daily horoscope for a specific zodiac sign",
          parameters: [
            {
              name: "sign",
              in: "query",
              required: true,
              schema: { $ref: "#/components/schemas/ZodiacSign" },
              description: "Zodiac sign"
            },
            {
              name: "language",
              in: "query",
              schema: { $ref: "#/components/schemas/Language" },
              description: "Response language (default: en)"
            }
          ],
          responses: {
            200: {
              description: "Daily horoscope retrieved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DailyHoroscopeResponse" }
                }
              }
            }
          }
        }
      },
      "/api/weekly/getWeeklyHoroscope": {
        get: {
          tags: ["Horoscopes"],
          summary: "Get weekly horoscope",
          description: "Retrieve weekly horoscope for a specific zodiac sign",
          parameters: [
            {
              name: "sign",
              in: "query",
              required: true,
              schema: { $ref: "#/components/schemas/ZodiacSign" },
              description: "Zodiac sign"
            },
            {
              name: "language",
              in: "query",
              schema: { $ref: "#/components/schemas/Language" },
              description: "Response language (default: en)"
            }
          ],
          responses: {
            200: {
              description: "Weekly horoscope retrieved successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WeeklyHoroscopeResponse" }
                }
              }
            }
          }
        }
      },

      // ADMIN ENDPOINTS
      "/api/admin/health": {
        get: {
          tags: ["Admin"],
          summary: "Comprehensive admin health check",
          description: "Detailed system health for administrators",
          security: [{ AdminKeyAuth: [] }],
          responses: {
            200: {
              description: "Admin health check completed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminHealthResponse" }
                }
              }
            },
            401: {
              description: "Admin authentication required",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },

      // RECEIPT VALIDATION
      "/api/receipts/validate": {
        post: {
          tags: ["Receipts"],
          summary: "Validate App Store receipt",
          description: "Validate iOS App Store in-app purchase receipts",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReceiptValidationRequest" }
              }
            }
          },
          responses: {
            200: {
              description: "Receipt validated successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReceiptValidationResponse" }
                }
              }
            }
          }
        }
      },

      // API DOCUMENTATION
      "/api/docs": {
        get: {
          tags: ["Health"],
          summary: "API documentation",
          description: "Get comprehensive API documentation and endpoint listing",
          responses: {
            200: {
              description: "API documentation",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiDocsResponse" }
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * 🧩 GENERATE COMPONENTS (SCHEMAS)
   */
  static generateComponents() {
    return {
      securitySchemes: {
        AdminKeyAuth: {
          type: "apiKey",
          in: "query",
          name: "admin_key",
          description: "Admin API key for administrative endpoints"
        }
      },
      schemas: {
        // BASIC TYPES
        ZodiacSign: {
          type: "string",
          enum: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", 
                 "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"],
          example: "aries"
        },
        Language: {
          type: "string",
          enum: ["en", "es", "de", "fr", "it", "pt"],
          default: "en",
          example: "en"
        },
        AnalysisLevel: {
          type: "string",
          enum: ["standard", "advanced", "deep"],
          default: "standard",
          example: "standard"
        },

        // SUCCESS RESPONSES
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            timestamp: { type: "string", format: "date-time" },
            version: { type: "string", example: "2.0.0" },
            requestId: { type: "string", example: "req_123456789" }
          },
          required: ["success", "timestamp", "version"]
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "Validation failed" },
            code: { type: "string", example: "VALIDATION_ERROR" },
            timestamp: { type: "string", format: "date-time" },
            version: { type: "string", example: "2.0.0" },
            requestId: { type: "string", example: "req_123456789" }
          },
          required: ["success", "error", "code", "timestamp", "version"]
        },

        // COMPATIBILITY RESPONSES
        CompatibilityScore: {
          type: "object", 
          properties: {
            overall: { type: "integer", minimum: 1, maximum: 10, example: 9 },
            love: { type: "integer", minimum: 1, maximum: 10, example: 10 },
            friendship: { type: "integer", minimum: 1, maximum: 10, example: 9 },
            business: { type: "integer", minimum: 1, maximum: 10, example: 9 },
            percentage: { type: "integer", minimum: 10, maximum: 100, example: 90 },
            rating: { type: "string", example: "Excellent" },
            summary: { type: "string", example: "aries and leo have excellent compatibility..." }
          }
        },
        CompatibilityResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    compatibility: { $ref: "#/components/schemas/CompatibilityScore" }
                  }
                }
              }
            }
          ]
        },
        SignCompatibilitiesResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    sign: { $ref: "#/components/schemas/ZodiacSign" },
                    compatibilities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sign: { $ref: "#/components/schemas/ZodiacSign" },
                          compatibility: { type: "integer", example: 8 },
                          summary: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        },

        // NEURAL COMPATIBILITY
        NeuralCompatibilityRequest: {
          type: "object",
          properties: {
            sign1: { $ref: "#/components/schemas/ZodiacSign" },
            sign2: { $ref: "#/components/schemas/ZodiacSign" },
            analysisLevel: { $ref: "#/components/schemas/AnalysisLevel" },
            language: { $ref: "#/components/schemas/Language" },
            contextFactors: {
              type: "object",
              properties: {
                age1: { type: "integer", minimum: 18, maximum: 100 },
                age2: { type: "integer", minimum: 18, maximum: 100 },
                relationshipType: { type: "string", enum: ["romantic", "friendship", "business"] }
              }
            }
          },
          required: ["sign1", "sign2"]
        },
        NeuralCompatibilityResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    neuralScore: { type: "number", minimum: 0, maximum: 1, example: 0.92 },
                    confidence: { type: "number", minimum: 0, maximum: 1, example: 0.95 },
                    analysisLevel: { $ref: "#/components/schemas/AnalysisLevel" },
                    insights: {
                      type: "array",
                      items: { type: "string" }
                    },
                    recommendations: {
                      type: "array", 
                      items: { type: "string" }
                    }
                  }
                },
                meta: {
                  type: "object",
                  properties: {
                    performance: {
                      type: "object",
                      properties: {
                        responseTime: { type: "integer", example: 1200 },
                        confidence: { type: "number", example: 0.92 },
                        source: { type: "string", example: "neural_network" }
                      }
                    }
                  }
                }
              }
            }
          ]
        },

        // HOROSCOPE RESPONSES
        DailyHoroscopeResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    sign: { $ref: "#/components/schemas/ZodiacSign" },
                    date: { type: "string", format: "date" },
                    general: { type: "string" },
                    daily: { type: "string" },
                    ratings: {
                      type: "object",
                      properties: {
                        love: { type: "integer", minimum: 1, maximum: 5 },
                        work: { type: "integer", minimum: 1, maximum: 5 },
                        health: { type: "integer", minimum: 1, maximum: 5 },
                        money: { type: "integer", minimum: 1, maximum: 5 },
                        overall: { type: "integer", minimum: 1, maximum: 5 }
                      }
                    },
                    lucky: {
                      type: "object",
                      properties: {
                        number: { type: "string", example: "7" },
                        color: { type: "string", example: "Gold" }
                      }
                    },
                    mood: { type: "string", example: "Optimistic" },
                    advice: { type: "string" },
                    keywords: { type: "string" }
                  }
                }
              }
            }
          ]
        },

        // HEALTH RESPONSES
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["healthy", "degraded", "unhealthy"], example: "healthy" },
            timestamp: { type: "string", format: "date-time" },
            services: {
              type: "object",
              properties: {
                cache: {
                  type: "object",
                  properties: {
                    healthy: { type: "boolean" },
                    mode: { type: "string", example: "redis" }
                  }
                },
                circuitBreaker: {
                  type: "object",
                  properties: {
                    healthy: { type: "boolean" },
                    state: { type: "string", example: "CLOSED" }
                  }
                },
                firebase: {
                  type: "object",
                  properties: {
                    initialized: { type: "boolean" }
                  }
                },
                database: { type: "string", example: "connected" }
              }
            },
            uptime: { type: "number", example: 3600 },
            memory: {
              type: "object",
              properties: {
                rss: { type: "integer" },
                heapTotal: { type: "integer" },
                heapUsed: { type: "integer" }
              }
            },
            version: { type: "string", example: "2.0.0" }
          }
        },

        // RECEIPT VALIDATION
        ReceiptValidationRequest: {
          type: "object",
          properties: {
            receiptData: { type: "string", description: "Base64 encoded receipt data" },
            userId: { type: "string", description: "User identifier" },
            productId: { type: "string", description: "Product identifier" }
          },
          required: ["receiptData"]
        },
        ReceiptValidationResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    isValid: { type: "boolean" },
                    environment: { type: "string", enum: ["sandbox", "production"] },
                    bundleId: { type: "string" },
                    productIds: { type: "array", items: { type: "string" } },
                    expirationDate: { type: "string", format: "date-time", nullable: true }
                  }
                }
              }
            }
          ]
        },

        // API DOCS RESPONSE
        ApiDocsResponse: {
          type: "object",
          properties: {
            name: { type: "string", example: "Zodiac Backend API" },
            version: { type: "string", example: "2.0.0" },
            description: { type: "string" },
            endpoints: { type: "object" },
            features: { type: "array", items: { type: "string" } }
          }
        },

        // ADMIN RESPONSES
        AdminHealthResponse: {
          allOf: [
            { $ref: "#/components/schemas/HealthResponse" },
            {
              type: "object",
              properties: {
                detailed: {
                  type: "object",
                  properties: {
                    cronJobs: { type: "object" },
                    database: { type: "object" },
                    externalServices: { type: "object" },
                    performance: { type: "object" }
                  }
                }
              }
            }
          ]
        },

        // NEURAL HEALTH
        NeuralHealthResponse: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object", 
              properties: {
                data: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "optimal" },
                    averageResponseTime: { type: "integer", example: 1200 },
                    averageConfidence: { type: "number", example: 0.92 },
                    totalAnalyses: { type: "integer", example: 15420 },
                    successRate: { type: "number", example: 0.998 }
                  }
                }
              }
            }
          ]
        }
      }
    };
  }

  /**
   * 🎨 GENERATE SWAGGER UI HTML
   */
  static generateSwaggerUI() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zodiac Backend API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMTIgMmwtMy4wOSA2LjI2TDIgOS4yN2w1 0M5MS41TDkuMjcgMjJIMTJsLS45MS01TDE3IDEybC01LTEuNUwxMiAyeiIgZmlsbD0iIzY2NyIvPjwvc3ZnPg==" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
    .swagger-ui .topbar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tryItOutEnabled: true,
        filter: true,
        requestInterceptor: (request) => {
          // Add any default headers here if needed
          return request;
        }
      });
    };
  </script>
</body>
</html>
    `;
  }

  /**
   * 📊 GENERATE API STATISTICS
   */
  static generateApiStats() {
    return {
      totalEndpoints: 25,
      publicEndpoints: 18,
      adminEndpoints: 7,
      tags: [
        { name: 'Health', count: 3 },
        { name: 'Horoscopes', count: 4 },
        { name: 'Compatibility', count: 5 },
        { name: 'Neural Compatibility', count: 6 },
        { name: 'Admin', count: 4 },
        { name: 'Receipts', count: 3 }
      ],
      supportedLanguages: ['en', 'es', 'de', 'fr', 'it', 'pt'],
      responseFormats: ['application/json'],
      authenticationMethods: ['API Key (admin_key)'],
      rateLimits: {
        api: '200 requests/minute',
        neural: '50 requests/minute',
        admin: '20 requests/minute',
        webhook: '10 requests/minute'
      },
      features: [
        'OpenAPI 3.0.0 specification',
        'Comprehensive request/response schemas', 
        'Interactive Swagger UI',
        'Rate limiting documentation',
        'Error code references',
        'Example requests and responses',
        'Multi-language support',
        'Authentication documentation'
      ]
    };
  }
}

module.exports = SwaggerDocumentationService;