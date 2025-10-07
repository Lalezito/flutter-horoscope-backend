/**
 * 🔄 API VERSIONING SERVICE
 * Manages API versions, backward compatibility, and deprecation
 * Version: 2.0.0
 */

const logger = require('./loggingService');

class APIVersioningService {

  /**
   * 🏷️ SUPPORTED API VERSIONS
   */
  static SUPPORTED_VERSIONS = ['v1', 'v2'];
  static DEFAULT_VERSION = 'v2';
  static LATEST_VERSION = 'v2';
  static DEPRECATED_VERSIONS = ['v1'];

  /**
   * 📊 VERSION COMPATIBILITY MATRIX
   */
  static VERSION_COMPATIBILITY = {
    'v1': {
      status: 'deprecated',
      deprecatedSince: '2025-01-01',
      sunsetDate: '2025-12-31',
      migrationGuide: '/docs/migration/v1-to-v2',
      supportedFeatures: [
        'basic_horoscopes',
        'simple_compatibility',
        'legacy_response_format'
      ],
      limitations: [
        'No neural compatibility',
        'Limited language support',
        'Basic error handling',
        'No performance metadata'
      ]
    },
    'v2': {
      status: 'current',
      introducedDate: '2025-01-01',
      supportedFeatures: [
        'daily_horoscopes',
        'weekly_horoscopes',
        'traditional_compatibility',
        'neural_compatibility',
        'multi_language_support',
        'unified_response_format',
        'performance_metadata',
        'comprehensive_error_handling',
        'rate_limiting',
        'admin_endpoints',
        'receipt_validation',
        'real_time_monitoring'
      ],
      enhancements: [
        'Sub-3s neural processing',
        '92%+ confidence scores',
        'Circuit breakers',
        'Advanced caching',
        'OpenAPI documentation'
      ]
    }
  };

  /**
   * 🔍 EXTRACT API VERSION FROM REQUEST
   */
  static extractVersion(req) {
    // Method 1: URL path version (preferred)
    // /api/v2/compatibility/calculate
    const pathVersion = req.path.match(/^\/api\/v(\d+)/);
    if (pathVersion) {
      return `v${pathVersion[1]}`;
    }

    // Method 2: Header version
    // Accept: application/json; version=2
    const acceptHeader = req.get('Accept');
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/version=(\d+)/);
      if (versionMatch) {
        return `v${versionMatch[1]}`;
      }
    }

    // Method 3: Custom header
    // API-Version: v2
    const apiVersionHeader = req.get('API-Version');
    if (apiVersionHeader) {
      return apiVersionHeader.toLowerCase();
    }

    // Method 4: Query parameter (fallback)
    // ?api_version=v2
    if (req.query.api_version) {
      return req.query.api_version.toLowerCase();
    }

    // Default to latest version
    return this.DEFAULT_VERSION;
  }

  /**
   * ✅ VALIDATE API VERSION
   */
  static validateVersion(version) {
    if (!this.SUPPORTED_VERSIONS.includes(version)) {
      return {
        valid: false,
        error: `Unsupported API version: ${version}`,
        code: 'UNSUPPORTED_VERSION',
        supportedVersions: this.SUPPORTED_VERSIONS,
        latestVersion: this.LATEST_VERSION
      };
    }

    const versionInfo = this.VERSION_COMPATIBILITY[version];
    
    if (versionInfo.status === 'deprecated') {
      return {
        valid: true,
        deprecated: true,
        warning: `API version ${version} is deprecated since ${versionInfo.deprecatedSince}`,
        sunsetDate: versionInfo.sunsetDate,
        migrationGuide: versionInfo.migrationGuide,
        recommendedVersion: this.LATEST_VERSION
      };
    }

    return {
      valid: true,
      deprecated: false,
      version: version,
      status: versionInfo.status
    };
  }

  /**
   * 🔄 API VERSION MIDDLEWARE
   */
  static versioningMiddleware() {
    return (req, res, next) => {
      // Extract version from request
      const requestedVersion = this.extractVersion(req);
      const validation = this.validateVersion(requestedVersion);

      // Store version info in request
      req.apiVersion = requestedVersion;
      req.versionInfo = this.VERSION_COMPATIBILITY[requestedVersion];

      // Handle invalid version
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
          code: validation.code,
          supportedVersions: validation.supportedVersions,
          latestVersion: validation.latestVersion,
          timestamp: new Date().toISOString(),
          version: '2.0.0'
        });
      }

      // Add deprecation headers for deprecated versions
      if (validation.deprecated) {
        res.set({
          'X-API-Deprecated': 'true',
          'X-API-Deprecated-Since': this.VERSION_COMPATIBILITY[requestedVersion].deprecatedSince,
          'X-API-Sunset-Date': this.VERSION_COMPATIBILITY[requestedVersion].sunsetDate,
          'X-API-Migration-Guide': this.VERSION_COMPATIBILITY[requestedVersion].migrationGuide,
          'X-API-Recommended-Version': validation.recommendedVersion
        });

        // Log deprecation usage
        logger.getLogger().warn('Deprecated API version used', {
          version: requestedVersion,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      // Add version headers to response
      res.set({
        'X-API-Version': requestedVersion,
        'X-API-Latest-Version': this.LATEST_VERSION,
        'X-API-Supported-Versions': this.SUPPORTED_VERSIONS.join(', ')
      });

      next();
    };
  }

  /**
   * 🏗️ TRANSFORM RESPONSE FOR VERSION COMPATIBILITY
   */
  static transformResponse(data, version, endpoint) {
    const transformer = this.getResponseTransformer(version);
    return transformer(data, endpoint);
  }

  /**
   * 🔀 GET RESPONSE TRANSFORMER FOR VERSION
   */
  static getResponseTransformer(version) {
    switch (version) {
      case 'v1':
        return this.v1ResponseTransformer.bind(this);
      case 'v2':
        return this.v2ResponseTransformer.bind(this);
      default:
        return this.v2ResponseTransformer.bind(this);
    }
  }

  /**
   * 📦 V1 RESPONSE TRANSFORMER (Legacy Format)
   */
  static v1ResponseTransformer(data, endpoint) {
    // Legacy format: simple JSON without success wrapper
    if (endpoint.includes('compatibility')) {
      return {
        compatibility_score: data.overall || data.compatibility?.overall,
        rating: data.rating || data.compatibility?.rating,
        summary: data.summary || data.compatibility?.summary
      };
    }

    if (endpoint.includes('horoscope')) {
      return {
        horoscope: data.general || data.daily,
        sign: data.sign,
        date: data.date,
        rating: data.overall_rating
      };
    }

    // Default: strip success wrapper for v1
    return data.data || data;
  }

  /**
   * 🚀 V2 RESPONSE TRANSFORMER (Current Format)
   */
  static v2ResponseTransformer(data, endpoint) {
    // V2 format: unified success response format
    if (typeof data === 'object' && data.success !== undefined) {
      // Already in v2 format
      return data;
    }

    // Wrap in v2 format
    return {
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };
  }

  /**
   * 📋 GET VERSION INFORMATION
   */
  static getVersionInfo(version) {
    return this.VERSION_COMPATIBILITY[version] || null;
  }

  /**
   * 📊 GET ALL VERSIONS STATUS
   */
  static getAllVersionsStatus() {
    return {
      supportedVersions: this.SUPPORTED_VERSIONS,
      defaultVersion: this.DEFAULT_VERSION,
      latestVersion: this.LATEST_VERSION,
      deprecatedVersions: this.DEPRECATED_VERSIONS,
      versions: this.VERSION_COMPATIBILITY
    };
  }

  /**
   * 🔍 CHECK FEATURE SUPPORT
   */
  static supportsFeature(version, feature) {
    const versionInfo = this.VERSION_COMPATIBILITY[version];
    if (!versionInfo) return false;
    
    return versionInfo.supportedFeatures.includes(feature);
  }

  /**
   * ⚠️ GET DEPRECATION NOTICE
   */
  static getDeprecationNotice(version) {
    const versionInfo = this.VERSION_COMPATIBILITY[version];
    
    if (versionInfo?.status === 'deprecated') {
      return {
        deprecated: true,
        message: `API version ${version} is deprecated since ${versionInfo.deprecatedSince}`,
        sunsetDate: versionInfo.sunsetDate,
        migrationGuide: versionInfo.migrationGuide,
        recommendedVersion: this.LATEST_VERSION,
        limitations: versionInfo.limitations
      };
    }

    return { deprecated: false };
  }

  /**
   * 🗺️ GENERATE MIGRATION GUIDE
   */
  static generateMigrationGuide(fromVersion, toVersion) {
    if (fromVersion === 'v1' && toVersion === 'v2') {
      return {
        title: 'Migration Guide: API v1 to v2',
        overview: 'API v2 introduces unified response formats, enhanced compatibility analysis, and new neural features.',
        breaking_changes: [
          {
            change: 'Response format standardization',
            v1: 'Direct JSON responses',
            v2: 'Wrapped in success/error format with metadata',
            action: 'Update response parsing to expect {success, data, timestamp} format'
          },
          {
            change: 'Error handling',
            v1: 'HTTP status codes only',
            v2: 'Structured error responses with codes',
            action: 'Update error handling to check success field and error codes'
          },
          {
            change: 'Compatibility scores',
            v1: 'Simple numeric score',
            v2: 'Detailed compatibility object with multiple dimensions',
            action: 'Access score via response.data.compatibility.overall'
          }
        ],
        new_features: [
          'Neural compatibility analysis',
          'Performance metadata',
          'Multi-language support', 
          'Comprehensive error codes',
          'Rate limiting headers',
          'API versioning support'
        ],
        migration_steps: [
          '1. Update base URL to include /v2/ in path',
          '2. Update response parsing for new format',
          '3. Handle new error response structure',
          '4. Test with new endpoints and features',
          '5. Update documentation and client libraries'
        ],
        support: {
          documentation: '/api/docs',
          examples: '/api/docs/examples',
          support_email: 'api-support@zodiacbackend.com'
        }
      };
    }

    return {
      error: `Migration guide not available for ${fromVersion} to ${toVersion}`
    };
  }
}

module.exports = APIVersioningService;