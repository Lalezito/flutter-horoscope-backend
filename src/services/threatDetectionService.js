/**
 * ADVANCED THREAT DETECTION SERVICE
 * 
 * Enterprise-grade threat detection and response system
 * Features:
 * - Real-time anomaly detection
 * - Machine learning-based pattern recognition
 * - Behavioral analysis
 * - Automated incident response
 * - Threat intelligence integration
 * - Predictive security analytics
 */

const crypto = require('crypto');
const redisService = require('./redisService');
const securityHardeningService = require('./securityHardeningService');

class ThreatDetectionService {
  constructor() {
    this.config = {
      // Detection thresholds
      anomaly_threshold: 0.7,
      threat_score_threshold: 75,
      behavioral_deviation_threshold: 3.0,
      
      // Time windows
      short_window: 300000,    // 5 minutes
      medium_window: 1800000,  // 30 minutes
      long_window: 3600000,    // 1 hour
      
      // Learning parameters
      learning_window: 86400000, // 24 hours
      baseline_samples: 100,
      
      // Response thresholds
      auto_block_threshold: 90,
      alert_threshold: 60,
      investigation_threshold: 40
    };

    // Threat intelligence feeds
    this.threatIntelligence = {
      malicious_ips: new Set(),
      suspicious_patterns: new Map(),
      attack_signatures: new Map(),
      geographic_risks: new Map()
    };

    // Behavioral baselines
    this.behavioralBaselines = new Map();
    this.anomalyDetectors = new Map();
    
    // Active threats tracking
    this.activeThreats = new Map();
    this.incidentHistory = [];
    
    // Machine learning models (simplified)
    this.mlModels = {
      request_pattern_classifier: new RequestPatternClassifier(),
      behavioral_analyzer: new BehavioralAnalyzer(),
      anomaly_detector: new AnomalyDetector()
    };

    console.log('🎯 Advanced Threat Detection Service initialized');
  }

  /**
   * Initialize threat detection service
   */
  async initialize() {
    try {
      // Load threat intelligence
      await this.loadThreatIntelligence();
      
      // Initialize behavioral baselines
      await this.initializeBehavioralBaselines();
      
      // Start real-time monitoring
      this.startRealTimeMonitoring();
      
      // Start periodic analysis
      this.startPeriodicAnalysis();
      
      console.log('✅ Threat Detection Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Threat Detection Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze incoming request for threats
   */
  async analyzeRequest(req, res, next) {
    const startTime = Date.now();
    const requestId = req.validation?.request_id || crypto.randomUUID();
    
    try {
      // Extract request features
      const requestFeatures = this.extractRequestFeatures(req);
      
      // Multi-layered threat analysis
      const threatScores = await Promise.all([
        this.analyzeRequestPattern(requestFeatures),
        this.analyzeBehavioralAnomaly(requestFeatures),
        this.analyzeGeographicRisk(requestFeatures),
        this.analyzeThreatIntelligence(requestFeatures),
        this.analyzeFrequencyAnalysis(requestFeatures),
        this.analyzeContentAnalysis(requestFeatures)
      ]);
      
      // Calculate composite threat score
      const compositeThreatScore = this.calculateCompositeThreatScore(threatScores);
      
      // Determine threat level and response
      const threatAssessment = this.assessThreatLevel(compositeThreatScore, threatScores);
      
      // Log analysis
      await this.logThreatAnalysis(requestId, requestFeatures, threatScores, threatAssessment);
      
      // Automated response based on threat level
      const responseAction = await this.executeAutomatedResponse(threatAssessment, req);
      
      if (responseAction.block) {
        return res.status(403).json({
          error: 'Request blocked by security system',
          incident_id: requestId,
          contact_support: 'security@zodiac-system.com'
        });
      }
      
      // Add threat metadata to request
      req.threatAnalysis = {
        threat_score: compositeThreatScore.total,
        threat_level: threatAssessment.level,
        risk_factors: threatAssessment.risk_factors,
        analysis_time: Date.now() - startTime
      };
      
      next();
      
    } catch (error) {
      console.error('Threat analysis error:', error);
      // Fail open but log the error
      req.threatAnalysis = {
        threat_score: 0,
        threat_level: 'unknown',
        error: error.message
      };
      next();
    }
  }

  /**
   * Extract features from request for analysis
   */
  extractRequestFeatures(req) {
    return {
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      query_params: req.query,
      body: req.body,
      headers: req.headers,
      timestamp: Date.now(),
      content_length: req.get('Content-Length') || 0,
      
      // Derived features
      path_depth: req.path.split('/').length,
      param_count: Object.keys(req.query || {}).length,
      has_body: req.body && Object.keys(req.body).length > 0,
      
      // Geographic info (would be enhanced with real GeoIP)
      country: this.getCountryFromIP(req.ip),
      
      // Timing features
      hour_of_day: new Date().getHours(),
      day_of_week: new Date().getDay()
    };
  }

  /**
   * Analyze request patterns using ML classifier
   */
  async analyzeRequestPattern(features) {
    try {
      // Pattern recognition analysis
      const patternScore = await this.mlModels.request_pattern_classifier.predict(features);
      
      // Known attack pattern matching
      const attackPatterns = this.matchAttackPatterns(features);
      
      // URL structure analysis
      const urlStructureScore = this.analyzeURLStructure(features);
      
      return {
        type: 'pattern_analysis',
        score: Math.max(patternScore, attackPatterns, urlStructureScore),
        details: {
          pattern_score: patternScore,
          attack_patterns: attackPatterns,
          url_structure: urlStructureScore
        }
      };
    } catch (error) {
      return { type: 'pattern_analysis', score: 0, error: error.message };
    }
  }

  /**
   * Analyze behavioral anomalies
   */
  async analyzeBehavioralAnomaly(features) {
    try {
      const ip = features.ip;
      const baseline = this.behavioralBaselines.get(ip);
      
      if (!baseline) {
        // No baseline yet, start learning
        await this.startLearningBaseline(ip, features);
        return { type: 'behavioral_analysis', score: 0, details: { status: 'learning' } };
      }
      
      // Calculate behavioral deviation
      const deviation = this.calculateBehavioralDeviation(features, baseline);
      const anomalyScore = this.mlModels.behavioral_analyzer.calculateAnomalyScore(deviation);
      
      // Update baseline
      await this.updateBehavioralBaseline(ip, features);
      
      return {
        type: 'behavioral_analysis',
        score: anomalyScore,
        details: {
          deviation_score: deviation,
          baseline_age: Date.now() - baseline.created_at,
          sample_count: baseline.sample_count
        }
      };
    } catch (error) {
      return { type: 'behavioral_analysis', score: 0, error: error.message };
    }
  }

  /**
   * Analyze geographic risk factors
   */
  async analyzeGeographicRisk(features) {
    try {
      const country = features.country;
      const riskScore = this.threatIntelligence.geographic_risks.get(country) || 10;
      
      // Check for geographic anomalies (e.g., rapid location changes)
      const locationHistory = await this.getLocationHistory(features.ip);
      let locationAnomalyScore = 0;
      
      if (locationHistory.length > 1) {
        const rapidLocationChanges = this.detectRapidLocationChanges(locationHistory);
        locationAnomalyScore = rapidLocationChanges * 20;
      }
      
      return {
        type: 'geographic_analysis',
        score: Math.max(riskScore, locationAnomalyScore),
        details: {
          country: country,
          risk_level: riskScore,
          location_anomaly: locationAnomalyScore,
          location_history_count: locationHistory.length
        }
      };
    } catch (error) {
      return { type: 'geographic_analysis', score: 0, error: error.message };
    }
  }

  /**
   * Check against threat intelligence feeds
   */
  async analyzeThreatIntelligence(features) {
    try {
      let threatScore = 0;
      const threats = [];
      
      // Check IP reputation
      if (this.threatIntelligence.malicious_ips.has(features.ip)) {
        threatScore += 80;
        threats.push('malicious_ip');
      }
      
      // Check for known attack signatures
      const signatureMatches = this.matchThreatSignatures(features);
      threatScore += signatureMatches.length * 15;
      threats.push(...signatureMatches);
      
      // Check user agent against known bot patterns
      const botScore = this.analyzeBotPatterns(features.user_agent);
      threatScore += botScore;
      if (botScore > 50) threats.push('suspicious_bot');
      
      return {
        type: 'threat_intelligence',
        score: Math.min(threatScore, 100),
        details: {
          threats_detected: threats,
          ip_reputation: this.threatIntelligence.malicious_ips.has(features.ip),
          bot_score: botScore
        }
      };
    } catch (error) {
      return { type: 'threat_intelligence', score: 0, error: error.message };
    }
  }

  /**
   * Analyze request frequency and timing
   */
  async analyzeFrequencyAnalysis(features) {
    try {
      const ip = features.ip;
      const now = Date.now();
      
      // Get request history for different time windows
      const shortTermRequests = await this.getRequestHistory(ip, now - this.config.short_window);
      const mediumTermRequests = await this.getRequestHistory(ip, now - this.config.medium_window);
      const longTermRequests = await this.getRequestHistory(ip, now - this.config.long_window);
      
      // Calculate frequency scores
      const shortFreqScore = Math.min((shortTermRequests.length / 50) * 100, 100);
      const mediumFreqScore = Math.min((mediumTermRequests.length / 200) * 100, 100);
      const longFreqScore = Math.min((longTermRequests.length / 500) * 100, 100);
      
      // Analyze timing patterns (detect automated requests)
      const timingAnomalyScore = this.analyzeRequestTiming(shortTermRequests);
      
      const maxScore = Math.max(shortFreqScore, mediumFreqScore, longFreqScore, timingAnomalyScore);
      
      return {
        type: 'frequency_analysis',
        score: maxScore,
        details: {
          short_term_requests: shortTermRequests.length,
          medium_term_requests: mediumTermRequests.length,
          long_term_requests: longTermRequests.length,
          timing_anomaly: timingAnomalyScore,
          frequency_scores: {
            short: shortFreqScore,
            medium: mediumFreqScore,
            long: longFreqScore
          }
        }
      };
    } catch (error) {
      return { type: 'frequency_analysis', score: 0, error: error.message };
    }
  }

  /**
   * Analyze request content for malicious patterns
   */
  async analyzeContentAnalysis(features) {
    try {
      let contentScore = 0;
      const issues = [];
      
      // Analyze query parameters
      if (features.query_params) {
        const queryScore = this.analyzeQueryParameters(features.query_params);
        contentScore += queryScore;
        if (queryScore > 30) issues.push('suspicious_query_params');
      }
      
      // Analyze request body
      if (features.body) {
        const bodyScore = this.analyzeRequestBody(features.body);
        contentScore += bodyScore;
        if (bodyScore > 30) issues.push('suspicious_request_body');
      }
      
      // Analyze headers
      const headerScore = this.analyzeRequestHeaders(features.headers);
      contentScore += headerScore;
      if (headerScore > 20) issues.push('suspicious_headers');
      
      // Analyze path
      const pathScore = this.analyzeRequestPath(features.path);
      contentScore += pathScore;
      if (pathScore > 25) issues.push('suspicious_path');
      
      return {
        type: 'content_analysis',
        score: Math.min(contentScore, 100),
        details: {
          issues_detected: issues,
          scores: {
            query: features.query_params ? this.analyzeQueryParameters(features.query_params) : 0,
            body: features.body ? this.analyzeRequestBody(features.body) : 0,
            headers: headerScore,
            path: pathScore
          }
        }
      };
    } catch (error) {
      return { type: 'content_analysis', score: 0, error: error.message };
    }
  }

  /**
   * Calculate composite threat score from all analyses
   */
  calculateCompositeThreatScore(scores) {
    const weights = {
      'pattern_analysis': 0.25,
      'behavioral_analysis': 0.20,
      'geographic_analysis': 0.15,
      'threat_intelligence': 0.25,
      'frequency_analysis': 0.10,
      'content_analysis': 0.15
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    const scoreDetails = {};
    
    scores.forEach(scoreObj => {
      const weight = weights[scoreObj.type] || 0.1;
      weightedSum += scoreObj.score * weight;
      totalWeight += weight;
      scoreDetails[scoreObj.type] = scoreObj;
    });
    
    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    return {
      total: Math.round(compositeScore),
      weighted_scores: scoreDetails,
      algorithm_version: '1.0'
    };
  }

  /**
   * Assess threat level and determine response
   */
  assessThreatLevel(compositeScore, scores) {
    const threatScore = compositeScore.total;
    let level, severity, risk_factors = [];
    
    // Extract risk factors from scores
    scores.forEach(scoreObj => {
      if (scoreObj.score > 30) {
        risk_factors.push({
          type: scoreObj.type,
          score: scoreObj.score,
          details: scoreObj.details
        });
      }
    });
    
    // Determine threat level
    if (threatScore >= 90) {
      level = 'critical';
      severity = 'critical';
    } else if (threatScore >= 70) {
      level = 'high';
      severity = 'high';
    } else if (threatScore >= 50) {
      level = 'medium';
      severity = 'warning';
    } else if (threatScore >= 30) {
      level = 'low';
      severity = 'info';
    } else {
      level = 'minimal';
      severity = 'info';
    }
    
    return {
      level: level,
      severity: severity,
      score: threatScore,
      risk_factors: risk_factors,
      recommendation: this.getThreatRecommendation(level, risk_factors)
    };
  }

  /**
   * Execute automated response based on threat level
   */
  async executeAutomatedResponse(assessment, req) {
    const actions = {
      block: false,
      alert: false,
      investigate: false,
      log: true
    };
    
    switch (assessment.level) {
      case 'critical':
        actions.block = true;
        actions.alert = true;
        actions.investigate = true;
        await this.blockIP(req.ip, 3600000, 'critical_threat_detected'); // 1 hour block
        await this.sendSecurityAlert('critical', assessment, req);
        break;
        
      case 'high':
        if (assessment.score >= 85) {
          actions.block = true;
          await this.blockIP(req.ip, 1800000, 'high_threat_detected'); // 30 min block
        }
        actions.alert = true;
        actions.investigate = true;
        await this.sendSecurityAlert('high', assessment, req);
        break;
        
      case 'medium':
        actions.investigate = true;
        if (assessment.score >= 60) {
          actions.alert = true;
          await this.addSuspiciousIP(req.ip);
        }
        break;
        
      case 'low':
        actions.investigate = true;
        await this.addSuspiciousIP(req.ip);
        break;
    }
    
    return actions;
  }

  // Helper methods for analysis

  matchAttackPatterns(features) {
    let score = 0;
    const url = features.path + JSON.stringify(features.query_params);
    const body = JSON.stringify(features.body);
    
    // Common attack patterns
    const attackPatterns = [
      { pattern: /union.*select/i, score: 60 },
      { pattern: /<script/i, score: 50 },
      { pattern: /\.\.\//g, score: 40 },
      { pattern: /cmd\.exe/i, score: 70 },
      { pattern: /\/etc\/passwd/i, score: 80 }
    ];
    
    for (const attack of attackPatterns) {
      if (attack.pattern.test(url + body)) {
        score = Math.max(score, attack.score);
      }
    }
    
    return score;
  }

  analyzeURLStructure(features) {
    let score = 0;
    
    // Suspicious URL characteristics
    if (features.path_depth > 10) score += 20;
    if (features.param_count > 20) score += 15;
    if (features.path.length > 500) score += 25;
    if (/[^a-zA-Z0-9\/\-_\.]/.test(features.path)) score += 30;
    
    return Math.min(score, 100);
  }

  calculateBehavioralDeviation(current, baseline) {
    let deviation = 0;
    
    // Compare request patterns
    const patterns = ['path_depth', 'param_count', 'content_length', 'hour_of_day'];
    
    patterns.forEach(pattern => {
      if (baseline.patterns[pattern]) {
        const currentValue = current[pattern] || 0;
        const baselineValue = baseline.patterns[pattern].average;
        const stdDev = baseline.patterns[pattern].std_deviation;
        
        if (stdDev > 0) {
          const zScore = Math.abs((currentValue - baselineValue) / stdDev);
          deviation += zScore;
        }
      }
    });
    
    return deviation / patterns.length;
  }

  matchThreatSignatures(features) {
    const signatures = [];
    const content = JSON.stringify(features);
    
    // Check against known threat signatures
    if (/sqlmap/i.test(content)) signatures.push('sqlmap_detected');
    if (/nikto/i.test(content)) signatures.push('nikto_scan');
    if (/nessus/i.test(content)) signatures.push('nessus_scan');
    if (/burp/i.test(content)) signatures.push('burp_suite');
    
    return signatures;
  }

  analyzeBotPatterns(userAgent) {
    if (!userAgent) return 30;
    
    const botIndicators = [
      { pattern: /bot|crawler|spider/i, score: 20 },
      { pattern: /python|curl|wget/i, score: 40 },
      { pattern: /^mozilla\/5\.0$/i, score: 60 }, // Generic UA
      { pattern: /sqlmap|nikto|nessus/i, score: 90 }
    ];
    
    for (const indicator of botIndicators) {
      if (indicator.pattern.test(userAgent)) {
        return indicator.score;
      }
    }
    
    return 0;
  }

  analyzeRequestTiming(requests) {
    if (requests.length < 3) return 0;
    
    const intervals = [];
    for (let i = 1; i < requests.length; i++) {
      intervals.push(requests[i].timestamp - requests[i-1].timestamp);
    }
    
    // Check for very regular intervals (automated requests)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Low variance indicates automated requests
    const regularityScore = avgInterval > 0 ? (1 - (standardDeviation / avgInterval)) * 100 : 0;
    
    return regularityScore > 0.8 ? regularityScore : 0;
  }

  analyzeQueryParameters(params) {
    let score = 0;
    const paramString = JSON.stringify(params);
    
    // Suspicious parameter patterns
    if (/union|select|insert|delete|drop/i.test(paramString)) score += 60;
    if (/<script|javascript:|on\w+=/i.test(paramString)) score += 50;
    if (/\.\.\//g.test(paramString)) score += 40;
    if (paramString.length > 2000) score += 20;
    
    return Math.min(score, 100);
  }

  analyzeRequestBody(body) {
    let score = 0;
    const bodyString = JSON.stringify(body);
    
    // Similar checks as query parameters but for body
    if (/union|select|insert|delete|drop/i.test(bodyString)) score += 60;
    if (/<script|javascript:|on\w+=/i.test(bodyString)) score += 50;
    if (bodyString.length > 50000) score += 30;
    
    return Math.min(score, 100);
  }

  analyzeRequestHeaders(headers) {
    let score = 0;
    
    // Suspicious headers
    if (!headers['user-agent']) score += 20;
    if (headers['x-forwarded-for'] && headers['x-forwarded-for'].split(',').length > 5) score += 30;
    if (headers['user-agent'] && headers['user-agent'].length > 500) score += 25;
    
    return Math.min(score, 100);
  }

  analyzeRequestPath(path) {
    let score = 0;
    
    // Suspicious path patterns
    if (path.includes('..')) score += 40;
    if (/\.(php|asp|jsp|cgi)$/i.test(path)) score += 20;
    if (path.includes('/admin') || path.includes('/login')) score += 10;
    if (path.length > 200) score += 15;
    
    return Math.min(score, 100);
  }

  // Utility methods

  getCountryFromIP(ip) {
    // Simplified - in production, use a real GeoIP service
    if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return 'LOCAL';
    }
    return 'UNKNOWN';
  }

  getThreatRecommendation(level, risk_factors) {
    const recommendations = {
      critical: 'Immediate investigation required. Consider blocking source IP.',
      high: 'Investigate within 1 hour. Monitor closely.',
      medium: 'Review within 4 hours. Increase monitoring.',
      low: 'Log for analysis. Consider rate limiting.',
      minimal: 'Standard monitoring sufficient.'
    };
    
    return recommendations[level] || 'Monitor as standard.';
  }

  async blockIP(ip, duration, reason) {
    // Implementation would integrate with firewall/security system
    console.warn(`🚫 Auto-blocking IP ${ip} for ${duration}ms - Reason: ${reason}`);
  }

  async addSuspiciousIP(ip) {
    // Add to watch list
    console.warn(`👀 Adding IP ${ip} to suspicious list`);
  }

  async sendSecurityAlert(severity, assessment, req) {
    // Implementation would send alerts via email, Slack, etc.
    console.warn(`🚨 SECURITY ALERT [${severity.toUpperCase()}] - Threat Score: ${assessment.score} from ${req.ip}`);
  }

  async logThreatAnalysis(requestId, features, scores, assessment) {
    const logEntry = {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      ip: features.ip,
      threat_score: assessment.score,
      threat_level: assessment.level,
      scores: scores,
      risk_factors: assessment.risk_factors
    };
    
    await securityHardeningService.auditLogger.logSecurityEvent({
      type: 'threat_analysis',
      severity: assessment.severity,
      ip: features.ip,
      details: logEntry
    });
  }

  // Placeholder methods for data access
  async getRequestHistory(ip, since) {
    return []; // Would query actual request history
  }

  async getLocationHistory(ip) {
    return []; // Would query location history
  }

  detectRapidLocationChanges(locationHistory) {
    return 0; // Would analyze location changes
  }

  async startLearningBaseline(ip, features) {
    // Start learning behavioral baseline
  }

  async updateBehavioralBaseline(ip, features) {
    // Update existing baseline
  }

  async initializeBehavioralBaselines() {
    // Load existing baselines from storage
  }

  async loadThreatIntelligence() {
    // Load threat intelligence feeds
  }

  startRealTimeMonitoring() {
    // Start real-time threat monitoring
  }

  startPeriodicAnalysis() {
    // Start periodic analysis tasks
  }

  /**
   * Get threat detection service status
   */
  getStatus() {
    return {
      active_threats: this.activeThreats.size,
      behavioral_baselines: this.behavioralBaselines.size,
      threat_intelligence_feeds: {
        malicious_ips: this.threatIntelligence.malicious_ips.size,
        attack_signatures: this.threatIntelligence.attack_signatures.size,
        geographic_risks: this.threatIntelligence.geographic_risks.size
      },
      ml_models_status: {
        request_pattern_classifier: 'active',
        behavioral_analyzer: 'active',
        anomaly_detector: 'active'
      },
      incident_history_count: this.incidentHistory.length
    };
  }
}

// Simplified ML model classes (in production, these would be more sophisticated)

class RequestPatternClassifier {
  async predict(features) {
    // Simplified pattern classification
    let score = 0;
    
    if (features.method === 'POST' && features.param_count > 10) score += 20;
    if (features.path_depth > 5) score += 15;
    if (features.content_length > 10000) score += 10;
    
    return Math.min(score, 100);
  }
}

class BehavioralAnalyzer {
  calculateAnomalyScore(deviation) {
    // Convert deviation to anomaly score
    return Math.min(deviation * 25, 100);
  }
}

class AnomalyDetector {
  detect(features, baseline) {
    // Simplified anomaly detection
    return Math.random() * 50; // Placeholder
  }
}

module.exports = new ThreatDetectionService();