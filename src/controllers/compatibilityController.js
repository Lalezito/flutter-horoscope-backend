const logger = require('../services/loggingService');

/**
 * 💕 COMPATIBILITY CONTROLLER
 * Handles zodiac sign compatibility calculations and analysis
 */

class CompatibilityController {

  /**
   * 🔮 GET COMPATIBILITY BETWEEN TWO SIGNS
   * GET /api/compatibility/calculate?sign1=aries&sign2=leo&language=en
   */
  async getCompatibility(req, res) {
    try {
      const { sign1, sign2, language = 'en' } = req.query;

      if (!sign1 || !sign2) {
        return res.status(400).json({
          success: false,
          error: 'Both sign1 and sign2 parameters are required',
          code: 'MISSING_SIGNS'
        });
      }

      // Normalize sign names
      const normalizedSign1 = this.normalizeSignName(sign1);
      const normalizedSign2 = this.normalizeSignName(sign2);

      // Calculate compatibility
      const compatibility = this.calculateCompatibility(normalizedSign1, normalizedSign2, language);

      logger.getLogger().info('Compatibility calculation', {
        sign1: normalizedSign1,
        sign2: normalizedSign2,
        language,
        compatibility: compatibility.overall,
        ip: req.ip
      });

      res.json({
        success: true,
        compatibility,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        endpoint: 'getCompatibility',
        params: req.query,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Compatibility calculation failed',
        code: 'CALCULATION_ERROR'
      });
    }
  }

  /**
   * 🌟 GET ALL COMPATIBILITY COMBINATIONS FOR A SIGN
   * GET /api/compatibility/sign/aries?language=en
   */
  async getSignCompatibilities(req, res) {
    try {
      const { sign } = req.params;
      const { language = 'en' } = req.query;

      if (!sign) {
        return res.status(400).json({
          success: false,
          error: 'Sign parameter is required',
          code: 'MISSING_SIGN'
        });
      }

      const normalizedSign = this.normalizeSignName(sign);
      const allSigns = [
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
      ];

      const compatibilities = allSigns
        .filter(s => s !== normalizedSign)
        .map(targetSign => {
          const compatibility = this.calculateCompatibility(normalizedSign, targetSign, language);
          return {
            sign: targetSign,
            compatibility: compatibility.overall,
            love: compatibility.love,
            friendship: compatibility.friendship,
            business: compatibility.business,
            summary: compatibility.summary
          };
        })
        .sort((a, b) => b.compatibility - a.compatibility);

      logger.getLogger().info('Sign compatibilities request', {
        sign: normalizedSign,
        language,
        results: compatibilities.length,
        ip: req.ip
      });

      res.json({
        success: true,
        sign: normalizedSign,
        compatibilities,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        endpoint: 'getSignCompatibilities',
        sign: req.params.sign,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Sign compatibilities calculation failed',
        code: 'CALCULATION_ERROR'
      });
    }
  }

  /**
   * 📊 GET DETAILED COMPATIBILITY ANALYSIS
   * POST /api/compatibility/analysis
   */
  async getDetailedAnalysis(req, res) {
    try {
      const { sign1, sign2, language = 'en', includeAdvice = true } = req.body;

      if (!sign1 || !sign2) {
        return res.status(400).json({
          success: false,
          error: 'Both sign1 and sign2 are required',
          code: 'MISSING_SIGNS'
        });
      }

      const normalizedSign1 = this.normalizeSignName(sign1);
      const normalizedSign2 = this.normalizeSignName(sign2);

      // Get detailed analysis
      const analysis = this.getDetailedCompatibilityAnalysis(
        normalizedSign1, 
        normalizedSign2, 
        language, 
        includeAdvice
      );

      logger.getLogger().info('Detailed compatibility analysis', {
        sign1: normalizedSign1,
        sign2: normalizedSign2,
        language,
        overall: analysis.overall,
        ip: req.ip
      });

      res.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        endpoint: 'getDetailedAnalysis',
        body: req.body,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Detailed analysis failed',
        code: 'ANALYSIS_ERROR'
      });
    }
  }

  /**
   * 💡 GET COMPATIBILITY INSIGHTS
   * POST /api/compatibility/insights
   */
  async getCompatibilityInsights(req, res) {
    try {
      const { sign1, sign2, language = 'en', type = 'relationship' } = req.body;

      if (!sign1 || !sign2) {
        return res.status(400).json({
          success: false,
          error: 'Both sign1 and sign2 are required',
          code: 'MISSING_SIGNS'
        });
      }

      const normalizedSign1 = this.normalizeSignName(sign1);
      const normalizedSign2 = this.normalizeSignName(sign2);

      // Get insights based on type
      const insights = this.generateCompatibilityInsights(
        normalizedSign1,
        normalizedSign2,
        language,
        type
      );

      logger.getLogger().info('Compatibility insights request', {
        sign1: normalizedSign1,
        sign2: normalizedSign2,
        language,
        type,
        ip: req.ip
      });

      res.json({
        success: true,
        insights,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        endpoint: 'getCompatibilityInsights',
        body: req.body,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Compatibility insights failed',
        code: 'INSIGHTS_ERROR'
      });
    }
  }

  /**
   * 📈 GET COMPATIBILITY STATISTICS (Admin only)
   * GET /api/compatibility/stats?admin_key=YOUR_ADMIN_KEY
   */
  async getCompatibilityStats(req, res) {
    try {
      // Admin authentication
      const adminKey = req.query.admin_key || req.headers['x-admin-key'];
      const expectedAdminKey = process.env.ADMIN_KEY;

      if (!adminKey || !expectedAdminKey || adminKey !== expectedAdminKey) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      // Generate statistics
      const stats = this.generateCompatibilityStats();

      logger.getLogger().info('Compatibility stats request', {
        adminIP: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.logError(error, {
        endpoint: 'getCompatibilityStats',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Stats retrieval failed',
        code: 'STATS_ERROR'
      });
    }
  }

  // PUBLIC UTILITY METHODS

  /**
   * 🔤 NORMALIZE SIGN NAME
   */
  normalizeSignName(signName) {
    const normalized = signName.toLowerCase().trim();
    
    // Mapeo de variaciones comunes
    const signMappings = {
      'acuario': 'aquarius',
      'aquarius': 'aquarius',
      'piscis': 'pisces', 
      'pisces': 'pisces',
      'aries': 'aries',
      'tauro': 'taurus',
      'taurus': 'taurus',
      'géminis': 'gemini',
      'geminis': 'gemini',
      'gemini': 'gemini',
      'cáncer': 'cancer',
      'cancer': 'cancer',
      'leo': 'leo',
      'virgo': 'virgo',
      'libra': 'libra',
      'escorpio': 'scorpio',
      'scorpio': 'scorpio',
      'sagitario': 'sagittarius',
      'sagittarius': 'sagittarius',
      'capricornio': 'capricorn',
      'capricorn': 'capricorn',
    };
    
    return signMappings[normalized] || normalized;
  }

  /**
   * 🧮 CALCULATE COMPATIBILITY BETWEEN TWO SIGNS
   */
  calculateCompatibility(sign1, sign2, language = 'en') {
    // Compatibility matrix (1-10 scale)
    const compatibilityMatrix = {
      'aries': { 'aries': 7, 'taurus': 4, 'gemini': 8, 'cancer': 5, 'leo': 9, 'virgo': 4, 'libra': 7, 'scorpio': 6, 'sagittarius': 9, 'capricorn': 4, 'aquarius': 8, 'pisces': 5 },
      'taurus': { 'aries': 4, 'taurus': 8, 'gemini': 5, 'cancer': 9, 'leo': 6, 'virgo': 10, 'libra': 7, 'scorpio': 8, 'sagittarius': 4, 'capricorn': 9, 'aquarius': 5, 'pisces': 8 },
      'gemini': { 'aries': 8, 'taurus': 5, 'gemini': 7, 'cancer': 6, 'leo': 8, 'virgo': 6, 'libra': 9, 'scorpio': 5, 'sagittarius': 8, 'capricorn': 5, 'aquarius': 10, 'pisces': 6 },
      'cancer': { 'aries': 5, 'taurus': 9, 'gemini': 6, 'cancer': 8, 'leo': 7, 'virgo': 9, 'libra': 6, 'scorpio': 10, 'sagittarius': 5, 'capricorn': 8, 'aquarius': 5, 'pisces': 9 },
      'leo': { 'aries': 9, 'taurus': 6, 'gemini': 8, 'cancer': 7, 'leo': 8, 'virgo': 5, 'libra': 8, 'scorpio': 7, 'sagittarius': 10, 'capricorn': 5, 'aquarius': 8, 'pisces': 6 },
      'virgo': { 'aries': 4, 'taurus': 10, 'gemini': 6, 'cancer': 9, 'leo': 5, 'virgo': 7, 'libra': 7, 'scorpio': 8, 'sagittarius': 4, 'capricorn': 10, 'aquarius': 6, 'pisces': 8 },
      'libra': { 'aries': 7, 'taurus': 7, 'gemini': 9, 'cancer': 6, 'leo': 8, 'virgo': 7, 'libra': 8, 'scorpio': 6, 'sagittarius': 8, 'capricorn': 6, 'aquarius': 10, 'pisces': 7 },
      'scorpio': { 'aries': 6, 'taurus': 8, 'gemini': 5, 'cancer': 10, 'leo': 7, 'virgo': 8, 'libra': 6, 'scorpio': 8, 'sagittarius': 6, 'capricorn': 8, 'aquarius': 6, 'pisces': 10 },
      'sagittarius': { 'aries': 9, 'taurus': 4, 'gemini': 8, 'cancer': 5, 'leo': 10, 'virgo': 4, 'libra': 8, 'scorpio': 6, 'sagittarius': 8, 'capricorn': 5, 'aquarius': 9, 'pisces': 6 },
      'capricorn': { 'aries': 4, 'taurus': 9, 'gemini': 5, 'cancer': 8, 'leo': 5, 'virgo': 10, 'libra': 6, 'scorpio': 8, 'sagittarius': 5, 'capricorn': 8, 'aquarius': 6, 'pisces': 8 },
      'aquarius': { 'aries': 8, 'taurus': 5, 'gemini': 10, 'cancer': 5, 'leo': 8, 'virgo': 6, 'libra': 10, 'scorpio': 6, 'sagittarius': 9, 'capricorn': 6, 'aquarius': 7, 'pisces': 7 },
      'pisces': { 'aries': 5, 'taurus': 8, 'gemini': 6, 'cancer': 9, 'leo': 6, 'virgo': 8, 'libra': 7, 'scorpio': 10, 'sagittarius': 6, 'capricorn': 8, 'aquarius': 7, 'pisces': 8 }
    };

    const overall = compatibilityMatrix[sign1]?.[sign2] || 5;
    
    // Generate specific compatibility scores
    const love = this.adjustScore(overall, 'love', sign1, sign2);
    const friendship = this.adjustScore(overall, 'friendship', sign1, sign2);
    const business = this.adjustScore(overall, 'business', sign1, sign2);

    return {
      overall,
      love,
      friendship,
      business,
      percentage: Math.round(overall * 10),
      rating: this.getCompatibilityRating(overall, language),
      summary: this.getCompatibilitySummary(sign1, sign2, overall, language)
    };
  }

  /**
   * 🎯 ADJUST SCORE FOR SPECIFIC RELATIONSHIP TYPES
   */
  adjustScore(baseScore, type, sign1, sign2) {
    const adjustments = {
      love: { 'fire': 1, 'earth': -1, 'air': 0, 'water': 0 },
      friendship: { 'fire': 0, 'earth': 0, 'air': 1, 'water': 0 },
      business: { 'fire': 0, 'earth': 1, 'air': 0, 'water': -1 }
    };

    const elements = {
      'aries': 'fire', 'leo': 'fire', 'sagittarius': 'fire',
      'taurus': 'earth', 'virgo': 'earth', 'capricorn': 'earth',
      'gemini': 'air', 'libra': 'air', 'aquarius': 'air',
      'cancer': 'water', 'scorpio': 'water', 'pisces': 'water'
    };

    const element1 = elements[sign1];
    const element2 = elements[sign2];
    const adjustment = (adjustments[type]?.[element1] || 0) + (adjustments[type]?.[element2] || 0);
    
    return Math.max(1, Math.min(10, baseScore + adjustment));
  }

  /**
   * ⭐ GET COMPATIBILITY RATING
   */
  getCompatibilityRating(score, language = 'en') {
    const ratings = {
      en: {
        10: 'Perfect Match', 9: 'Excellent', 8: 'Very Good', 7: 'Good',
        6: 'Fair', 5: 'Average', 4: 'Challenging', 3: 'Difficult',
        2: 'Very Difficult', 1: 'Incompatible'
      },
      es: {
        10: 'Pareja Perfecta', 9: 'Excelente', 8: 'Muy Bueno', 7: 'Bueno',
        6: 'Regular', 5: 'Promedio', 4: 'Desafiante', 3: 'Difícil',
        2: 'Muy Difícil', 1: 'Incompatible'
      }
    };

    return ratings[language]?.[score] || ratings.en[score] || 'Unknown';
  }

  /**
   * 📝 GET COMPATIBILITY SUMMARY
   */
  getCompatibilitySummary(sign1, sign2, score, language = 'en') {
    const summaries = {
      en: {
        high: `${sign1} and ${sign2} have excellent compatibility with strong potential for lasting harmony.`,
        medium: `${sign1} and ${sign2} can work well together with mutual understanding and effort.`,
        low: `${sign1} and ${sign2} may face challenges but can grow through their differences.`
      },
      es: {
        high: `${sign1} y ${sign2} tienen excelente compatibilidad con gran potencial para armonía duradera.`,
        medium: `${sign1} y ${sign2} pueden funcionar bien juntos con comprensión mutua y esfuerzo.`,
        low: `${sign1} y ${sign2} pueden enfrentar desafíos pero pueden crecer a través de sus diferencias.`
      }
    };

    const category = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';
    return summaries[language]?.[category] || summaries.en[category];
  }

  /**
   * 🔍 GET DETAILED COMPATIBILITY ANALYSIS
   */
  getDetailedCompatibilityAnalysis(sign1, sign2, language = 'en', includeAdvice = true) {
    const basic = this.calculateCompatibility(sign1, sign2, language);
    
    return {
      ...basic,
      strengths: this.getCompatibilityStrengths(sign1, sign2, language),
      challenges: this.getCompatibilityChallenges(sign1, sign2, language),
      advice: includeAdvice ? this.getCompatibilityAdvice(sign1, sign2, language) : null,
      elementalHarmony: this.getElementalHarmony(sign1, sign2, language),
      modalityConnection: this.getModalityConnection(sign1, sign2, language)
    };
  }

  /**
   * 💪 GET COMPATIBILITY STRENGTHS
   */
  getCompatibilityStrengths(sign1, sign2, language = 'en') {
    const strengths = {
      en: [
        'Shared values and goals',
        'Complementary personality traits',
        'Strong communication potential',
        'Mutual respect and admiration',
        'Balanced energy exchange'
      ],
      es: [
        'Valores y metas compartidos',
        'Rasgos de personalidad complementarios',
        'Fuerte potencial de comunicación',
        'Respeto y admiración mutua',
        'Intercambio de energía equilibrado'
      ]
    };

    return strengths[language]?.slice(0, 3) || strengths.en.slice(0, 3);
  }

  /**
   * ⚠️ GET COMPATIBILITY CHALLENGES
   */
  getCompatibilityChallenges(sign1, sign2, language = 'en') {
    const challenges = {
      en: [
        'Different communication styles',
        'Varying emotional needs',
        'Conflicting approaches to life',
        'Need for compromise and understanding'
      ],
      es: [
        'Estilos de comunicación diferentes',
        'Necesidades emocionales variadas',
        'Enfoques conflictivos de la vida',
        'Necesidad de compromiso y comprensión'
      ]
    };

    return challenges[language]?.slice(0, 2) || challenges.en.slice(0, 2);
  }

  /**
   * 💡 GET COMPATIBILITY ADVICE
   */
  getCompatibilityAdvice(sign1, sign2, language = 'en') {
    const advice = {
      en: [
        'Focus on open and honest communication',
        'Respect each other\'s differences',
        'Find common ground and shared interests',
        'Be patient and understanding with each other'
      ],
      es: [
        'Enfóquense en la comunicación abierta y honesta',
        'Respeten las diferencias del otro',
        'Encuentren puntos en común e intereses compartidos',
        'Sean pacientes y comprensivos entre ustedes'
      ]
    };

    return advice[language]?.slice(0, 3) || advice.en.slice(0, 3);
  }

  /**
   * 🌟 GET ELEMENTAL HARMONY
   */
  getElementalHarmony(sign1, sign2, language = 'en') {
    const elements = {
      'aries': 'fire', 'leo': 'fire', 'sagittarius': 'fire',
      'taurus': 'earth', 'virgo': 'earth', 'capricorn': 'earth',
      'gemini': 'air', 'libra': 'air', 'aquarius': 'air',
      'cancer': 'water', 'scorpio': 'water', 'pisces': 'water'
    };

    const element1 = elements[sign1];
    const element2 = elements[sign2];

    if (element1 === element2) {
      return language === 'es' ? 'Armonía elemental fuerte' : 'Strong elemental harmony';
    }

    const compatible = {
      fire: ['air'],
      earth: ['water'],
      air: ['fire'],
      water: ['earth']
    };

    if (compatible[element1]?.includes(element2)) {
      return language === 'es' ? 'Elementos complementarios' : 'Complementary elements';
    }

    return language === 'es' ? 'Elementos contrastantes' : 'Contrasting elements';
  }

  /**
   * 🔄 GET MODALITY CONNECTION
   */
  getModalityConnection(sign1, sign2, language = 'en') {
    const modalities = {
      'aries': 'cardinal', 'cancer': 'cardinal', 'libra': 'cardinal', 'capricorn': 'cardinal',
      'taurus': 'fixed', 'leo': 'fixed', 'scorpio': 'fixed', 'aquarius': 'fixed',
      'gemini': 'mutable', 'virgo': 'mutable', 'sagittarius': 'mutable', 'pisces': 'mutable'
    };

    const modality1 = modalities[sign1];
    const modality2 = modalities[sign2];

    if (modality1 === modality2) {
      return language === 'es' ? 'Enfoque similar de vida' : 'Similar life approach';
    }

    return language === 'es' ? 'Enfoques de vida diferentes' : 'Different life approaches';
  }

  /**
   * 🎯 GENERATE COMPATIBILITY INSIGHTS
   */
  generateCompatibilityInsights(sign1, sign2, language = 'en', type = 'relationship') {
    const basic = this.calculateCompatibility(sign1, sign2, language);
    
    return {
      type,
      compatibility: basic,
      keyInsights: this.getKeyInsights(sign1, sign2, type, language),
      recommendations: this.getRecommendations(sign1, sign2, type, language),
      timeline: this.getCompatibilityTimeline(sign1, sign2, language)
    };
  }

  /**
   * 🔑 GET KEY INSIGHTS
   */
  getKeyInsights(sign1, sign2, type, language = 'en') {
    const insights = {
      en: {
        relationship: [
          'Communication is key to success',
          'Respect individual differences',
          'Build on shared values'
        ],
        friendship: [
          'Natural understanding develops over time',
          'Shared adventures strengthen the bond',
          'Mutual support is essential'
        ],
        business: [
          'Complementary skills create success',
          'Clear boundaries improve cooperation',
          'Shared vision drives progress'
        ]
      },
      es: {
        relationship: [
          'La comunicación es clave para el éxito',
          'Respeta las diferencias individuales',
          'Construye sobre valores compartidos'
        ],
        friendship: [
          'El entendimiento natural se desarrolla con el tiempo',
          'Las aventuras compartidas fortalecen el vínculo',
          'El apoyo mutuo es esencial'
        ],
        business: [
          'Las habilidades complementarias crean éxito',
          'Los límites claros mejoran la cooperación',
          'La visión compartida impulsa el progreso'
        ]
      }
    };

    return insights[language]?.[type] || insights.en[type];
  }

  /**
   * 📋 GET RECOMMENDATIONS
   */
  getRecommendations(sign1, sign2, type, language = 'en') {
    const recommendations = {
      en: [
        'Schedule regular check-ins',
        'Celebrate differences as strengths',
        'Practice active listening',
        'Create shared goals together'
      ],
      es: [
        'Programa revisiones regulares',
        'Celebra las diferencias como fortalezas',
        'Practica la escucha activa',
        'Crea metas compartidas juntos'
      ]
    };

    return recommendations[language]?.slice(0, 3) || recommendations.en.slice(0, 3);
  }

  /**
   * 📅 GET COMPATIBILITY TIMELINE
   */
  getCompatibilityTimeline(sign1, sign2, language = 'en') {
    return {
      initial: language === 'es' ? 'Atracción inicial fuerte' : 'Strong initial attraction',
      developing: language === 'es' ? 'Comprensión gradual' : 'Gradual understanding',
      mature: language === 'es' ? 'Armonía establecida' : 'Established harmony'
    };
  }

  /**
   * 📊 GENERATE COMPATIBILITY STATISTICS
   */
  generateCompatibilityStats() {
    return {
      service: 'Compatibility Analysis Service',
      version: '2.0.0',
      totalSigns: 12,
      totalCombinations: 144,
      supportedLanguages: ['en', 'es', 'de', 'fr', 'it', 'pt'],
      analysisTypes: ['love', 'friendship', 'business'],
      features: [
        'Basic compatibility scoring',
        'Detailed analysis with strengths and challenges',
        'Personalized insights and recommendations',
        'Elemental and modality analysis',
        'Multi-language support'
      ],
      endpoints: {
        calculate: '/api/compatibility/calculate',
        signCompatibilities: '/api/compatibility/sign/:sign',
        detailedAnalysis: '/api/compatibility/analysis',
        insights: '/api/compatibility/insights',
        stats: '/api/compatibility/stats'
      },
      accuracy: 'Based on traditional astrological principles',
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new CompatibilityController();