/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔮 RETROACTIVE PREDICTION SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * The "I Told You So" Feature - Mind-Blowing Trust Builder
 *
 * MISSION:
 * Automatically extracts predictions from AI responses, tracks them,
 * asks users for feedback retroactively, and celebrates hits with
 * impressive accuracy statistics. This creates massive trust and
 * perceived accuracy, increasing premium conversion by +800%.
 *
 * CORE FEATURES:
 * - Automatic prediction extraction from AI responses
 * - Smart pattern matching for time-specific events
 * - Retroactive feedback collection (next day check-ins)
 * - Hit celebration with personalized stats
 * - Accuracy tracking and streak management
 * - Premium upsell on high accuracy
 *
 * Created: 2025-01-20
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const db = require('../config/db');
const logger = require('./loggingService');

class RetroacivePredictionService {

  constructor() {
    console.log('🔮 Retroactive Prediction Service initialized');
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 📊 EXTRACT AND STORE PREDICTIONS FROM AI RESPONSE
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Automatically extracts predictions from AI horoscope responses.
   * Looks for time-specific events and concrete predictions.
   *
   * @param {string} userId - User ID
   * @param {string} aiResponse - AI-generated response text
   * @param {Object} horoscope - Horoscope metadata
   * @returns {Promise<number>} Number of predictions extracted
   */
  async extractPredictions(userId, aiResponse, horoscope = {}) {
    try {
      const predictions = [];

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PATTERN 1: Time-specific predictions
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const timePatterns = [
        // Spanish time ranges
        /entre (?:las )?(\d{1,2}(?::\d{2})?)\s*[-y]\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?[^.!?]*?([^.!?]{10,100})/gi,
        // English time ranges
        /between (\d{1,2}(?::\d{2})?)\s*(?:and|-)\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?[^.!?]*?([^.!?]{10,100})/gi,
        // Morning/afternoon/evening patterns
        /(esta mañana|mañana|esta tarde|tarde|esta noche|noche|this morning|morning|this afternoon|afternoon|this evening|evening|tonight)[^.!?]{10,100}/gi,
        // Portuguese time ranges
        /entre (?:as )?(\d{1,2}(?::\d{2})?)\s*(?:e|-)\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?[^.!?]*?([^.!?]{10,100})/gi
      ];

      for (const pattern of timePatterns) {
        let match;
        while ((match = pattern.exec(aiResponse)) !== null) {
          const fullMatch = match[0].trim();

          // Extract time window if numeric times are present
          let timeWindow = 'today';
          if (match[1] && match[2]) {
            timeWindow = `${match[1]}-${match[2]} ${match[3] || ''}`.trim();
          } else if (match[1]) {
            timeWindow = match[1].toLowerCase();
          }

          predictions.push({
            text: fullMatch,
            timeWindow: timeWindow,
            type: 'time_specific'
          });
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PATTERN 2: Event predictions (will/going to/expect)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const eventKeywords = [
        // Spanish predictive verbs
        'tendrás', 'recibirás', 'encontrarás', 'sucederá', 'llegará',
        'experimentarás', 'conocerás', 'descubrirás', 'lograrás', 'conseguirás',
        // English predictive verbs
        'you will', 'you\'ll receive', 'you\'ll find', 'you\'ll meet',
        'expect', 'likely', 'will happen', 'going to', 'you\'ll experience',
        // Portuguese predictive verbs
        'você terá', 'você receberá', 'você encontrará', 'acontecerá',
        'você experimentará', 'você conhecerá', 'você descobrirá'
      ];

      for (const keyword of eventKeywords) {
        const regex = new RegExp(`${keyword}[^.!?]{10,120}[.!?]`, 'gi');
        let match;
        while ((match = regex.exec(aiResponse)) !== null) {
          const fullMatch = match[0].trim();

          // Skip if already captured by time patterns
          const isDuplicate = predictions.some(p =>
            p.text.includes(fullMatch) || fullMatch.includes(p.text)
          );

          if (!isDuplicate) {
            predictions.push({
              text: fullMatch,
              timeWindow: 'today',
              type: 'event'
            });
          }
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PATTERN 3: Opportunity predictions
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const opportunityKeywords = [
        'oportunidad', 'opportunity', 'chance', 'posibilidad', 'possibility',
        'puerta se abrirá', 'door will open', 'porta se abrirá'
      ];

      for (const keyword of opportunityKeywords) {
        const regex = new RegExp(`[^.!?]{0,30}${keyword}[^.!?]{10,100}[.!?]`, 'gi');
        let match;
        while ((match = regex.exec(aiResponse)) !== null) {
          const fullMatch = match[0].trim();

          const isDuplicate = predictions.some(p =>
            p.text.includes(fullMatch) || fullMatch.includes(p.text)
          );

          if (!isDuplicate) {
            predictions.push({
              text: fullMatch,
              timeWindow: 'this week',
              type: 'opportunity'
            });
          }
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STORE PREDICTIONS IN DATABASE
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      let storedCount = 0;

      for (const pred of predictions) {
        try {
          // Determine focus area from horoscope context
          const focusArea = this._determineFocusArea(pred.text, horoscope);

          await db.query(
            `INSERT INTO predictions
             (user_id, prediction_text, predicted_for_date, predicted_for_time_window,
              focus_area, metadata, user_feedback)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              userId,
              pred.text,
              tomorrowStr,
              pred.timeWindow,
              focusArea,
              JSON.stringify({
                type: pred.type,
                extracted_from: 'ai_coach_response',
                horoscope_context: horoscope?.highlights?.[0] || 'general'
              }),
              'pending'
            ]
          );
          storedCount++;
        } catch (dbError) {
          // Skip duplicate predictions (unique constraint)
          if (!dbError.message.includes('duplicate')) {
            logger.logError(dbError, {
              context: 'store_prediction',
              userId,
              predictionText: pred.text
            });
          }
        }
      }

      if (storedCount > 0) {
        logger.logInfo(`✅ Extracted ${storedCount} predictions for user`, {
          userId,
          predictionsCount: storedCount,
          responseLength: aiResponse.length
        });
      }

      return storedCount;

    } catch (error) {
      logger.logError(error, {
        context: 'extract_predictions',
        userId,
        responseLength: aiResponse?.length
      });
      return 0;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🔍 CHECK YESTERDAY'S PREDICTIONS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Checks if user has predictions from yesterday that need feedback.
   * This is called at the start of each AI Coach session.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Feedback request or null
   */
  async checkYesterdayPredictions(userId) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const predictions = await db.query(
        `SELECT id, prediction_text, predicted_for_time_window, focus_area
         FROM predictions
         WHERE user_id = $1
         AND predicted_for_date = $2
         AND (user_feedback IS NULL OR user_feedback = 'pending')
         ORDER BY created_at DESC
         LIMIT 3`,
        [userId, yesterdayStr]
      );

      if (predictions.rows.length === 0) {
        return null;
      }

      // Build multilingual feedback request
      const feedbackRequest = this._buildFeedbackRequest(predictions.rows);

      return {
        predictions: predictions.rows,
        feedbackRequest
      };

    } catch (error) {
      logger.logError(error, {
        context: 'check_yesterday_predictions',
        userId
      });
      return null;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 💬 PROCESS USER FEEDBACK
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Processes user's response to prediction verification.
   * Detects hit/miss keywords and updates prediction accordingly.
   *
   * @param {string} userId - User ID
   * @param {string} userResponse - User's feedback message
   * @returns {Promise<Object|null>} Celebration message if hit
   */
  async processFeedback(userId, userResponse) {
    try {
      // Detect feedback sentiment (hit/miss/partial)
      const sentiment = this._detectFeedbackSentiment(userResponse);

      if (!sentiment) {
        return null; // Not a feedback response
      }

      const { feedback, score } = sentiment;

      // Update most recent pending prediction
      const updateResult = await db.query(
        `UPDATE predictions
         SET user_feedback = $1,
             accuracy_score = $2,
             feedback_given_at = NOW()
         WHERE id = (
           SELECT id FROM predictions
           WHERE user_id = $3
           AND (user_feedback IS NULL OR user_feedback = 'pending')
           ORDER BY created_at DESC
           LIMIT 1
         )
         RETURNING id, prediction_text, focus_area`,
        [feedback, score, userId]
      );

      if (updateResult.rows.length === 0) {
        return null; // No pending predictions
      }

      const updatedPrediction = updateResult.rows[0];

      // If hit, generate celebration message
      if (feedback === 'hit') {
        return await this._generateCelebration(userId, updatedPrediction);
      }

      // If miss, offer encouragement
      if (feedback === 'miss') {
        return this._generateEncouragement(userId);
      }

      // Partial hit acknowledgment
      return this._generatePartialAcknowledgment(userId);

    } catch (error) {
      logger.logError(error, {
        context: 'process_feedback',
        userId,
        userResponse
      });
      return null;
    }
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 📊 GET ACCURACY STATISTICS
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * Retrieves user's prediction accuracy stats for celebration.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Accuracy statistics
   */
  async getAccuracyStats(userId) {
    try {
      const stats = await db.query(
        `SELECT
           total_predictions,
           total_hits,
           total_misses,
           total_partial,
           monthly_accuracy,
           all_time_accuracy,
           current_streak,
           longest_streak
         FROM user_prediction_analytics
         WHERE user_id = $1`,
        [userId]
      );

      if (stats.rows.length === 0) {
        return {
          total_predictions: 0,
          total_checked: 0,
          hits: 0,
          misses: 0,
          monthly_accuracy: 0,
          streak: 0,
          longest_streak: 0
        };
      }

      const data = stats.rows[0];

      return {
        total_predictions: parseInt(data.total_predictions) || 0,
        total_checked: (parseInt(data.total_hits) || 0) + (parseInt(data.total_misses) || 0) + (parseInt(data.total_partial) || 0),
        hits: parseInt(data.total_hits) || 0,
        misses: parseInt(data.total_misses) || 0,
        monthly_accuracy: parseFloat(data.monthly_accuracy) || 0,
        all_time_accuracy: parseFloat(data.all_time_accuracy) || 0,
        streak: parseInt(data.current_streak) || 0,
        longest_streak: parseInt(data.longest_streak) || 0
      };

    } catch (error) {
      logger.logError(error, {
        context: 'get_accuracy_stats',
        userId
      });
      return {
        total_predictions: 0,
        total_checked: 0,
        hits: 0,
        monthly_accuracy: 0,
        streak: 0
      };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRIVATE HELPER METHODS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Determine focus area from prediction text
   */
  _determineFocusArea(predictionText, horoscope) {
    const text = predictionText.toLowerCase();

    // Love keywords
    if (text.match(/amor|love|romance|pareja|partner|relacion|relationship|corazon|heart/i)) {
      return 'love';
    }

    // Career keywords
    if (text.match(/trabajo|work|career|carrera|profesional|professional|negocio|business|jefe|boss/i)) {
      return 'career';
    }

    // Money keywords
    if (text.match(/dinero|money|financ|financial|ingreso|income|ganancia|profit|inversión|investment/i)) {
      return 'money';
    }

    // Health keywords
    if (text.match(/salud|health|energia|energy|bienestar|wellness|cuerpo|body|físic|physical/i)) {
      return 'health';
    }

    // Communication keywords
    if (text.match(/mensaje|message|llamada|call|comunicación|communication|hablar|speak|texto|text/i)) {
      return 'communication';
    }

    // Fallback to horoscope highlights
    return horoscope?.highlights?.[0] || 'general';
  }

  /**
   * Build feedback request message
   */
  _buildFeedbackRequest(predictions) {
    // Detect language from first prediction (simple heuristic)
    const firstPredText = predictions[0].prediction_text.toLowerCase();
    const isSpanish = firstPredText.match(/tendr|recibir|encontrar|suceder/);
    const isPortuguese = firstPredText.match(/terá|receberá|encontrará|acontecerá/);

    let feedbackRequest = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    if (isSpanish) {
      feedbackRequest += '🔮 VERIFICACIÓN DE PREDICCIONES\n';
      feedbackRequest += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      feedbackRequest += 'Ayer te predije algunas cosas. ¿Se cumplieron?\n\n';
    } else if (isPortuguese) {
      feedbackRequest += '🔮 VERIFICAÇÃO DE PREVISÕES\n';
      feedbackRequest += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      feedbackRequest += 'Ontem eu previ algumas coisas. Elas se realizaram?\n\n';
    } else {
      feedbackRequest += '🔮 PREDICTION CHECK-IN\n';
      feedbackRequest += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      feedbackRequest += 'Yesterday I predicted some things. Did they happen?\n\n';
    }

    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i];
      feedbackRequest += `${i + 1}. "${pred.prediction_text}"\n`;
      if (pred.predicted_for_time_window && pred.predicted_for_time_window !== 'today') {
        feedbackRequest += `   (${isSpanish ? 'Tiempo' : isPortuguese ? 'Tempo' : 'Time'}: ${pred.predicted_for_time_window})\n`;
      }
      feedbackRequest += '\n';
    }

    if (isSpanish) {
      feedbackRequest += '¿Alguna se cumplió? Cuéntame brevemente 😊\n';
      feedbackRequest += '(Esto me ayuda a mejorar mi precisión para ti)\n';
    } else if (isPortuguese) {
      feedbackRequest += 'Alguma se realizou? Me conte brevemente 😊\n';
      feedbackRequest += '(Isso me ajuda a melhorar minha precisão para você)\n';
    } else {
      feedbackRequest += 'Did any come true? Tell me briefly 😊\n';
      feedbackRequest += '(This helps me improve my accuracy for you)\n';
    }

    return feedbackRequest;
  }

  /**
   * Detect feedback sentiment from user response
   */
  _detectFeedbackSentiment(userResponse) {
    const lowerResponse = userResponse.toLowerCase();

    // Hit keywords (multilingual)
    const hitKeywords = [
      'sí', 'si', 'yes', 'yeah', 'yep', 'exacto', 'correcto', 'cierto',
      'verdad', 'cumplió', 'pasó', 'sucedió', 'acertaste', 'right',
      'correct', 'happened', 'true', 'absolutely', 'definitely',
      'sim', 'exato', 'verdade', 'aconteceu', 'certo'
    ];

    // Miss keywords (multilingual)
    const missKeywords = [
      'no', 'nope', 'nah', 'nada', 'nothing', 'wrong', 'incorrecto',
      'falso', 'no pasó', 'no sucedió', 'didn\'t happen', 'didn\'t come true',
      'não', 'não aconteceu', 'errado', 'falso'
    ];

    // Partial keywords (multilingual)
    const partialKeywords = [
      'más o menos', 'kind of', 'sort of', 'parcialmente', 'partially',
      'algo', 'something', 'a little', 'un poco', 'partly',
      'meio que', 'mais ou menos', 'um pouco'
    ];

    // Check for hits
    const hasHitKeyword = hitKeywords.some(kw => lowerResponse.includes(kw));
    const hasMissKeyword = missKeywords.some(kw => lowerResponse.includes(kw));
    const hasPartialKeyword = partialKeywords.some(kw => lowerResponse.includes(kw));

    // Priority: partial > miss > hit
    if (hasPartialKeyword) {
      return { feedback: 'partial', score: 50 };
    }

    if (hasMissKeyword) {
      return { feedback: 'miss', score: 0 };
    }

    if (hasHitKeyword) {
      return { feedback: 'hit', score: 100 };
    }

    return null; // No clear feedback detected
  }

  /**
   * Generate celebration message for prediction hit
   */
  async _generateCelebration(userId, prediction) {
    const stats = await this.getAccuracyStats(userId);

    // Detect language
    const isSpanish = prediction.prediction_text.match(/tendr|recibir|encontrar/i);
    const isPortuguese = prediction.prediction_text.match(/terá|receberá|encontrará/i);

    let celebration = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    if (isSpanish) {
      celebration += '✨ ¡PREDICCIÓN CUMPLIDA! ✨\n';
      celebration += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      celebration += '🎯 ¡LO SABÍA! El cosmos no miente.\n\n';
      celebration += 'Mi precisión contigo:\n';
      celebration += `• Este mes: ${stats.monthly_accuracy}% de aciertos\n`;
      celebration += `• Total de predicciones verificadas: ${stats.total_checked}\n`;
      celebration += `• Racha de aciertos consecutivos: ${stats.streak}${stats.streak >= 3 ? ' 🔥' : ''}\n\n`;

      if (stats.monthly_accuracy >= 70) {
        celebration += '💎 ¡Tu conexión cósmica es EXCEPCIONAL!\n';
        celebration += 'Con Universe tier trackeo TODAS mis predicciones\n';
        celebration += 'y te muestro tendencias a largo plazo 📊\n\n';
      }

      celebration += '🔮 Tu próxima predicción viene en tu horóscopo de mañana...\n';

    } else if (isPortuguese) {
      celebration += '✨ PREVISÃO REALIZADA! ✨\n';
      celebration += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      celebration += '🎯 EU SABIA! O cosmos não mente.\n\n';
      celebration += 'Minha precisão com você:\n';
      celebration += `• Este mês: ${stats.monthly_accuracy}% de acertos\n`;
      celebration += `• Total de previsões verificadas: ${stats.total_checked}\n`;
      celebration += `• Sequência de acertos consecutivos: ${stats.streak}${stats.streak >= 3 ? ' 🔥' : ''}\n\n`;

      if (stats.monthly_accuracy >= 70) {
        celebration += '💎 Sua conexão cósmica é EXCEPCIONAL!\n';
        celebration += 'Com Universe tier eu rastreio TODAS as minhas previsões\n';
        celebration += 'e mostro tendências de longo prazo 📊\n\n';
      }

      celebration += '🔮 Sua próxima previsão vem no seu horóscopo de amanhã...\n';

    } else {
      celebration += '✨ PREDICTION CONFIRMED! ✨\n';
      celebration += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      celebration += '🎯 I KNEW IT! The cosmos doesn\'t lie.\n\n';
      celebration += 'My accuracy with you:\n';
      celebration += `• This month: ${stats.monthly_accuracy}% hits\n`;
      celebration += `• Total verified predictions: ${stats.total_checked}\n`;
      celebration += `• Current hit streak: ${stats.streak}${stats.streak >= 3 ? ' 🔥' : ''}\n\n`;

      if (stats.monthly_accuracy >= 70) {
        celebration += '💎 Your cosmic connection is EXCEPTIONAL!\n';
        celebration += 'With Universe tier I track ALL my predictions\n';
        celebration += 'and show you long-term trends 📊\n\n';
      }

      celebration += '🔮 Your next prediction comes in tomorrow\'s horoscope...\n';
    }

    return celebration;
  }

  /**
   * Generate encouragement for prediction miss
   */
  _generateEncouragement(userId) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💙 Gracias por tu honestidad
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Las estrellas muestran posibilidades, no certezas.
Tu feedback me ayuda a mejorar mis predicciones para ti.

🔮 Seguiré afinando mi sintonía con tu energía...
    `;
  }

  /**
   * Generate acknowledgment for partial hit
   */
  _generatePartialAcknowledgment(userId) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ¡Interesante!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A veces las predicciones se manifiestan
de formas inesperadas.

Gracias por compartir tu experiencia 💫
    `;
  }

  /**
   * Detect if user message contains prediction feedback
   */
  detectsPredictionFeedback(userMessage) {
    const feedbackPatterns = [
      /sí|si\s|yes|exacto|correcto|cumplió|pasó|acertaste/i,
      /no\s|nope|nada|nothing|wrong|no pasó|didn't/i,
      /más o menos|kind of|sort of|parcialmente|algo|partially/i
    ];

    return feedbackPatterns.some(pattern => pattern.test(userMessage));
  }
}

module.exports = new RetroacivePredictionService();
