/**
 * ADVANCED INPUT VALIDATION MIDDLEWARE
 * 
 * Enterprise-grade input validation and sanitization
 * Prevents SQL injection, XSS, command injection, and other attacks
 */

const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');
const crypto = require('crypto');
const redisService = require('../services/redisService');
const securityHardeningService = require('../services/securityHardeningService');

class AdvancedInputValidator {
  constructor() {
    // Enhanced threat patterns with more comprehensive coverage
    this.threatPatterns = {
      sql_injection: [
        // SQL Keywords (case insensitive)
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|cast|convert)\b)/gi,
        // SQL Comments
        /(--|\/\*|\*\/|#)/g,
        // SQL String manipulation
        /('.*'|".*"|\b\d+\s*[=<>]+\s*\d+\b)/g,
        // SQL Functions
        /(\b(concat|substring|ascii|char|len|count|sum|avg|min|max|user|version|database)\s*\()/gi,
        // Boolean logic attacks
        /(\b(or|and)\s+\d+\s*[=<>]+\s*\d+)/gi,
        // Time-based attacks
        /(\bwaitfor\s+delay\b|\bsleep\s*\(|\bbenchmark\s*\()/gi
      ],
      
      xss_attack: [
        // Script tags
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
        // Event handlers
        /on\w+\s*=[\s\S]*?(\s|>)/gi,
        // JavaScript URLs
        /javascript\s*:/gi,
        // Data URLs with scripts
        /data\s*:\s*text\/html/gi,
        // Iframe, object, embed tags
        /<(iframe|object|embed|form|link|meta)[\s\S]*?>/gi,
        // HTML entities that could be malicious
        /&#x?[0-9a-f]+;?/gi,
        // CSS expressions
        /expression\s*\(/gi,
        // Import statements
        /@import/gi
      ],
      
      command_injection: [
        // Command separators
        /[;&|`$(){}]/g,
        // Common Unix commands
        /\b(ls|cat|rm|mkdir|chmod|chown|wget|curl|nc|netcat|bash|sh|zsh|python|perl|ruby|node|php)\b/gi,
        // Windows commands
        /\b(dir|type|del|copy|move|net|ping|telnet|ftp|cmd|powershell)\b/gi,
        // Path traversal with commands
        /(\.\.\/|\.\.\\).*\b(ls|cat|rm|dir|type)\b/gi
      ],
      
      path_traversal: [
        // Directory traversal
        /\.\.[\/\\]/g,
        // Encoded traversal
        /%2e%2e[%2f%5c]/gi,
        // Unicode traversal
        /\u002e\u002e[\u002f\u005c]/g,
        // System paths
        /[\/\\](etc|var|usr|proc|sys|windows|system32)[\/\\]/gi
      ],
      
      ldap_injection: [
        /[()&|!]/g,
        /\*.*\*/g
      ],
      
      xpath_injection: [
        /['"]/g,
        /\b(or|and)\b.*\[/gi
      ],
      
      nosql_injection: [
        /\$where/gi,
        /\$ne/gi,
        /\$gt/gi,
        /\$lt/gi,
        /\$regex/gi
      ],
      
      ai_prompt_injection: [
        /ignore\s+previous\s+instructions/gi,
        /forget\s+everything\s+above/gi,
        /system\s*:\s*/gi,
        /admin\s*:\s*/gi,
        /role\s*:\s*admin/gi,
        /act\s+as\s+admin/gi,
        /override\s+security/gi,
        /bypass\s+filter/gi
      ],
      
      template_injection: [
        /\{\{.*\}\}/g,
        /\$\{.*\}/g,
        /<%.*%>/g,
        /#\{.*\}/g
      ],
      
      xml_injection: [
        /<\?xml/gi,
        /<!DOCTYPE/gi,
        /<!ENTITY/gi,
        /SYSTEM\s+["']/gi
      ]
    };

    // Content Security Policy patterns
    this.maliciousContent = [
      // Cryptocurrency mining
      /coinhive|cryptoloot|crypto-loot|coinblind/gi,
      // Phishing indicators
      /phishing|paypal\.com\.\w+|amazon\.com\.\w+|microsoft\.com\.\w+/gi,
      // Malicious domains patterns
      /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly/gi
    ];

    // Rate limiting for validation attempts
    this.validationAttempts = new Map();
    this.suspiciousInputs = new Map();
    
    // Whitelist patterns for common legitimate inputs
    this.whitelistPatterns = {
      zodiac_signs: /^(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)$/i,
      languages: /^(en|es|fr|de|it|pt)$/i,
      uuids: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      dates: /^\d{4}-\d{2}-\d{2}$/,
      emails: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    };
    
    console.log('🛡️ Advanced Input Validator initialized');
  }

  /**
   * Main validation middleware
   */
  createValidationMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const clientIP = req.ip;
      const requestId = crypto.randomUUID();
      
      try {
        // Check validation rate limiting
        if (await this.isValidationRateLimited(clientIP)) {
          return res.status(429).json({
            error: 'Too many validation requests',
            retry_after: 60
          });
        }

        // Validate request headers
        const headerValidation = this.validateHeaders(req.headers);
        if (!headerValidation.valid) {
          await this.logSecurityViolation(req, 'malicious_headers', headerValidation.threats);
          return res.status(400).json({
            error: 'Invalid request headers',
            request_id: requestId
          });
        }

        // Validate URL and path
        const urlValidation = this.validateURL(req.url, req.path);
        if (!urlValidation.valid) {
          await this.logSecurityViolation(req, 'malicious_url', urlValidation.threats);
          return res.status(400).json({
            error: 'Invalid URL format',
            request_id: requestId
          });
        }

        // Validate query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          const queryValidation = await this.validateObject(req.query, 'query');
          if (!queryValidation.valid) {
            await this.logSecurityViolation(req, 'malicious_query', queryValidation.threats);
            return res.status(400).json({
              error: 'Invalid query parameters',
              violations: queryValidation.threats,
              request_id: requestId
            });
          }
          req.query = queryValidation.sanitizedData;
        }

        // Validate request body
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyValidation = await this.validateObject(req.body, 'body');
          if (!bodyValidation.valid) {
            await this.logSecurityViolation(req, 'malicious_body', bodyValidation.threats);
            return res.status(400).json({
              error: 'Invalid request body',
              violations: bodyValidation.threats,
              request_id: requestId
            });
          }
          req.body = bodyValidation.sanitizedData;
        }

        // Add validation metadata to request
        req.validation = {
          request_id: requestId,
          validation_time: Date.now() - startTime,
          client_ip: clientIP,
          validated_at: new Date().toISOString()
        };

        next();

      } catch (error) {
        console.error('Input validation error:', error);
        await this.logSecurityViolation(req, 'validation_error', [error.message]);
        
        res.status(500).json({
          error: 'Input validation failed',
          request_id: requestId
        });
      }
    };
  }

  /**
   * Validate object (recursive)
   */
  async validateObject(obj, context = 'unknown') {
    const threats = [];
    const sanitizedData = {};
    
    try {
      for (const [key, value] of Object.entries(obj)) {
        // Validate key names
        const keyValidation = this.validateKey(key);
        if (!keyValidation.valid) {
          threats.push({
            type: 'invalid_key',
            key: key,
            threats: keyValidation.threats,
            context: context
          });
          continue;
        }

        // Validate and sanitize values
        if (typeof value === 'string') {
          const stringValidation = this.validateString(value, key);
          if (!stringValidation.valid) {
            threats.push({
              type: 'malicious_string',
              key: key,
              threats: stringValidation.threats,
              context: context
            });
            continue;
          }
          sanitizedData[key] = stringValidation.sanitizedValue;
          
        } else if (typeof value === 'number') {
          const numberValidation = this.validateNumber(value, key);
          if (!numberValidation.valid) {
            threats.push({
              type: 'invalid_number',
              key: key,
              threats: numberValidation.threats,
              context: context
            });
            continue;
          }
          sanitizedData[key] = numberValidation.sanitizedValue;
          
        } else if (typeof value === 'boolean') {
          sanitizedData[key] = Boolean(value);
          
        } else if (Array.isArray(value)) {
          const arrayValidation = await this.validateArray(value, key);
          if (!arrayValidation.valid) {
            threats.push({
              type: 'malicious_array',
              key: key,
              threats: arrayValidation.threats,
              context: context
            });
            continue;
          }
          sanitizedData[key] = arrayValidation.sanitizedValue;
          
        } else if (value && typeof value === 'object') {
          // Prevent prototype pollution
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            threats.push({
              type: 'prototype_pollution',
              key: key,
              context: context
            });
            continue;
          }
          
          const nestedValidation = await this.validateObject(value, `${context}.${key}`);
          if (!nestedValidation.valid) {
            threats.push(...nestedValidation.threats);
            continue;
          }
          sanitizedData[key] = nestedValidation.sanitizedData;
          
        } else if (value === null || value === undefined) {
          sanitizedData[key] = value;
          
        } else {
          threats.push({
            type: 'unsupported_type',
            key: key,
            value_type: typeof value,
            context: context
          });
        }
      }
      
      return {
        valid: threats.length === 0,
        threats: threats,
        sanitizedData: sanitizedData
      };
      
    } catch (error) {
      return {
        valid: false,
        threats: [{ type: 'validation_error', message: error.message, context: context }],
        sanitizedData: {}
      };
    }
  }

  /**
   * Validate string values
   */
  validateString(value, key) {
    const threats = [];
    let sanitizedValue = value;
    
    // Length validation
    if (value.length > 10000) {
      threats.push('string_too_long');
      sanitizedValue = value.substring(0, 10000);
    }
    
    // Check for null bytes
    if (value.includes('\x00')) {
      threats.push('null_byte_detected');
      sanitizedValue = sanitizedValue.replace(/\x00/g, '');
    }
    
    // Check against threat patterns
    for (const [threatType, patterns] of Object.entries(this.threatPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          threats.push(threatType);
          break;
        }
      }
    }
    
    // Check for malicious content
    for (const pattern of this.maliciousContent) {
      if (pattern.test(value)) {
        threats.push('malicious_content');
        break;
      }
    }
    
    // Apply whitelisting for known safe patterns
    if (this.isWhitelisted(value, key)) {
      return { valid: true, sanitizedValue: value };
    }
    
    // If threats found, sanitize more aggressively
    if (threats.length > 0) {
      sanitizedValue = this.sanitizeString(sanitizedValue);
      
      // Re-check after sanitization
      const recheckThreats = [];
      for (const [threatType, patterns] of Object.entries(this.threatPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(sanitizedValue)) {
            recheckThreats.push(threatType);
            break;
          }
        }
      }
      
      // If still malicious after sanitization, reject
      if (recheckThreats.length > 0) {
        return { valid: false, threats: threats };
      }
    }
    
    return {
      valid: threats.length === 0,
      threats: threats,
      sanitizedValue: sanitizedValue
    };
  }

  /**
   * Validate array values
   */
  async validateArray(array, key) {
    const threats = [];
    const sanitizedArray = [];
    
    // Array size validation
    if (array.length > 1000) {
      threats.push('array_too_large');
      array = array.slice(0, 1000);
    }
    
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      
      if (typeof item === 'string') {
        const stringValidation = this.validateString(item, `${key}[${i}]`);
        if (!stringValidation.valid) {
          threats.push(...stringValidation.threats);
          continue;
        }
        sanitizedArray.push(stringValidation.sanitizedValue);
        
      } else if (typeof item === 'number') {
        const numberValidation = this.validateNumber(item, `${key}[${i}]`);
        if (!numberValidation.valid) {
          threats.push(...numberValidation.threats);
          continue;
        }
        sanitizedArray.push(numberValidation.sanitizedValue);
        
      } else if (typeof item === 'object' && item !== null) {
        const objectValidation = await this.validateObject(item, `${key}[${i}]`);
        if (!objectValidation.valid) {
          threats.push(...objectValidation.threats);
          continue;
        }
        sanitizedArray.push(objectValidation.sanitizedData);
        
      } else {
        sanitizedArray.push(item);
      }
    }
    
    return {
      valid: threats.length === 0,
      threats: threats,
      sanitizedValue: sanitizedArray
    };
  }

  /**
   * Validate numbers
   */
  validateNumber(value, key) {
    const threats = [];
    let sanitizedValue = value;
    
    // Check for NaN and infinity
    if (!isFinite(value)) {
      threats.push('invalid_number');
      sanitizedValue = 0;
    }
    
    // Check for safe integer range
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      threats.push('number_too_large');
      sanitizedValue = Math.sign(value) * Number.MAX_SAFE_INTEGER;
    }
    
    return {
      valid: threats.length === 0,
      threats: threats,
      sanitizedValue: sanitizedValue
    };
  }

  /**
   * Validate object keys
   */
  validateKey(key) {
    const threats = [];
    
    // Key length validation
    if (key.length > 100) {
      threats.push('key_too_long');
    }
    
    // Check for dangerous key names
    const dangerousKeys = [
      '__proto__', 'constructor', 'prototype',
      'eval', 'function', 'require', 'import',
      'process', 'global', 'Buffer'
    ];
    
    if (dangerousKeys.includes(key)) {
      threats.push('dangerous_key');
    }
    
    // Check for non-printable characters
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(key)) {
      threats.push('invalid_key_format');
    }
    
    return {
      valid: threats.length === 0,
      threats: threats
    };
  }

  /**
   * Validate request headers
   */
  validateHeaders(headers) {
    const threats = [];
    
    // Check for suspiciously long headers
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string' && value.length > 8192) {
        threats.push(`header_too_long_${name}`);
      }
      
      // Check for dangerous header values
      if (typeof value === 'string') {
        for (const [threatType, patterns] of Object.entries(this.threatPatterns)) {
          for (const pattern of patterns) {
            if (pattern.test(value)) {
              threats.push(`header_${threatType}_${name}`);
              break;
            }
          }
        }
      }
    }
    
    return {
      valid: threats.length === 0,
      threats: threats
    };
  }

  /**
   * Validate URL and path
   */
  validateURL(url, path) {
    const threats = [];
    
    // Path traversal check
    if (path.includes('..')) {
      threats.push('path_traversal');
    }
    
    // Check for encoded attacks
    try {
      const decodedPath = decodeURIComponent(path);
      if (decodedPath !== path && decodedPath.includes('..')) {
        threats.push('encoded_path_traversal');
      }
    } catch (error) {
      threats.push('invalid_url_encoding');
    }
    
    // Check URL length
    if (url.length > 2048) {
      threats.push('url_too_long');
    }
    
    return {
      valid: threats.length === 0,
      threats: threats
    };
  }

  /**
   * Aggressive string sanitization
   */
  sanitizeString(input) {
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>{}[\]\\|`~^"']/g, '');
    
    // Remove SQL keywords aggressively
    sanitized = sanitized.replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '');
    
    // Remove script-related keywords
    sanitized = sanitized.replace(/\b(script|javascript|vbscript|onload|onerror|onclick)\b/gi, '');
    
    // Remove command injection patterns
    sanitized = sanitized.replace(/[;&|`$()]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // URL decode and re-sanitize if needed
    try {
      const decoded = decodeURIComponent(sanitized);
      if (decoded !== sanitized) {
        sanitized = this.sanitizeString(decoded);
      }
    } catch (error) {
      // Invalid URL encoding, keep original sanitized version
    }
    
    return sanitized;
  }

  /**
   * Check if input matches whitelist patterns
   */
  isWhitelisted(value, key) {
    // Check for specific field patterns
    if (key.includes('sign') && this.whitelistPatterns.zodiac_signs.test(value)) {
      return true;
    }
    
    if (key.includes('lang') && this.whitelistPatterns.languages.test(value)) {
      return true;
    }
    
    if ((key.includes('id') || key.includes('uuid')) && this.whitelistPatterns.uuids.test(value)) {
      return true;
    }
    
    if (key.includes('date') && this.whitelistPatterns.dates.test(value)) {
      return true;
    }
    
    if (key.includes('email') && this.whitelistPatterns.emails.test(value)) {
      return true;
    }
    
    return false;
  }

  /**
   * Rate limiting for validation attempts
   */
  async isValidationRateLimited(ip) {
    const key = `validation_rate_limit:${ip}`;
    const attempts = await redisService.get(key) || 0;
    
    if (attempts > 100) { // More than 100 validation requests per minute
      return true;
    }
    
    await redisService.set(key, attempts + 1, 60); // 1 minute window
    return false;
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(req, violationType, threats) {
    const violation = {
      type: violationType,
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      threats: threats,
      timestamp: new Date().toISOString(),
      headers: this.sanitizeHeaders(req.headers)
    };

    // Log to security hardening service
    await securityHardeningService.auditLogger.logSecurityEvent({
      type: 'input_validation_violation',
      severity: this.calculateSeverity(threats),
      ip: req.ip,
      endpoint: req.path,
      details: violation
    });

    // Track suspicious inputs
    const suspicionKey = req.ip;
    const currentSuspicion = this.suspiciousInputs.get(suspicionKey) || 0;
    this.suspiciousInputs.set(suspicionKey, currentSuspicion + 1);

    // Auto-block aggressive attackers
    if (currentSuspicion > 5) {
      console.warn(`🚨 Auto-blocking suspicious IP: ${req.ip} (${currentSuspicion + 1} violations)`);
      // This would integrate with the IP blocking system
    }
  }

  /**
   * Calculate severity based on threat types
   */
  calculateSeverity(threats) {
    if (threats.some(t => typeof t === 'string' && (t.includes('sql_injection') || t.includes('command_injection')))) {
      return 'critical';
    }
    if (threats.some(t => typeof t === 'string' && (t.includes('xss_attack') || t.includes('path_traversal')))) {
      return 'high';
    }
    if (threats.some(t => typeof t === 'string' && t.includes('malicious'))) {
      return 'warning';
    }
    return 'info';
  }

  /**
   * Sanitize headers for logging
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-admin-key'];
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      suspicious_inputs: this.suspiciousInputs.size,
      validation_attempts: this.validationAttempts.size,
      threat_patterns: Object.keys(this.threatPatterns).length,
      whitelist_patterns: Object.keys(this.whitelistPatterns).length
    };
  }
}

module.exports = new AdvancedInputValidator();