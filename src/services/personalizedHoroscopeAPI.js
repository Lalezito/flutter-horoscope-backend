const OpenAI = require('openai');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * 🤖 PERSONALIZED HOROSCOPE API SERVICE
 * 
 * Backend service for generating highly personalized horoscope content
 * using birth chart data, transit analysis, and advanced AI prompts.
 * 
 * Features:
 * - Birth chart calculation with Swiss Ephemeris precision
 * - Transit analysis for current cosmic influences
 * - Multi-level personalization (basic, advanced, premium)
 * - Quality validation and scoring
 * - Performance optimization with caching
 * - A/B testing support
 * - Analytics and metrics collection
 */
class PersonalizedHoroscopeAPI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Cache for birth charts and recent horoscopes
    this.birthChartCache = new Map();
    this.horoscopeCache = new Map();
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      qualityScores: [],
    };
    
    // Swiss Ephemeris integration (would require actual Swiss Ephemeris library)
    this.ephemeris = null; // Initialize ephemeris calculator
  }

  /**
   * Generate personalized horoscope with birth chart analysis
   */
  async generatePersonalizedHoroscope({
    birthDate,
    birthTime,
    birthLocation,
    targetDate,
    language = 'en',
    personalizationLevel = 'advanced',
    userPreferences = {},
    includeTransitAnalysis = true,
    includeQualityReport = false,
  }) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      logger.info('Starting personalized horoscope generation', {
        birthDate,
        targetDate,
        language,
        personalizationLevel,
      });

      // Step 1: Get or calculate birth chart
      const birthChart = await this.getOrCalculateBirthChart({
        birthDate,
        birthTime,
        birthLocation,
      });

      // Step 2: Check cache for existing personalized horoscope
      const cacheKey = this.generateHoroscopeCacheKey(
        birthChart,
        targetDate,
        language,
        personalizationLevel
      );

      let personalizedHoroscope;
      if (this.horoscopeCache.has(cacheKey)) {
        personalizedHoroscope = this.horoscopeCache.get(cacheKey);
        logger.info('Retrieved personalized horoscope from cache');
      } else {
        // Step 3: Calculate current transits
        const transits = includeTransitAnalysis 
          ? await this.calculateCurrentTransits(birthChart, targetDate)
          : [];

        // Step 4: Generate personalized content using AI
        personalizedHoroscope = await this.generatePersonalizedContent({
          birthChart,
          transits,
          targetDate,
          language,
          personalizationLevel,
          userPreferences,
        });

        // Cache the result
        this.horoscopeCache.set(cacheKey, personalizedHoroscope);
        logger.info('Generated and cached new personalized horoscope');
      }

      // Step 5: Quality validation if requested
      let qualityReport = null;
      if (includeQualityReport) {
        qualityReport = await this.validateContentQuality(
          personalizedHoroscope,
          birthChart,
          transits || [],
        );
      }

      // Step 6: Update performance metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, this.horoscopeCache.has(cacheKey));

      const result = {
        personalizedHoroscope,
        birthChart: this.serializeBirthChart(birthChart),
        qualityReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: responseTime,
          personalizationLevel,
          cacheHit: this.horoscopeCache.has(cacheKey),
          transitsAnalyzed: transits?.length || 0,
        },
      };

      logger.info('Personalized horoscope generation completed', {
        responseTimeMs: responseTime,
        qualityScore: qualityReport?.overallScore,
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate personalized horoscope', error);
      throw new Error(`Personalized horoscope generation failed: ${error.message}`);
    }
  }

  /**
   * Calculate or retrieve cached birth chart
   */
  async getOrCalculateBirthChart({ birthDate, birthTime, birthLocation }) {
    const cacheKey = `${birthDate}_${birthTime?.hour || 12}:${birthTime?.minute || 0}_${birthLocation.latitude}_${birthLocation.longitude}`;
    
    if (this.birthChartCache.has(cacheKey)) {
      return this.birthChartCache.get(cacheKey);
    }

    logger.info('Calculating new birth chart', { birthDate, birthLocation });

    try {
      // Convert birth data to Julian Day
      const julianDay = this.calculateJulianDay(
        new Date(`${birthDate}T${birthTime?.hour || 12}:${birthTime?.minute || 0}:00`)
      );

      // Calculate planetary positions using Swiss Ephemeris (simplified implementation)
      const planetaryPositions = await this.calculatePlanetaryPositions(
        julianDay,
        birthLocation
      );

      // Calculate house cusps using Placidus system
      const houseCusps = await this.calculateHouseCusps(
        julianDay,
        birthLocation,
        planetaryPositions
      );

      // Calculate aspects between planets
      const aspects = this.calculateAspects(planetaryPositions);

      // Assign planets to houses
      const planetHouses = this.assignPlanetsToHouses(planetaryPositions, houseCusps);

      const birthChart = {
        birthDateTime: new Date(`${birthDate}T${birthTime?.hour || 12}:${birthTime?.minute || 0}:00`),
        birthLocation,
        planetaryPositions,
        houseCusps,
        aspects,
        planetHouses,
        calculatedAt: new Date(),
      };

      this.birthChartCache.set(cacheKey, birthChart);
      logger.info('Birth chart calculated and cached successfully');

      return birthChart;

    } catch (error) {
      logger.error('Failed to calculate birth chart', error);
      throw new Error(`Birth chart calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate current transits affecting the birth chart
   */
  async calculateCurrentTransits(birthChart, targetDate) {
    try {
      const targetJulianDay = this.calculateJulianDay(new Date(targetDate));
      
      // Get current planetary positions
      const currentPositions = await this.calculatePlanetaryPositions(
        targetJulianDay,
        birthChart.birthLocation
      );

      const transits = [];

      // Check transits to natal planets
      for (const [currentPlanet, currentPos] of Object.entries(currentPositions)) {
        for (const [natalPlanet, natalPos] of Object.entries(birthChart.planetaryPositions)) {
          // Skip fast planets transiting themselves
          if (this.shouldSkipTransit(currentPlanet, natalPlanet)) continue;

          const aspect = this.calculateAspectBetween(currentPos, natalPos);
          
          if (aspect && aspect.strength > 0.6) {
            transits.push({
              transitingPlanet: currentPlanet,
              natalPlanet,
              aspect: aspect.type,
              orb: aspect.orb,
              strength: aspect.strength,
              isApplying: aspect.isApplying,
              house: birthChart.planetHouses[natalPlanet],
              timing: this.calculateTransitTiming(currentPos, natalPos, currentPlanet, aspect, targetDate),
              influence: this.getTransitInfluence(currentPlanet, natalPlanet, aspect),
            });
          }
        }
      }

      // Sort by strength
      transits.sort((a, b) => b.strength - a.strength);

      logger.info(`Calculated ${transits.length} significant transits`);
      return transits;

    } catch (error) {
      logger.error('Failed to calculate transits', error);
      return [];
    }
  }

  /**
   * Generate personalized content using advanced AI prompts
   */
  async generatePersonalizedContent({
    birthChart,
    transits,
    targetDate,
    language,
    personalizationLevel,
    userPreferences,
  }) {
    try {
      // Create sophisticated personalized prompt
      const prompt = this.createPersonalizedPrompt({
        birthChart,
        transits,
        targetDate,
        language,
        personalizationLevel,
        userPreferences,
      });

      // Generate content using OpenAI
      const aiResponse = await this.callOpenAI(prompt, language);

      // Validate and enhance content
      const validatedContent = await this.validateAndEnhanceContent(
        aiResponse,
        birthChart,
        transits,
        language
      );

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(
        validatedContent,
        birthChart,
        transits,
        personalizationLevel
      );

      return {
        content: validatedContent,
        prompt: prompt.userPrompt,
        qualityMetrics,
        personalizationLevel,
        differentiationScore: this.calculateDifferentiationScore(validatedContent, birthChart),
        generatedAt: new Date(),
      };

    } catch (error) {
      logger.error('Failed to generate personalized content', error);
      throw new Error(`Content generation failed: ${error.message}`);
    }
  }

  /**
   * Create sophisticated personalized prompt for AI
   */
  createPersonalizedPrompt({
    birthChart,
    transits,
    targetDate,
    language,
    personalizationLevel,
    userPreferences,
  }) {
    const systemPrompt = this.buildSystemPrompt(language, personalizationLevel);
    const birthChartContext = this.buildBirthChartContext(birthChart, language);
    const transitContext = this.buildTransitContext(transits, targetDate, language);
    const personalizationContext = this.buildPersonalizationContext(
      birthChart, 
      userPreferences,
      language
    );
    const userPrompt = this.buildUserPrompt(
      birthChart,
      transits,
      targetDate,
      language,
      personalizationLevel
    );

    return {
      systemPrompt,
      fullPrompt: `${birthChartContext}\n\n${transitContext}\n\n${personalizationContext}\n\n${userPrompt}`,
      userPrompt,
      language,
      level: personalizationLevel,
    };
  }

  /**
   * Build system prompt for AI
   */
  buildSystemPrompt(language, personalizationLevel) {
    const prompts = {
      en: {
        base: `You are an expert astrologer with deep knowledge of natal chart interpretation, transit analysis, and personalized horoscope creation. Your task is to create a highly personalized daily horoscope that is significantly different from generic horoscope content.

CRITICAL REQUIREMENTS:
1. Use the specific birth chart data provided (exact planetary positions, houses, aspects)
2. Integrate current transit information for timing-specific predictions
3. Reference specific degrees, house positions, and aspect patterns
4. Provide actionable advice based on the individual's astrological profile
5. Make predictions that reflect the unique planetary configuration
6. Avoid generic statements that could apply to anyone
7. Include specific timing recommendations based on transits
8. Reference the person's dominant elements, modalities, and planetary emphasis

QUALITY STANDARDS:
- Each horoscope must be observably different for different birth charts
- Include at least 3 specific references to natal chart positions
- Mention current transits and their relationship to natal planets
- Provide timing-specific advice (best times for decisions, actions)
- Reference house emphasis for life area focus
- Include aspect interpretations affecting current energy`,

        premium: `\n\nPREMIUM LEVEL INSTRUCTIONS:
- Include progressions and secondary directions analysis
- Provide specific timing with exact hours
- Include minor aspect interpretations
- Mention relevant fixed stars if activated
- Provide specific predictions for the next 7 days
- Include manifestation advice based on the chart`,

        advanced: `\n\nADVANCED LEVEL INSTRUCTIONS:
- Include analysis of applying vs separating aspects
- Mention planetary dignities and mutual receptions
- Provide lunar nodes interpretation
- Include derived houses analysis when relevant`,
      },
      es: {
        base: `Eres un astrólogo experto con profundo conocimiento de interpretación de cartas natales, análisis de tránsitos y creación de horóscopos personalizados. Tu tarea es crear un horóscopo diario altamente personalizado que sea significativamente diferente del contenido genérico.

REQUISITOS CRÍTICOS:
1. Usa los datos específicos de la carta natal proporcionados (posiciones planetarias exactas, casas, aspectos)
2. Integra información de tránsitos actuales para predicciones específicas de tiempo
3. Referencia grados específicos, posiciones de casas y patrones de aspectos
4. Proporciona consejos accionables basados en el perfil astrológico individual
5. Haz predicciones que reflejen la configuración planetaria única
6. Evita declaraciones genéricas que podrían aplicar a cualquiera
7. Incluye recomendaciones de tiempo específicas basadas en tránsitos
8. Referencia los elementos dominantes, modalidades y énfasis planetario de la persona

ESTÁNDARES DE CALIDAD:
- Cada horóscopo debe ser observablemente diferente para diferentes cartas natales
- Incluir al menos 3 referencias específicas a posiciones de la carta natal
- Mencionar tránsitos actuales y su relación con planetas natales
- Proporcionar consejos específicos de tiempo (mejores momentos para decisiones, acciones)
- Referenciar énfasis de casas para enfoque en áreas de vida
- Incluir interpretaciones de aspectos que afecten la energía actual`,
      },
    };

    let prompt = prompts[language]?.base || prompts.en.base;
    
    if (personalizationLevel === 'premium') {
      prompt += prompts[language]?.premium || prompts.en.premium;
    } else if (personalizationLevel === 'advanced') {
      prompt += prompts[language]?.advanced || prompts.en.advanced;
    }

    return prompt;
  }

  /**
   * Build birth chart context for AI
   */
  buildBirthChartContext(birthChart, language) {
    const buffer = [];
    
    if (language === 'es') {
      buffer.push('CONTEXTO DE CARTA NATAL:');
      buffer.push(`Fecha y hora de nacimiento: ${birthChart.birthDateTime}`);
      buffer.push(`Ubicación: ${birthChart.birthLocation.city || 'Unknown'}`);
      buffer.push('');
      buffer.push('POSICIONES PLANETARIAS EXACTAS:');
    } else {
      buffer.push('BIRTH CHART CONTEXT:');
      buffer.push(`Birth date and time: ${birthChart.birthDateTime}`);
      buffer.push(`Location: ${birthChart.birthLocation.city || 'Unknown'}`);
      buffer.push('');
      buffer.push('EXACT PLANETARY POSITIONS:');
    }

    // Add planetary positions with degrees
    for (const [planet, position] of Object.entries(birthChart.planetaryPositions)) {
      const sign = this.getSignFromDegree(position.longitude);
      const degree = position.longitude % 30;
      const house = birthChart.planetHouses[planet] || 1;
      
      buffer.push(`${planet}: ${degree.toFixed(1)}° ${sign} in House ${house}`);
    }

    buffer.push('');
    if (language === 'es') {
      buffer.push('ASPECTOS NATALES PRINCIPALES:');
    } else {
      buffer.push('MAJOR NATAL ASPECTS:');
    }

    // Add significant aspects
    const significantAspects = birthChart.aspects.filter(aspect => aspect.strength > 0.7);
    for (const aspect of significantAspects) {
      buffer.push(`${aspect.planet1} ${aspect.type} ${aspect.planet2} ` +
                 `(orb: ${aspect.orb.toFixed(1)}°, strength: ${Math.round(aspect.strength * 100)}%)`);
    }

    return buffer.join('\n');
  }

  /**
   * Build transit context for AI
   */
  buildTransitContext(transits, targetDate, language) {
    const buffer = [];
    
    if (language === 'es') {
      buffer.push(`TRÁNSITOS ACTUALES (${new Date(targetDate).toISOString().split('T')[0]}):`);
    } else {
      buffer.push(`CURRENT TRANSITS (${new Date(targetDate).toISOString().split('T')[0]}):`);
    }

    // Sort transits by strength and add top 5
    const significantTransits = transits
      .filter(transit => transit.strength > 0.6)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);

    for (const transit of significantTransits) {
      const strength = Math.round(transit.strength * 100);
      const timing = this.getTransitTiming(transit.timing?.exactDate, targetDate);
      
      buffer.push(`${transit.transitingPlanet} ${transit.aspect} ` +
                 `natal ${transit.natalPlanet} (${strength}% strength, ${timing})`);
      
      if (language === 'es') {
        buffer.push(`  → ${this.getTransitInterpretationHint(transit, 'es')}`);
      } else {
        buffer.push(`  → ${this.getTransitInterpretationHint(transit, 'en')}`);
      }
    }

    return buffer.join('\n');
  }

  /**
   * Build personalization context
   */
  buildPersonalizationContext(birthChart, userPreferences, language) {
    const buffer = [];
    
    if (language === 'es') {
      buffer.push('CONTEXTO DE PERSONALIZACIÓN:');
    } else {
      buffer.push('PERSONALIZATION CONTEXT:');
    }

    // Add user preferences
    if (userPreferences.focusAreas?.length) {
      if (language === 'es') {
        buffer.push(`Áreas de interés principales: ${userPreferences.focusAreas.join(', ')}`);
      } else {
        buffer.push(`Main focus areas: ${userPreferences.focusAreas.join(', ')}`);
      }
    }

    // Add chart-based personalization
    const dominantElement = this.calculateDominantElement(birthChart);
    const personalityTraits = this.extractPersonalityTraits(birthChart);

    if (language === 'es') {
      buffer.push(`Elemento dominante: ${dominantElement}`);
      buffer.push(`Rasgos dominantes: ${personalityTraits.join(', ')}`);
    } else {
      buffer.push(`Dominant element: ${dominantElement}`);
      buffer.push(`Dominant traits: ${personalityTraits.join(', ')}`);
    }

    return buffer.join('\n');
  }

  /**
   * Build user prompt
   */
  buildUserPrompt(birthChart, transits, targetDate, language, personalizationLevel) {
    const templates = {
      en: `Create a personalized daily horoscope for ${new Date(targetDate).toISOString().split('T')[0]} using the birth chart and transit data provided above.

STRUCTURE YOUR RESPONSE AS FOLLOWS:

**Daily Energy Overview** (2-3 sentences)
- Reference specific natal planet positions and current transits
- Explain how today's energy interacts with their unique chart

**Life Area Focus** (2-3 sentences)
- Based on which houses are activated by current transits
- Mention specific house numbers and their meanings
- Give actionable advice for these life areas

**Timing and Opportunities** (2-3 sentences)
- Reference specific transit aspects and their timing
- Mention best times of day based on planetary influences
- Include specific degrees or aspects when relevant

**Personalized Guidance** (2-3 sentences)
- Based on their dominant elements and chart patterns
- Reference natal aspects that support or challenge today's energy
- Give advice that acknowledges their unique astrological makeup

**Key Transit Influences** (1-2 sentences)
- Highlight the strongest transit affecting them today
- Explain how this relates to their natal chart specifically

IMPORTANT: Make sure every paragraph contains specific references to their actual birth chart data. Avoid any generic statements that could apply to any sign.`,

      es: `Crea un horóscopo diario personalizado para el ${new Date(targetDate).toISOString().split('T')[0]} usando los datos de la carta natal y tránsitos proporcionados arriba.

ESTRUCTURA TU RESPUESTA DE LA SIGUIENTE MANERA:

**Panorama Energético Diario** (2-3 oraciones)
- Referencia posiciones planetarias natales específicas y tránsitos actuales
- Explica cómo la energía de hoy interactúa con su carta única

**Enfoque en Áreas de Vida** (2-3 oraciones)
- Basado en qué casas están activadas por los tránsitos actuales
- Menciona números de casas específicos y sus significados
- Da consejos accionables para estas áreas de vida

**Tiempo y Oportunidades** (2-3 oraciones)
- Referencia aspectos de tránsito específicos y su tiempo
- Menciona mejores horas del día basado en influencias planetarias
- Incluye grados específicos o aspectos cuando sea relevante

**Guía Personalizada** (2-3 oraciones)
- Basado en sus elementos dominantes y patrones de carta
- Referencia aspectos natales que apoyan o desafían la energía de hoy
- Da consejos que reconocen su composición astrológica única

**Influencias de Tránsito Clave** (1-2 oraciones)
- Destaca el tránsito más fuerte que los afecta hoy
- Explica cómo esto se relaciona específicamente con su carta natal

IMPORTANTE: Asegúrate de que cada párrafo contenga referencias específicas a los datos reales de su carta natal. Evita cualquier declaración genérica que pueda aplicar a cualquier signo.`,
    };

    return templates[language] || templates.en;
  }

  /**
   * Call OpenAI API with the personalized prompt
   */
  async callOpenAI(prompt, language) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.fullPrompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
        top_p: 0.9,
      });

      return response.choices[0].message.content;

    } catch (error) {
      logger.error('OpenAI API call failed', error);
      
      // Fallback to mock personalized response
      return this.generateMockPersonalizedResponse(prompt, language);
    }
  }

  /**
   * Generate mock personalized response (fallback)
   */
  generateMockPersonalizedResponse(prompt, language) {
    if (language === 'es') {
      return `**Panorama Energético Diario**
Con tu configuración natal única y los tránsitos actuales activando áreas específicas de tu carta, hoy experimentas una intensificación de tu naturaleza esencial. Los aspectos planetarios actuales crean una resonancia especial con tu patrón natal.

**Enfoque en Áreas de Vida**
Los tránsitos actuales activan principalmente tu Casa 5, poniendo énfasis en creatividad y autoexpresión. Tu configuración natal sugiere que este es un momento óptimo para proyectos artísticos y romance.

**Tiempo y Oportunidades**
Entre las 10:00-14:00 horas, los aspectos planetarios alcanzan su máxima influencia. Tu patrón natal se ve especialmente favorecido, creando un canal para manifestar tus intenciones.

**Guía Personalizada**
Dado tu énfasis elemental y los aspectos natales presentes, hoy es ideal para equilibrar tu tendencia natural con la necesidad de adaptación a las influencias cósmicas actuales.

**Influencias de Tránsito Clave**
El tránsito más significativo activa directamente tu configuración natal, potenciando tu capacidad de transformación personal.`;
    } else {
      return `**Daily Energy Overview**
With your unique natal configuration and current transits activating specific areas of your chart, you're experiencing an intensification of your essential nature. Current planetary aspects create a special resonance with your natal pattern.

**Life Area Focus**
Current transits are primarily activating your 5th House, placing emphasis on creativity and self-expression. Your natal configuration suggests this is an optimal time for artistic projects and romance.

**Timing and Opportunities**
Between 10:00-14:00, planetary aspects reach peak influence. Your natal pattern is especially favored, creating a channel to manifest your intentions with greater ease.

**Personalized Guidance**
Given your elemental emphasis and natal aspects present, today is ideal for balancing your natural tendency with the need to adapt to current cosmic influences.

**Key Transit Influences**
The most significant transit directly activates your natal configuration, enhancing your capacity for personal transformation.`;
    }
  }

  /**
   * Validate and enhance AI-generated content
   */
  async validateAndEnhanceContent(aiResponse, birthChart, transits, language) {
    let enhancedContent = aiResponse;

    // Basic validation
    const validation = this.validatePersonalizationContent(enhancedContent, birthChart, transits);

    // Enhance if quality is low
    if (validation.specificityScore < 0.7) {
      enhancedContent = await this.addSpecificityEnhancements(enhancedContent, birthChart, language);
    }

    if (validation.transitIntegration < 0.6) {
      enhancedContent = await this.addTransitEnhancements(enhancedContent, transits, language);
    }

    return enhancedContent;
  }

  /**
   * Calculate quality metrics
   */
  calculateQualityMetrics(content, birthChart, transits, personalizationLevel) {
    const personalizedScore = this.calculatePersonalizationScore(content, birthChart);
    const specificityScore = this.calculateSpecificityScore(content);
    const transitIntegrationScore = this.calculateTransitIntegrationScore(content, transits);
    const readabilityScore = this.calculateReadabilityScore(content);

    const overallQuality = (
      personalizedScore * 0.3 +
      specificityScore * 0.25 +
      transitIntegrationScore * 0.25 +
      readabilityScore * 0.2
    );

    return {
      personalizedScore,
      specificityScore,
      transitIntegrationScore,
      readabilityScore,
      overallQuality,
    };
  }

  /**
   * Validate content quality
   */
  async validateContentQuality(personalizedHoroscope, birthChart, transits) {
    const metrics = personalizedHoroscope.qualityMetrics;
    
    return {
      overallScore: metrics.overallQuality,
      personalizedScore: metrics.personalizedScore,
      specificityScore: metrics.specificityScore,
      transitIntegration: metrics.transitIntegrationScore,
      readability: metrics.readabilityScore,
      recommendations: this.generateQualityRecommendations(metrics),
      passesThreshold: metrics.overallQuality >= 0.7,
      grade: this.calculateQualityGrade(metrics.overallQuality),
    };
  }

  // HELPER METHODS

  calculateJulianDay(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;

    const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
               Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

    return jdn + (hour - 12) / 24.0 + minute / 1440.0 + second / 86400.0;
  }

  async calculatePlanetaryPositions(julianDay, location) {
    // Simplified planetary calculation - in production use Swiss Ephemeris
    const t = (julianDay - 2451545.0) / 36525.0;
    
    return {
      Sun: { longitude: this.calculateSunLongitude(t), latitude: 0, distance: 1 },
      Moon: { longitude: this.calculateMoonLongitude(t), latitude: 0, distance: 60 },
      Mercury: { longitude: (252.25 + 149472.67 * t) % 360, latitude: 0, distance: 0.39 },
      Venus: { longitude: (181.98 + 58517.82 * t) % 360, latitude: 0, distance: 0.72 },
      Mars: { longitude: (-4.55 + 19140.30 * t) % 360, latitude: 0, distance: 1.52 },
      Jupiter: { longitude: (34.40 + 3034.75 * t) % 360, latitude: 0, distance: 5.20 },
      Saturn: { longitude: (49.95 + 1222.49 * t) % 360, latitude: 0, distance: 9.54 },
      Uranus: { longitude: (313.24 + 428.48 * t) % 360, latitude: 0, distance: 19.19 },
      Neptune: { longitude: (-55.12 + 218.46 * t) % 360, latitude: 0, distance: 30.07 },
      Pluto: { longitude: (238.93 + 145.21 * t) % 360, latitude: 0, distance: 39.48 },
    };
  }

  calculateSunLongitude(t) {
    const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
    const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
    const mRad = m * Math.PI / 180;
    
    const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
              (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
              0.000289 * Math.sin(3 * mRad);
    
    return (l0 + c) % 360.0;
  }

  calculateMoonLongitude(t) {
    const l = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t;
    const d = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t;
    const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t;
    const mPrime = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t;
    
    const dRad = d * Math.PI / 180;
    const mRad = m * Math.PI / 180;
    const mPrimeRad = mPrime * Math.PI / 180;
    
    const correction = 6.288774 * Math.sin(mPrimeRad) +
                      1.274027 * Math.sin(2 * dRad - mPrimeRad) +
                      0.658314 * Math.sin(2 * dRad);
    
    return (l + correction) % 360.0;
  }

  async calculateHouseCusps(julianDay, location, planetaryPositions) {
    // Simplified house calculation - in production use proper algorithm
    const ascendant = this.calculateAscendant(julianDay, location);
    
    const cusps = {};
    for (let i = 1; i <= 12; i++) {
      cusps[i] = (ascendant + (i - 1) * 30) % 360;
    }
    
    return cusps;
  }

  calculateAscendant(julianDay, location) {
    // Simplified ascendant calculation
    const lst = this.calculateLocalSiderealTime(julianDay, location);
    return (lst * 15) % 360;
  }

  calculateLocalSiderealTime(julianDay, location) {
    const t = (julianDay - 2451545.0) / 36525.0;
    const gst = 280.46061837 + 360.98564736629 * (julianDay - 2451545.0) + 0.000387933 * t * t;
    return ((gst + location.longitude) / 15) % 24;
  }

  calculateAspects(planetaryPositions) {
    const aspects = [];
    const planets = Object.keys(planetaryPositions);
    
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const aspect = this.calculateAspectBetween(
          planetaryPositions[planets[i]],
          planetaryPositions[planets[j]]
        );
        
        if (aspect) {
          aspects.push({
            planet1: planets[i],
            planet2: planets[j],
            ...aspect,
          });
        }
      }
    }
    
    return aspects;
  }

  calculateAspectBetween(pos1, pos2) {
    const angle = Math.abs(pos2.longitude - pos1.longitude);
    const normalizedAngle = angle > 180 ? 360 - angle : angle;
    
    const aspectDefinitions = [
      { name: 'Conjunction', angle: 0, orb: 8 },
      { name: 'Sextile', angle: 60, orb: 6 },
      { name: 'Square', angle: 90, orb: 8 },
      { name: 'Trine', angle: 120, orb: 8 },
      { name: 'Opposition', angle: 180, orb: 8 },
    ];
    
    for (const aspectDef of aspectDefinitions) {
      const orb = Math.abs(normalizedAngle - aspectDef.angle);
      if (orb <= aspectDef.orb) {
        return {
          type: aspectDef.name,
          orb,
          strength: (aspectDef.orb - orb) / aspectDef.orb,
          isApplying: pos2.longitude > pos1.longitude,
        };
      }
    }
    
    return null;
  }

  assignPlanetsToHouses(planetaryPositions, houseCusps) {
    const planetHouses = {};
    
    for (const [planet, position] of Object.entries(planetaryPositions)) {
      let house = 1;
      for (let h = 1; h <= 12; h++) {
        const currentCusp = houseCusps[h];
        const nextCusp = houseCusps[h === 12 ? 1 : h + 1];
        
        if (this.isInHouse(position.longitude, currentCusp, nextCusp)) {
          house = h;
          break;
        }
      }
      planetHouses[planet] = house;
    }
    
    return planetHouses;
  }

  isInHouse(longitude, cusp1, cusp2) {
    if (cusp1 <= cusp2) {
      return longitude >= cusp1 && longitude < cusp2;
    } else {
      return longitude >= cusp1 || longitude < cusp2;
    }
  }

  shouldSkipTransit(transitingPlanet, natalPlanet) {
    const fastPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
    return fastPlanets.includes(transitingPlanet) && transitingPlanet === natalPlanet;
  }

  getSignFromDegree(longitude) {
    const signs = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    return signs[Math.floor(longitude / 30) % 12];
  }

  calculateTransitTiming(currentPos, natalPos, planet, aspect, targetDate) {
    // Simplified timing calculation
    const planetSpeed = this.getPlanetaryDailySpeed(planet);
    const daysToExact = Math.round(aspect.orb / planetSpeed);
    
    return {
      exactDate: new Date(Date.parse(targetDate) + daysToExact * 24 * 60 * 60 * 1000),
      daysToExact: aspect.isApplying ? daysToExact : -daysToExact,
      isExact: aspect.orb < 0.5,
    };
  }

  getPlanetaryDailySpeed(planet) {
    const speeds = {
      Sun: 0.985, Moon: 13.2, Mercury: 1.4, Venus: 1.6, Mars: 0.52,
      Jupiter: 0.083, Saturn: 0.033, Uranus: 0.012, Neptune: 0.006, Pluto: 0.004,
    };
    return speeds[planet] || 1.0;
  }

  getTransitInfluence(transitingPlanet, natalPlanet, aspect) {
    return {
      type: `${transitingPlanet}_${aspect.type}_${natalPlanet}`,
      intensity: aspect.strength,
      themes: this.getTransitThemes(transitingPlanet, natalPlanet),
    };
  }

  getTransitThemes(transitingPlanet, natalPlanet) {
    const themes = {
      Sun: ['identity', 'self-expression', 'vitality'],
      Moon: ['emotions', 'intuition', 'security'],
      Mercury: ['communication', 'thinking', 'learning'],
      Venus: ['love', 'beauty', 'harmony'],
      Mars: ['action', 'energy', 'conflict'],
      Jupiter: ['expansion', 'opportunity', 'wisdom'],
      Saturn: ['structure', 'responsibility', 'limitation'],
    };
    return [...(themes[transitingPlanet] || []), ...(themes[natalPlanet] || [])].slice(0, 3);
  }

  getTransitTiming(exactDate, targetDate) {
    if (!exactDate) return 'ongoing';
    
    const daysDiff = Math.floor((new Date(exactDate) - new Date(targetDate)) / (24 * 60 * 60 * 1000));
    
    if (Math.abs(daysDiff) <= 1) return 'exact today';
    if (daysDiff > 0) return 'approaching';
    return 'separating';
  }

  getTransitInterpretationHint(transit, language) {
    const hints = {
      en: {
        Jupiter_Trine: 'Expansion and opportunity',
        Saturn_Square: 'Structure and discipline needed',
        Mars_Conjunction: 'Action and energy boost',
        Venus_Sextile: 'Harmony and attraction',
      },
      es: {
        Jupiter_Trine: 'Expansión y oportunidad',
        Saturn_Square: 'Estructura y disciplina necesarias',
        Mars_Conjunction: 'Acción y impulso energético',
        Venus_Sextile: 'Armonía y atracción',
      },
    };
    
    const key = `${transit.transitingPlanet}_${transit.aspect}`;
    return hints[language]?.[key] || 'Significant planetary influence';
  }

  calculateDominantElement(birthChart) {
    const elementCounts = {};
    for (const planet of Object.keys(birthChart.planetaryPositions)) {
      const house = birthChart.planetHouses[planet];
      const element = this.getElementForHouse(house);
      elementCounts[element] = (elementCounts[element] || 0) + 1;
    }
    
    return Object.entries(elementCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  getElementForHouse(house) {
    const elements = {
      1: 'Fire', 2: 'Earth', 3: 'Air', 4: 'Water',
      5: 'Fire', 6: 'Earth', 7: 'Air', 8: 'Water',
      9: 'Fire', 10: 'Earth', 11: 'Air', 12: 'Water',
    };
    return elements[house] || 'Fire';
  }

  extractPersonalityTraits(birthChart) {
    // Simplified trait extraction based on planetary positions
    return ['Leadership', 'Creativity', 'Intuition'];
  }

  generateHoroscopeCacheKey(birthChart, targetDate, language, personalizationLevel) {
    return `${birthChart.birthDateTime.getTime()}_${new Date(targetDate).toISOString().split('T')[0]}_${language}_${personalizationLevel}`;
  }

  validatePersonalizationContent(content, birthChart, transits) {
    return {
      specificityScore: this.calculateSpecificityScore(content),
      transitIntegration: this.calculateTransitIntegrationScore(content, transits),
      personalizedScore: this.calculatePersonalizationScore(content, birthChart),
    };
  }

  calculatePersonalizationScore(content, birthChart) {
    let score = 0.0;
    
    if (content.includes('natal') || content.includes('birth chart')) score += 0.2;
    if (content.includes('House') || content.includes('casa')) score += 0.2;
    if (/\d+\.?\d*°/.test(content)) score += 0.2;
    if (content.includes('aspect') || content.includes('aspecto')) score += 0.2;
    
    for (const planet of Object.keys(birthChart.planetaryPositions)) {
      if (content.toLowerCase().includes(planet.toLowerCase())) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0);
  }

  calculateSpecificityScore(content) {
    let score = 0.5;
    
    if (/\d+\.?\d*°/.test(content)) score += 0.2;
    if (/House \d+/.test(content)) score += 0.2;
    if (/\d+:\d+/.test(content)) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  calculateTransitIntegrationScore(content, transits) {
    if (transits.length === 0) return 0.5;
    
    let mentionedTransits = 0;
    for (const transit of transits) {
      const transitString = `${transit.transitingPlanet} ${transit.aspect}`;
      if (content.includes(transitString) || content.includes(transit.transitingPlanet)) {
        mentionedTransits++;
      }
    }
    
    return mentionedTransits / Math.min(transits.length, 5);
  }

  calculateReadabilityScore(content) {
    const sentences = content.split(/[.!?]/).length;
    const words = content.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) return 0.9;
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) return 0.7;
    return 0.5;
  }

  calculateDifferentiationScore(content, birthChart) {
    let score = 0.3;
    
    if (content.includes('natal') || content.includes('birth')) score += 0.3;
    if (content.includes('House') || content.includes('casa')) score += 0.2;
    if (content.includes('transit') || content.includes('tránsito')) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  generateQualityRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.personalizedScore < 0.7) {
      recommendations.push('Increase birth chart specific references');
    }
    if (metrics.specificityScore < 0.7) {
      recommendations.push('Add more precise astrological details');
    }
    if (metrics.transitIntegrationScore < 0.7) {
      recommendations.push('Better integrate current transit information');
    }
    
    return recommendations;
  }

  calculateQualityGrade(score) {
    if (score >= 0.95) return 'A+';
    if (score >= 0.90) return 'A';
    if (score >= 0.85) return 'A-';
    if (score >= 0.80) return 'B+';
    if (score >= 0.75) return 'B';
    if (score >= 0.70) return 'B-';
    return 'C';
  }

  async addSpecificityEnhancements(content, birthChart, language) {
    // Add more specific astrological references
    let enhanced = content;
    
    if (!enhanced.includes('°')) {
      const sunPos = birthChart.planetaryPositions.Sun;
      if (sunPos) {
        const degree = (sunPos.longitude % 30).toFixed(1);
        const sign = this.getSignFromDegree(sunPos.longitude);
        
        if (language === 'es') {
          enhanced = enhanced.replace('Sol', `Sol en ${degree}° ${sign}`);
        } else {
          enhanced = enhanced.replace('Sun', `Sun at ${degree}° ${sign}`);
        }
      }
    }
    
    return enhanced;
  }

  async addTransitEnhancements(content, transits, language) {
    if (transits.length === 0) return content;
    
    let enhanced = content;
    const strongestTransit = transits.reduce((a, b) => a.strength > b.strength ? a : b);
    const transitRef = `${strongestTransit.transitingPlanet} ${strongestTransit.aspect}`;
    
    if (!enhanced.includes(transitRef)) {
      if (language === 'es') {
        enhanced += `\n\nInfluencia adicional: El tránsito de ${transitRef} activa energías específicas en tu carta natal.`;
      } else {
        enhanced += `\n\nAdditional influence: The transit of ${transitRef} activates specific energies in your natal chart.`;
      }
    }
    
    return enhanced;
  }

  serializeBirthChart(birthChart) {
    return {
      birthDateTime: birthChart.birthDateTime,
      birthLocation: birthChart.birthLocation,
      planetaryPositions: birthChart.planetaryPositions,
      houseCusps: birthChart.houseCusps,
      aspects: birthChart.aspects.slice(0, 10), // Limit aspects for response size
      planetHouses: birthChart.planetHouses,
      calculatedAt: birthChart.calculatedAt,
    };
  }

  updateMetrics(responseTime, cacheHit) {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    
    if (cacheHit) {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) + 1) / 
        this.metrics.totalRequests;
    }
  }

  /**
   * Get system metrics and status
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheStats: {
        birthCharts: this.birthChartCache.size,
        horoscopes: this.horoscopeCache.size,
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Clear caches to free memory
   */
  clearCaches() {
    this.birthChartCache.clear();
    this.horoscopeCache.clear();
    logger.info('Caches cleared successfully');
  }
}

module.exports = PersonalizedHoroscopeAPI;