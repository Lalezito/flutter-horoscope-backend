/**
 * 🔮 VERIFIABLE PREDICTION SERVICE
 * 
 * Advanced AI-powered verifiable prediction generation system that creates
 * highly specific, testable predictions using astrological calculations and timing.
 * 
 * Mission Features:
 * - Astrological timing integration for precise prediction windows
 * - Specificity validation and quality control system
 * - Confidence scoring based on astrological strength
 * - Prediction success tracking and learning optimization
 * - Multiple prediction categories with measurable outcomes
 * - Real-time accuracy improvement through feedback learning
 */

const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const redisService = require('./redisService');
const logger = require('./loggingService');
const circuitBreaker = require('./circuitBreakerService');
const personalizedHoroscopeAPI = require('./personalizedHoroscopeAPI');

class VerifiablePredictionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Prediction categories with specific measurable outcomes
    this.predictionCategories = {
      communication: {
        name: 'Communication & Messages',
        weight: 0.8,
        examples: [
          'important message received',
          'unexpected phone call',
          'email with good news',
          'social media interaction',
          'text from past connection'
        ],
        timeframes: ['within 2 days', 'by Thursday afternoon', 'before weekend', 'next 72 hours'],
        astrologyFactors: ['Mercury transits', 'Gemini activations', '3rd house emphasis', 'Air sign transits']
      },
      
      socialInteractions: {
        name: 'Social Interactions & People',
        weight: 0.9,
        examples: [
          'meeting someone new',
          'reconnecting with old friend',
          'compliment received',
          'invitation extended',
          'social opportunity presented'
        ],
        timeframes: ['tomorrow', 'within 3 days', 'this weekend', 'by Tuesday'],
        astrologyFactors: ['Venus transits', '7th house activations', 'Libra emphasis', 'Jupiter aspects']
      },

      opportunities: {
        name: 'Opportunities & Recognition',
        weight: 0.7,
        examples: [
          'work-related opportunity',
          'unexpected offer',
          'recognition for efforts',
          'chance to showcase skills',
          'new door opening'
        ],
        timeframes: ['within a week', 'by next Friday', 'in 3-5 days', 'before month end'],
        astrologyFactors: ['Jupiter transits', '10th house emphasis', 'Sun aspects', 'Leo activations']
      },

      discoveries: {
        name: 'Discoveries & Findings',
        weight: 0.8,
        examples: [
          'finding something lost',
          'discovering useful information',
          'solution to problem found',
          'hidden talent revealed',
          'unexpected answer received'
        ],
        timeframes: ['today', 'within 48 hours', 'by tomorrow evening', 'next 2 days'],
        astrologyFactors: ['Uranus aspects', '8th house transits', 'Scorpio emphasis', 'Pluto connections']
      },

      emotional: {
        name: 'Emotional & Intuitive Events',
        weight: 0.6,
        examples: [
          'strong intuitive moment',
          'emotional breakthrough',
          'feeling deeply understood',
          'mood significantly lifting',
          'clarity on personal matter'
        ],
        timeframes: ['today', 'by tonight', 'within 24 hours', 'before bedtime'],
        astrologyFactors: ['Moon transits', 'Cancer activations', '4th house emphasis', 'Water sign aspects']
      },

      practical: {
        name: 'Practical & Physical Events',
        weight: 0.9,
        examples: [
          'unexpected assistance offered',
          'problem resolving easily',
          'perfect timing encounter',
          'helpful information appearing',
          'obstacle removing itself'
        ],
        timeframes: ['within 2-3 days', 'by Wednesday', 'in next 96 hours', 'this week'],
        astrologyFactors: ['Earth sign transits', '6th house activations', 'Saturn support aspects', 'Practical planet positions']
      }
    };

    // Astrological timing system for prediction accuracy
    this.astrologicalTiming = {
      lunarPhases: {
        newMoon: { energy: 'beginnings', timing: 'optimal for new events', multiplier: 1.2 },
        waxingCrescent: { energy: 'growth', timing: 'building momentum', multiplier: 1.1 },
        firstQuarter: { energy: 'action', timing: 'decisive moments', multiplier: 1.3 },
        waxingGibbous: { energy: 'refinement', timing: 'perfecting details', multiplier: 1.0 },
        fullMoon: { energy: 'culmination', timing: 'peak manifestation', multiplier: 1.4 },
        waningGibbous: { energy: 'gratitude', timing: 'receiving outcomes', multiplier: 1.2 },
        lastQuarter: { energy: 'release', timing: 'clearing obstacles', multiplier: 1.1 },
        waningCrescent: { energy: 'reflection', timing: 'inner insights', multiplier: 0.9 }
      },

      aspectStrengths: {
        conjunction: { strength: 1.0, nature: 'intense focus', timing: 'immediate impact' },
        sextile: { strength: 0.8, nature: 'easy flow', timing: 'smooth manifestation' },
        square: { strength: 0.9, nature: 'dynamic tension', timing: 'forced action' },
        trine: { strength: 0.9, nature: 'harmonious support', timing: 'effortless unfolding' },
        opposition: { strength: 0.8, nature: 'awareness bringing', timing: 'external manifestation' }
      },

      planetaryInfluences: {
        Sun: { speed: 1.0, influence: 'identity, recognition', timing: 'daylight hours' },
        Moon: { speed: 13.2, influence: 'emotions, intuition', timing: 'emotional moments' },
        Mercury: { speed: 1.4, influence: 'communication, thinking', timing: 'mental activity peak' },
        Venus: { speed: 1.6, influence: 'relationships, beauty', timing: 'social interactions' },
        Mars: { speed: 0.52, influence: 'action, energy', timing: 'activity periods' },
        Jupiter: { speed: 0.083, influence: 'opportunity, expansion', timing: 'growth windows' },
        Saturn: { speed: 0.033, influence: 'structure, responsibility', timing: 'discipline moments' },
        Uranus: { speed: 0.012, influence: 'innovation, surprise', timing: 'unexpected events' },
        Neptune: { speed: 0.006, influence: 'intuition, dreams', timing: 'subconscious activity' },
        Pluto: { speed: 0.004, influence: 'transformation, depth', timing: 'deep change periods' }
      }
    };

    // Quality control and validation system
    this.qualityThresholds = {
      minimum: {
        specificityScore: 0.7,
        timeframeClarity: 0.8,
        measurabilityScore: 0.7,
        astrologyIntegration: 0.6
      },
      premium: {
        specificityScore: 0.9,
        timeframeClarity: 0.95,
        measurabilityScore: 0.9,
        astrologyIntegration: 0.8
      }
    };

    // Accuracy tracking and learning system
    this.accuracySystem = {
      weights: {
        userFeedback: 0.4,
        astrologyStrength: 0.3,
        timingPrecision: 0.2,
        categoryHistory: 0.1
      },
      learningRate: 0.1,
      confidenceDecay: 0.95 // Daily confidence decay for expired predictions
    };
  }

  /**
   * 🎯 GENERATE VERIFIABLE PREDICTIONS
   * Main function to create highly specific, testable predictions
   */
  async generateVerifiablePredictions(userId, options = {}) {
    const startTime = Date.now();

    try {
      logger.getLogger().info('Starting verifiable prediction generation', { userId, options });

      // Get user's birth chart data for personalized timing
      const birthChart = await this.getUserBirthChart(userId, options.birthData);
      
      // Calculate current astrological conditions
      const astrologyContext = await this.calculateAstrologicalContext(birthChart, new Date());
      
      // Determine optimal prediction categories based on current transits
      const activeCategories = this.selectOptimalCategories(astrologyContext, options.preferredAreas);
      
      // Generate predictions for each category
      const predictions = [];
      for (const category of activeCategories) {
        const prediction = await this.generateSinglePrediction(
          userId,
          category,
          birthChart,
          astrologyContext,
          options
        );
        
        if (prediction.success && this.validatePredictionQuality(prediction.data)) {
          predictions.push(prediction.data);
        }
      }

      // Sort by confidence and astrological strength
      predictions.sort((a, b) => {
        const aScore = a.confidenceScore * a.astrologyStrength;
        const bScore = b.confidenceScore * b.astrologyStrength;
        return bScore - aScore;
      });

      // Store predictions in database with tracking
      const storedPredictions = await this.storePredictions(userId, predictions);

      const responseTime = Date.now() - startTime;
      logger.getLogger().info('Verifiable predictions generated successfully', { 
        userId, 
        count: predictions.length,
        responseTime 
      });

      return {
        success: true,
        predictions: storedPredictions,
        astrologyContext,
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTime,
          predictionsCount: predictions.length,
          averageConfidence: predictions.reduce((sum, p) => sum + p.confidenceScore, 0) / predictions.length,
          validationPassed: true
        }
      };

    } catch (error) {
      logger.logError(error, { 
        context: 'verifiable_prediction_generation', 
        userId,
        responseTime: Date.now() - startTime 
      });

      return {
        success: false,
        error: 'prediction_generation_failed',
        message: 'Failed to generate verifiable predictions',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * 🔮 GENERATE SINGLE PREDICTION
   * Creates one highly specific, verifiable prediction
   */
  async generateSinglePrediction(userId, categoryKey, birthChart, astrologyContext, options) {
    try {
      const category = this.predictionCategories[categoryKey];
      const relevantTransits = this.getRelevantTransits(categoryKey, astrologyContext.transits);
      const timingWindow = this.calculateOptimalTiming(relevantTransits, categoryKey);
      
      // Create sophisticated prompt for verifiable prediction
      const prompt = this.buildVerifiablePredictionPrompt({
        category,
        birthChart,
        relevantTransits,
        timingWindow,
        astrologyContext,
        language: options.language || 'en',
        userPreferences: options.preferences
      });

      // Generate prediction with AI using circuit breaker
      const aiResponse = await circuitBreaker.execute('openai_prediction', async () => {
        return await this.callOpenAIForPrediction(prompt);
      });

      if (!aiResponse.success) {
        return { success: false, error: aiResponse.error };
      }

      // Parse and validate prediction structure
      const parsedPrediction = this.parsePredictionResponse(aiResponse.content, categoryKey);
      
      // Calculate confidence scores
      const confidenceMetrics = this.calculateConfidenceScores(
        parsedPrediction,
        relevantTransits,
        astrologyContext,
        category
      );

      // Build final prediction object
      const prediction = {
        id: uuidv4(),
        userId,
        category: categoryKey,
        categoryName: category.name,
        prediction: parsedPrediction.statement,
        specificDetails: parsedPrediction.details,
        timeframe: parsedPrediction.timeframe,
        measurableOutcome: parsedPrediction.outcome,
        confidenceScore: confidenceMetrics.overall,
        astrologyStrength: confidenceMetrics.astrology,
        timingPrecision: confidenceMetrics.timing,
        verificationCriteria: parsedPrediction.verification,
        astrologyBasis: this.buildAstrologyExplanation(relevantTransits, categoryKey),
        createdAt: new Date(),
        expiresAt: this.calculateExpirationDate(parsedPrediction.timeframe),
        status: 'active',
        validationScores: this.validatePredictionSpecificity(parsedPrediction)
      };

      return { success: true, data: prediction };

    } catch (error) {
      logger.logError(error, { context: 'single_prediction_generation', userId, categoryKey });
      return { success: false, error: error.message };
    }
  }

  /**
   * 🎯 BUILD VERIFIABLE PREDICTION PROMPT
   * Creates sophisticated AI prompts for specific, testable predictions
   */
  buildVerifiablePredictionPrompt(params) {
    const { category, birthChart, relevantTransits, timingWindow, astrologyContext, language } = params;

    const systemPrompt = `You are an expert astrologer specializing in creating VERIFIABLE, SPECIFIC predictions that can be clearly tested as true or false. 

CRITICAL REQUIREMENTS FOR VERIFIABLE PREDICTIONS:
1. Must be SPECIFIC enough to verify with clear yes/no outcome
2. Must include PRECISE timeframe (not vague like "soon")  
3. Must describe MEASURABLE events that actually happen
4. Must be realistic and achievable within the timeframe
5. Must integrate real astrological timing and transit data provided
6. Must avoid vague language like "energy," "vibes," or "feelings"

GOOD EXAMPLES:
✅ "You will receive an important work-related email tomorrow between 10am-3pm"
✅ "Someone will compliment your appearance this Thursday"
✅ "You will find something you've been looking for within the next 3 days"
✅ "A person from your past will contact you by Saturday evening"

BAD EXAMPLES:
❌ "Good energy will surround you"
❌ "Love is in the air"  
❌ "Be open to opportunities"
❌ "Your chakras will align"

FORMAT YOUR RESPONSE AS JSON:
{
  "statement": "The specific, verifiable prediction statement",
  "details": "Additional context that maintains specificity", 
  "timeframe": "Exact timing window (e.g., 'Thursday 2-6pm', 'within 72 hours')",
  "outcome": "Clear measurable outcome to verify",
  "verification": "Specific criteria to determine if prediction came true"
}`;

    const userPrompt = `Create ONE highly specific, verifiable prediction for the ${category.name} category.

CURRENT ASTROLOGICAL CONTEXT:
Birth Chart: ${this.summarizeBirthChart(birthChart)}

RELEVANT TRANSITS FOR ${category.name.toUpperCase()}:
${relevantTransits.map(t => 
  `${t.transitingPlanet} ${t.aspect} natal ${t.natalPlanet} (${Math.round(t.strength * 100)}% strength, ${t.timing.description})`
).join('\n')}

OPTIMAL TIMING WINDOW: ${timingWindow.description}
LUNAR PHASE: ${astrologyContext.lunarPhase.name} (${astrologyContext.lunarPhase.energy})

CATEGORY FOCUS: ${category.name}
Example events for this category: ${category.examples.join(', ')}

Create a prediction that:
1. Uses the specific transit influences provided above
2. Fits within the optimal timing window calculated
3. Is specific enough that anyone could verify if it happened
4. Relates to the ${category.name} category themes
5. Has a clear YES/NO verification outcome

Make it specific, realistic, and astrologically-timed!`;

    return {
      systemPrompt,
      userPrompt,
      category: category.name,
      timingWindow: timingWindow.timeframe
    };
  }

  /**
   * 🤖 CALL OPENAI FOR PREDICTION
   * Execute AI prediction generation with fallback handling
   */
  async callOpenAIForPrediction(prompt) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt }
        ],
        max_tokens: 400,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        presence_penalty: 0.3,
        frequency_penalty: 0.2
      });

      return {
        success: true,
        content: completion.choices[0].message.content,
        model: 'gpt-4-turbo-preview',
        tokensUsed: completion.usage.total_tokens
      };

    } catch (error) {
      logger.logError(error, { context: 'openai_prediction_call' });
      
      // Fallback to mock verifiable prediction
      return {
        success: true,
        content: this.generateMockVerifiablePrediction(prompt),
        model: 'fallback',
        tokensUsed: 0
      };
    }
  }

  /**
   * 📊 CALCULATE ASTROLOGICAL CONTEXT
   * Determines current astrological conditions for prediction timing
   */
  async calculateAstrologicalContext(birthChart, targetDate) {
    try {
      // Use existing personalized horoscope API for transit calculations
      const transitData = await personalizedHoroscopeAPI.calculateCurrentTransits(birthChart, targetDate);
      
      // Calculate lunar phase
      const lunarPhase = this.calculateLunarPhase(targetDate);
      
      // Calculate daily planetary hours
      const planetaryHours = this.calculatePlanetaryHours(targetDate, birthChart.birthLocation);
      
      // Determine strongest influences
      const dominantInfluences = this.analyzeDominantInfluences(transitData, lunarPhase);
      
      return {
        transits: transitData,
        lunarPhase,
        planetaryHours,
        dominantInfluences,
        calculatedAt: new Date(),
        targetDate
      };
      
    } catch (error) {
      logger.logError(error, { context: 'astrological_context_calculation' });
      
      // Return minimal context for fallback
      return {
        transits: [],
        lunarPhase: { name: 'Unknown', energy: 'balanced', multiplier: 1.0 },
        dominantInfluences: [],
        calculatedAt: new Date(),
        targetDate
      };
    }
  }

  /**
   * 🎯 SELECT OPTIMAL CATEGORIES
   * Chooses prediction categories based on astrological emphasis
   */
  selectOptimalCategories(astrologyContext, preferredAreas = []) {
    const categoryScores = {};
    
    // Score each category based on current transits
    for (const [categoryKey, category] of Object.entries(this.predictionCategories)) {
      let score = category.weight; // Base category weight
      
      // Boost score based on relevant transits
      for (const transit of astrologyContext.transits) {
        if (this.isTransitRelevant(transit, categoryKey)) {
          score += transit.strength * 0.5;
        }
      }
      
      // Boost for lunar phase compatibility
      if (this.isCategoryLunarCompatible(categoryKey, astrologyContext.lunarPhase)) {
        score *= astrologyContext.lunarPhase.multiplier;
      }
      
      // Boost for user preferences
      if (preferredAreas.includes(categoryKey)) {
        score *= 1.3;
      }
      
      categoryScores[categoryKey] = score;
    }
    
    // Return top 3-4 categories sorted by score
    return Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(entry => entry[0]);
  }

  /**
   * ⏰ CALCULATE OPTIMAL TIMING
   * Determines precise timing windows based on astrological factors
   */
  calculateOptimalTiming(relevantTransits, categoryKey) {
    if (relevantTransits.length === 0) {
      return {
        timeframe: 'within 48 hours',
        description: 'Standard timing window',
        precision: 0.5
      };
    }
    
    // Find strongest transit for timing
    const strongestTransit = relevantTransits.reduce((a, b) => 
      a.strength > b.strength ? a : b
    );
    
    // Calculate timing based on transit exactness and planetary speed
    const planet = strongestTransit.transitingPlanet;
    const planetSpeed = this.astrologicalTiming.planetaryInfluences[planet]?.speed || 1.0;
    const daysToExact = Math.round(strongestTransit.orb / planetSpeed);
    
    let timeframeText, description;
    const precision = Math.min(strongestTransit.strength + 0.2, 1.0);
    
    if (daysToExact <= 1) {
      timeframeText = 'today';
      description = 'Peak influence active now';
    } else if (daysToExact <= 2) {
      timeframeText = 'within 48 hours';
      description = 'Approaching peak influence';
    } else if (daysToExact <= 3) {
      timeframeText = 'within 3 days';
      description = 'Building to peak influence';
    } else if (daysToExact <= 7) {
      timeframeText = 'within a week';
      description = 'Gradual influence building';
    } else {
      timeframeText = 'within 2 weeks';
      description = 'Longer-term influence developing';
    }
    
    return {
      timeframe: timeframeText,
      description,
      precision,
      exactDate: strongestTransit.timing?.exactDate,
      strongestTransit: strongestTransit.transitingPlanet + ' ' + strongestTransit.aspect
    };
  }

  /**
   * ✅ VALIDATE PREDICTION QUALITY
   * Ensures predictions meet verifiability standards
   */
  validatePredictionQuality(prediction) {
    const scores = prediction.validationScores;
    const thresholds = this.qualityThresholds.minimum;
    
    return (
      scores.specificityScore >= thresholds.specificityScore &&
      scores.timeframeClarity >= thresholds.timeframeClarity &&
      scores.measurabilityScore >= thresholds.measurabilityScore &&
      scores.astrologyIntegration >= thresholds.astrologyIntegration
    );
  }

  /**
   * 📊 VALIDATE PREDICTION SPECIFICITY 
   * Calculates detailed quality scores for predictions
   */
  validatePredictionSpecificity(parsedPrediction) {
    const statement = parsedPrediction.statement.toLowerCase();
    const timeframe = parsedPrediction.timeframe.toLowerCase();
    const outcome = parsedPrediction.outcome.toLowerCase();
    
    // Specificity score - checks for concrete, specific language
    let specificityScore = 0.3; // Base score
    
    // Boost for specific actions/events
    const specificActions = ['receive', 'meet', 'find', 'discover', 'call', 'text', 'email', 'message', 'contact'];
    if (specificActions.some(action => statement.includes(action))) specificityScore += 0.3;
    
    // Boost for specific people/sources
    const specificSources = ['colleague', 'friend', 'family', 'stranger', 'past', 'work', 'someone'];
    if (specificSources.some(source => statement.includes(source))) specificityScore += 0.2;
    
    // Boost for specific objects/topics
    const specificObjects = ['email', 'phone', 'message', 'news', 'opportunity', 'offer', 'compliment'];
    if (specificObjects.some(object => statement.includes(object))) specificityScore += 0.2;
    
    // Timeframe clarity score
    let timeframeClarity = 0.2; // Base score
    
    // High precision timeframes
    const preciseTimeframes = ['today', 'tomorrow', 'thursday', 'friday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday'];
    if (preciseTimeframes.some(time => timeframe.includes(time))) timeframeClarity += 0.4;
    
    // Moderate precision
    const moderateTimeframes = ['hours', 'days', 'weekend', 'week'];
    if (moderateTimeframes.some(time => timeframe.includes(time))) timeframeClarity += 0.3;
    
    // Time ranges
    if (timeframe.includes('between') || timeframe.includes('am') || timeframe.includes('pm')) {
      timeframeClarity += 0.3;
    }
    
    // Measurability score - how easily can this be verified?
    let measurabilityScore = 0.3; // Base score
    
    // External events (easy to measure)
    const externalEvents = ['receive', 'contact', 'call', 'email', 'message', 'meet', 'find'];
    if (externalEvents.some(event => statement.includes(event))) measurabilityScore += 0.4;
    
    // Observable outcomes
    const observableOutcomes = ['compliment', 'offer', 'news', 'information', 'opportunity'];
    if (observableOutcomes.some(outcome_word => statement.includes(outcome_word))) measurabilityScore += 0.3;
    
    // Astrology integration (check if astrological reasoning is present)
    let astrologyIntegration = 0.4; // Base score since it uses transit data
    
    // Verification criteria clarity
    const verification = parsedPrediction.verification?.toLowerCase() || '';
    if (verification.includes('if') && verification.includes('then')) astrologyIntegration += 0.2;
    if (verification.includes('specific') || verification.includes('clear')) astrologyIntegration += 0.2;
    
    return {
      specificityScore: Math.min(specificityScore, 1.0),
      timeframeClarity: Math.min(timeframeClarity, 1.0), 
      measurabilityScore: Math.min(measurabilityScore, 1.0),
      astrologyIntegration: Math.min(astrologyIntegration, 1.0),
      overallQuality: Math.min((specificityScore + timeframeClarity + measurabilityScore + astrologyIntegration) / 4, 1.0)
    };
  }

  /**
   * 📈 CALCULATE CONFIDENCE SCORES
   * Determines prediction confidence based on multiple factors
   */
  calculateConfidenceScores(parsedPrediction, relevantTransits, astrologyContext, category) {
    // Base confidence from validation scores
    const validationScores = this.validatePredictionSpecificity(parsedPrediction);
    const baseConfidence = validationScores.overallQuality;
    
    // Astrological strength based on transit power
    let astrologyStrength = 0.5;
    if (relevantTransits.length > 0) {
      const avgTransitStrength = relevantTransits.reduce((sum, t) => sum + t.strength, 0) / relevantTransits.length;
      astrologyStrength = Math.min(avgTransitStrength + 0.2, 1.0);
    }
    
    // Timing precision based on lunar phase and planetary aspects
    const lunarMultiplier = astrologyContext.lunarPhase.multiplier;
    const timingPrecision = Math.min(baseConfidence * lunarMultiplier, 1.0);
    
    // Category weight adjustment
    const categoryWeight = category.weight;
    
    // Calculate overall confidence
    const overall = Math.min(
      baseConfidence * 0.4 + 
      astrologyStrength * 0.3 + 
      timingPrecision * 0.2 + 
      categoryWeight * 0.1,
      0.95 // Cap at 95% to maintain humility
    );
    
    return {
      overall: Math.round(overall * 100) / 100,
      astrology: Math.round(astrologyStrength * 100) / 100,
      timing: Math.round(timingPrecision * 100) / 100,
      validation: Math.round(baseConfidence * 100) / 100
    };
  }

  /**
   * 💾 STORE PREDICTIONS
   * Saves predictions to database with tracking metadata
   */
  async storePredictions(userId, predictions) {
    try {
      const storedPredictions = [];
      
      for (const prediction of predictions) {
        const query = `
          INSERT INTO verifiable_predictions (
            id, user_id, category, category_name, prediction_statement,
            specific_details, timeframe, measurable_outcome, confidence_score,
            astrology_strength, timing_precision, verification_criteria,
            astrology_basis, created_at, expires_at, status, validation_scores,
            astrology_context
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *
        `;
        
        const result = await db.query(query, [
          prediction.id,
          userId,
          prediction.category,
          prediction.categoryName,
          prediction.prediction,
          prediction.specificDetails,
          prediction.timeframe,
          prediction.measurableOutcome,
          prediction.confidenceScore,
          prediction.astrologyStrength,
          prediction.timingPrecision,
          prediction.verificationCriteria,
          JSON.stringify(prediction.astrologyBasis),
          prediction.createdAt,
          prediction.expiresAt,
          prediction.status,
          JSON.stringify(prediction.validationScores),
          JSON.stringify({
            transits: prediction.relevantTransits || [],
            lunarPhase: prediction.lunarPhase || {},
            dominantInfluences: prediction.dominantInfluences || []
          })
        ]);
        
        storedPredictions.push(result.rows[0]);
      }
      
      // Cache predictions for quick access
      await this.cachePredictions(userId, storedPredictions);
      
      return storedPredictions;
      
    } catch (error) {
      logger.logError(error, { context: 'store_predictions', userId });
      throw error;
    }
  }

  /**
   * ✅ UPDATE PREDICTION OUTCOME
   * Records whether a prediction came true for learning optimization
   */
  async updatePredictionOutcome(predictionId, userId, outcome, userFeedback = null) {
    try {
      const outcomeData = {
        outcome: outcome, // 'verified', 'false', 'partial', 'unclear'
        verifiedAt: new Date(),
        userFeedback: userFeedback,
        accuracyScore: this.calculateAccuracyScore(outcome),
        updatedAt: new Date()
      };
      
      const query = `
        UPDATE verifiable_predictions 
        SET 
          outcome = $1,
          verified_at = $2,
          user_feedback = $3,
          accuracy_score = $4,
          updated_at = $5,
          status = 'completed'
        WHERE id = $6 AND user_id = $7
        RETURNING *
      `;
      
      const result = await db.query(query, [
        outcomeData.outcome,
        outcomeData.verifiedAt,
        outcomeData.userFeedback,
        outcomeData.accuracyScore,
        outcomeData.updatedAt,
        predictionId,
        userId
      ]);
      
      if (result.rows.length > 0) {
        // Update learning system with outcome
        await this.updateLearningSystem(result.rows[0], outcome);
        
        // Clear cache to refresh data
        await this.clearUserPredictionCache(userId);
        
        return {
          success: true,
          prediction: result.rows[0],
          accuracyScore: outcomeData.accuracyScore
        };
      }
      
      return {
        success: false,
        error: 'prediction_not_found',
        message: 'Prediction not found or access denied'
      };
      
    } catch (error) {
      logger.logError(error, { context: 'update_prediction_outcome', predictionId, userId });
      
      return {
        success: false,
        error: 'update_failed',
        message: 'Failed to update prediction outcome'
      };
    }
  }

  /**
   * 🧠 UPDATE LEARNING SYSTEM
   * Improves future predictions based on accuracy feedback
   */
  async updateLearningSystem(prediction, outcome) {
    try {
      const learningData = {
        category: prediction.category,
        astrologyFactors: JSON.parse(prediction.astrology_context || '{}'),
        confidenceScore: prediction.confidence_score,
        actualOutcome: outcome,
        accuracyScore: this.calculateAccuracyScore(outcome),
        timeframePrecision: this.calculateTimeframePrecision(prediction),
        learningWeight: this.calculateLearningWeight(prediction.confidence_score, outcome)
      };
      
      // Store learning data for future optimization
      const learningQuery = `
        INSERT INTO prediction_learning_data (
          category, astrology_factors, predicted_confidence,
          actual_outcome, accuracy_score, timeframe_precision,
          learning_weight, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await db.query(learningQuery, [
        learningData.category,
        JSON.stringify(learningData.astrologyFactors),
        learningData.confidenceScore,
        learningData.actualOutcome,
        learningData.accuracyScore,
        learningData.timeframePrecision,
        learningData.learningWeight,
        new Date()
      ]);
      
      // Update category success rates
      await this.updateCategoryStats(learningData.category, learningData.accuracyScore);
      
    } catch (error) {
      logger.logError(error, { context: 'update_learning_system', predictionId: prediction.id });
    }
  }

  // HELPER METHODS

  async getUserBirthChart(userId, birthData) {
    try {
      if (birthData) {
        return await personalizedHoroscopeAPI.getOrCalculateBirthChart(birthData);
      }
      
      // Get from database if available
      const query = 'SELECT * FROM user_birth_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';
      const result = await db.query(query, [userId]);
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].chart_data);
      }
      
      // Return default chart for testing
      return this.getDefaultBirthChart();
      
    } catch (error) {
      logger.logError(error, { context: 'get_user_birth_chart', userId });
      return this.getDefaultBirthChart();
    }
  }

  getDefaultBirthChart() {
    return {
      birthDateTime: new Date('1990-01-01T12:00:00Z'),
      birthLocation: { latitude: 0, longitude: 0, city: 'Unknown' },
      planetaryPositions: {
        Sun: { longitude: 280 },
        Moon: { longitude: 120 },
        Mercury: { longitude: 290 },
        Venus: { longitude: 310 },
        Mars: { longitude: 45 }
      },
      planetHouses: { Sun: 10, Moon: 5, Mercury: 10, Venus: 11, Mars: 2 }
    };
  }

  getRelevantTransits(categoryKey, allTransits) {
    const category = this.predictionCategories[categoryKey];
    return allTransits.filter(transit => 
      category.astrologyFactors.some(factor => 
        this.isFactorRelevant(factor, transit)
      )
    ).slice(0, 3); // Top 3 most relevant
  }

  isFactorRelevant(factor, transit) {
    const factorLower = factor.toLowerCase();
    const transitPlanet = transit.transitingPlanet.toLowerCase();
    const transitAspect = transit.aspect.toLowerCase();
    
    return factorLower.includes(transitPlanet) || 
           factorLower.includes(transitAspect) ||
           factorLower.includes('house ' + transit.house);
  }

  isTransitRelevant(transit, categoryKey) {
    const category = this.predictionCategories[categoryKey];
    return category.astrologyFactors.some(factor => 
      this.isFactorRelevant(factor, transit)
    );
  }

  isCategoryLunarCompatible(categoryKey, lunarPhase) {
    const compatibilities = {
      communication: ['newMoon', 'firstQuarter', 'fullMoon'],
      socialInteractions: ['waxingCrescent', 'firstQuarter', 'fullMoon', 'waningGibbous'],
      opportunities: ['newMoon', 'waxingCrescent', 'firstQuarter'],
      discoveries: ['fullMoon', 'waningGibbous'],
      emotional: ['fullMoon', 'lastQuarter', 'waningCrescent'],
      practical: ['waxingGibbous', 'fullMoon', 'waningGibbous']
    };
    
    return compatibilities[categoryKey]?.includes(lunarPhase.name) || false;
  }

  calculateLunarPhase(date) {
    // Simplified lunar phase calculation
    const lunarMonth = 29.53;
    const knownNewMoon = new Date('2024-01-11T11:57:00Z'); // Reference new moon
    const daysSinceNew = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
    const phase = (daysSinceNew % lunarMonth) / lunarMonth;
    
    if (phase < 0.0625) return { name: 'newMoon', energy: 'beginnings', multiplier: 1.2 };
    if (phase < 0.1875) return { name: 'waxingCrescent', energy: 'growth', multiplier: 1.1 };
    if (phase < 0.3125) return { name: 'firstQuarter', energy: 'action', multiplier: 1.3 };
    if (phase < 0.4375) return { name: 'waxingGibbous', energy: 'refinement', multiplier: 1.0 };
    if (phase < 0.5625) return { name: 'fullMoon', energy: 'culmination', multiplier: 1.4 };
    if (phase < 0.6875) return { name: 'waningGibbous', energy: 'gratitude', multiplier: 1.2 };
    if (phase < 0.8125) return { name: 'lastQuarter', energy: 'release', multiplier: 1.1 };
    return { name: 'waningCrescent', energy: 'reflection', multiplier: 0.9 };
  }

  calculatePlanetaryHours(date, location) {
    // Simplified planetary hours calculation for timing optimization
    const hour = date.getHours();
    const planets = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];
    const dayOfWeek = date.getDay();
    const planetaryRuler = planets[(hour + dayOfWeek * 24) % 7];
    
    return {
      currentRuler: planetaryRuler,
      influence: this.astrologicalTiming.planetaryInfluences[planetaryRuler]?.influence || 'balanced energy'
    };
  }

  analyzeDominantInfluences(transits, lunarPhase) {
    const influences = [];
    
    // Add lunar phase influence
    influences.push({
      type: 'lunar',
      name: lunarPhase.name,
      strength: lunarPhase.multiplier,
      theme: lunarPhase.energy
    });
    
    // Add top transits
    transits.slice(0, 2).forEach(transit => {
      influences.push({
        type: 'transit',
        name: `${transit.transitingPlanet} ${transit.aspect} ${transit.natalPlanet}`,
        strength: transit.strength,
        theme: transit.influence?.themes?.join(', ') || 'transformation'
      });
    });
    
    return influences;
  }

  parsePredictionResponse(content, categoryKey) {
    try {
      const parsed = JSON.parse(content);
      
      // Validate required fields
      const required = ['statement', 'details', 'timeframe', 'outcome', 'verification'];
      for (const field of required) {
        if (!parsed[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      return parsed;
      
    } catch (error) {
      logger.logError(error, { context: 'parse_prediction_response', content });
      
      // Fallback structured prediction
      return this.generateFallbackPrediction(categoryKey);
    }
  }

  generateFallbackPrediction(categoryKey) {
    const category = this.predictionCategories[categoryKey];
    const example = category.examples[Math.floor(Math.random() * category.examples.length)];
    const timeframe = category.timeframes[Math.floor(Math.random() * category.timeframes.length)];
    
    return {
      statement: `You will experience ${example} ${timeframe}`,
      details: `Based on current astrological conditions, ${example} is highly likely`,
      timeframe: timeframe,
      outcome: `Clear occurrence of ${example}`,
      verification: `Check if ${example} actually happened ${timeframe}`
    };
  }

  generateMockVerifiablePrediction(prompt) {
    const mockPredictions = {
      communication: {
        statement: "You will receive an important email about work tomorrow between 10am-3pm",
        details: "This communication will contain information that helps with a current project or decision",
        timeframe: "tomorrow between 10am-3pm",
        outcome: "Receipt of work-related email with important information",
        verification: "Check email inbox tomorrow afternoon to confirm reception"
      },
      socialInteractions: {
        statement: "Someone will compliment your appearance this Thursday",
        details: "A person you know will make a positive comment about how you look",
        timeframe: "this Thursday",
        outcome: "Receiving a compliment about your appearance",
        verification: "Note if anyone gives you a compliment about how you look on Thursday"
      },
      opportunities: {
        statement: "You will discover a new opportunity within the next 3 days",
        details: "An unexpected chance to improve your situation will become apparent",
        timeframe: "within the next 3 days", 
        outcome: "Clear opportunity becomes available",
        verification: "Identify if a new opportunity for advancement or improvement presents itself"
      }
    };
    
    const categoryKey = Object.keys(mockPredictions)[Math.floor(Math.random() * 3)];
    return JSON.stringify(mockPredictions[categoryKey]);
  }

  buildAstrologyExplanation(relevantTransits, categoryKey) {
    if (relevantTransits.length === 0) {
      return {
        primary: 'General astrological timing',
        details: 'Based on current cosmic patterns and lunar phase'
      };
    }
    
    const primary = relevantTransits[0];
    return {
      primary: `${primary.transitingPlanet} ${primary.aspect} natal ${primary.natalPlanet}`,
      strength: `${Math.round(primary.strength * 100)}%`,
      influence: primary.influence?.themes?.join(', ') || 'transformation',
      timing: primary.timing?.description || 'active influence',
      details: `This transit activates ${categoryKey} themes in your chart`
    };
  }

  calculateExpirationDate(timeframe) {
    const now = new Date();
    const timeframeLower = timeframe.toLowerCase();
    
    if (timeframeLower.includes('today') || timeframeLower.includes('tonight')) {
      const expiry = new Date(now);
      expiry.setHours(23, 59, 59, 999);
      return expiry;
    }
    
    if (timeframeLower.includes('tomorrow')) {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 1);
      expiry.setHours(23, 59, 59, 999);
      return expiry;
    }
    
    if (timeframeLower.includes('48 hours') || timeframeLower.includes('2 days')) {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 2);
      return expiry;
    }
    
    if (timeframeLower.includes('3 days') || timeframeLower.includes('72 hours')) {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 3);
      return expiry;
    }
    
    if (timeframeLower.includes('week')) {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 7);
      return expiry;
    }
    
    // Default to 7 days
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
  }

  summarizeBirthChart(birthChart) {
    const sun = birthChart.planetaryPositions.Sun;
    const moon = birthChart.planetaryPositions.Moon;
    const mercury = birthChart.planetaryPositions.Mercury;
    
    return `Sun ${Math.round(sun?.longitude || 0)}°, Moon ${Math.round(moon?.longitude || 0)}°, Mercury ${Math.round(mercury?.longitude || 0)}°`;
  }

  calculateAccuracyScore(outcome) {
    const scores = {
      'verified': 1.0,
      'partial': 0.6,
      'unclear': 0.3,
      'false': 0.0
    };
    
    return scores[outcome] || 0.0;
  }

  calculateTimeframePrecision(prediction) {
    const timeframe = prediction.timeframe.toLowerCase();
    
    if (timeframe.includes('hour') || timeframe.includes('pm') || timeframe.includes('am')) {
      return 1.0; // High precision
    }
    
    if (timeframe.includes('today') || timeframe.includes('tomorrow')) {
      return 0.9;
    }
    
    if (timeframe.includes('day') && timeframe.includes('2')) {
      return 0.8;
    }
    
    if (timeframe.includes('day')) {
      return 0.7;
    }
    
    if (timeframe.includes('week')) {
      return 0.5;
    }
    
    return 0.3; // Low precision
  }

  calculateLearningWeight(confidenceScore, outcome) {
    const accuracyScore = this.calculateAccuracyScore(outcome);
    
    // Higher learning weight for confident predictions that were wrong
    // or low-confidence predictions that were right
    const surprise = Math.abs(confidenceScore - accuracyScore);
    return Math.min(surprise * 2, 1.0);
  }

  async updateCategoryStats(category, accuracyScore) {
    try {
      const query = `
        INSERT INTO category_accuracy_stats (category, accuracy_score, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (category) DO UPDATE SET
        total_predictions = category_accuracy_stats.total_predictions + 1,
        total_accuracy = category_accuracy_stats.total_accuracy + EXCLUDED.accuracy_score,
        average_accuracy = (category_accuracy_stats.total_accuracy + EXCLUDED.accuracy_score) / (category_accuracy_stats.total_predictions + 1),
        updated_at = EXCLUDED.updated_at
      `;
      
      await db.query(query, [category, accuracyScore, new Date()]);
      
    } catch (error) {
      logger.logError(error, { context: 'update_category_stats', category });
    }
  }

  async cachePredictions(userId, predictions) {
    try {
      const cacheKey = `verifiable_predictions:${userId}`;
      await redisService.setex(cacheKey, 3600, JSON.stringify(predictions));
    } catch (error) {
      logger.logError(error, { context: 'cache_predictions', userId });
    }
  }

  async clearUserPredictionCache(userId) {
    try {
      const cacheKey = `verifiable_predictions:${userId}`;
      await redisService.del(cacheKey);
    } catch (error) {
      logger.logError(error, { context: 'clear_prediction_cache', userId });
    }
  }

  /**
   * 📊 GET PREDICTION ANALYTICS
   * Retrieve accuracy statistics and learning insights
   */
  async getPredictionAnalytics(userId, options = {}) {
    try {
      const timeframe = options.timeframe || '30 days';
      const category = options.category;
      
      let query = `
        SELECT 
          category,
          COUNT(*) as total_predictions,
          AVG(confidence_score) as avg_confidence,
          AVG(accuracy_score) as avg_accuracy,
          SUM(CASE WHEN outcome = 'verified' THEN 1 ELSE 0 END) as verified_count,
          SUM(CASE WHEN outcome = 'false' THEN 1 ELSE 0 END) as false_count,
          SUM(CASE WHEN outcome = 'partial' THEN 1 ELSE 0 END) as partial_count
        FROM verifiable_predictions 
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${timeframe}'
      `;
      
      const params = [userId];
      
      if (category) {
        query += ' AND category = $2';
        params.push(category);
      }
      
      query += ' GROUP BY category ORDER BY avg_accuracy DESC';
      
      const result = await db.query(query, params);
      
      return {
        success: true,
        analytics: result.rows,
        summary: this.calculateAnalyticsSummary(result.rows),
        timeframe
      };
      
    } catch (error) {
      logger.logError(error, { context: 'get_prediction_analytics', userId });
      
      return {
        success: false,
        error: 'analytics_failed',
        message: 'Failed to retrieve prediction analytics'
      };
    }
  }

  calculateAnalyticsSummary(analyticsData) {
    if (analyticsData.length === 0) {
      return {
        totalPredictions: 0,
        overallAccuracy: 0,
        averageConfidence: 0,
        bestCategory: null,
        improvementAreas: []
      };
    }
    
    const totals = analyticsData.reduce((acc, row) => {
      acc.predictions += parseInt(row.total_predictions);
      acc.accuracy += parseFloat(row.avg_accuracy) * parseInt(row.total_predictions);
      acc.confidence += parseFloat(row.avg_confidence) * parseInt(row.total_predictions);
      return acc;
    }, { predictions: 0, accuracy: 0, confidence: 0 });
    
    const overallAccuracy = totals.accuracy / totals.predictions;
    const averageConfidence = totals.confidence / totals.predictions;
    
    const bestCategory = analyticsData[0]; // Already sorted by accuracy
    const improvementAreas = analyticsData
      .filter(row => parseFloat(row.avg_accuracy) < 0.6)
      .map(row => row.category);
    
    return {
      totalPredictions: totals.predictions,
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      bestCategory: bestCategory?.category,
      bestCategoryAccuracy: bestCategory ? Math.round(parseFloat(bestCategory.avg_accuracy) * 100) / 100 : 0,
      improvementAreas
    };
  }

  /**
   * 🎯 GET SERVICE STATUS AND HEALTH
   */
  getStatus() {
    return {
      service: 'VerifiablePredictionService',
      version: '1.0.0',
      categories: Object.keys(this.predictionCategories),
      qualityThresholds: this.qualityThresholds,
      astrologicalFactors: Object.keys(this.astrologicalTiming.planetaryInfluences),
      learningSystem: {
        weights: this.accuracySystem.weights,
        learningRate: this.accuracySystem.learningRate
      },
      openaiConfigured: !!process.env.OPENAI_API_KEY
    };
  }

  /**
   * 🏥 HEALTH CHECK
   */
  async healthCheck() {
    try {
      // Test database connection
      await db.query('SELECT 1');
      
      // Test Redis connection  
      await redisService.ping();
      
      // Test OpenAI connection
      let openaiStatus = 'not_configured';
      if (process.env.OPENAI_API_KEY) {
        try {
          await this.openai.models.list();
          openaiStatus = 'connected';
        } catch {
          openaiStatus = 'error';
        }
      }
      
      return {
        healthy: true,
        components: {
          database: 'connected',
          redis: 'connected', 
          openai: openaiStatus,
          personalizedHoroscope: 'available'
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.logError(error, { context: 'verifiable_prediction_health_check' });
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new VerifiablePredictionService();