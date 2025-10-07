const OpenAI = require('openai');
const moment = require('moment');
const db = require('../config/db');
const logger = require('./loggingService');
const cacheService = require('./cacheService');
const circuitBreaker = require('./circuitBreakerService');
const firebaseService = require('./firebaseService');

/**
 * 🔮 ENHANCED HOROSCOPE GENERATOR - PRODUCTION READY
 * With circuit breakers, caching, Firebase notifications, and comprehensive error handling
 */
class EnhancedHoroscopeGeneratorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.signs = [
      'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
      'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
    ];
    
    this.languages = [
      { code: 'es', name: 'español' },
      { code: 'en', name: 'english' },
      { code: 'de', name: 'deutsch' },
      { code: 'fr', name: 'français' },
      { code: 'it', name: 'italiano' },
      { code: 'pt', name: 'português' }
    ];

    // Enhanced prompts with better structure
    this.dailyPrompts = {
      es: (sign, date) => `
Genera un horóscopo diario para ${sign} el ${date}.
Incluye:
- Energía general del día (2-3 líneas)
- Amor y relaciones (2 líneas)
- Trabajo y finanzas (2 líneas)
- Salud y bienestar (1-2 líneas)
- Consejo cósmico del día (1 línea)

Tono: positivo, inspirador, específico. Máximo 150 palabras.
Evita generalidades. Usa "tú" para dirigirte al lector.
      `,
      en: (sign, date) => `
Generate a daily horoscope for ${sign} on ${date}.
Include:
- General day energy (2-3 lines)
- Love and relationships (2 lines)
- Work and finances (2 lines)
- Health and wellness (1-2 lines)
- Cosmic advice of the day (1 line)

Tone: positive, inspiring, specific. Maximum 150 words.
Avoid generalities. Use "you" to address the reader.
      `
    };

    this.weeklyPrompts = {
      es: (sign, weekStart, weekEnd) => `
Genera un horóscopo semanal para ${sign} del ${weekStart} al ${weekEnd}.
Incluye:
- Panorama general de la semana (3-4 líneas)
- Lunes a Miércoles: inicio de semana (2-3 líneas)
- Jueves a Viernes: mitad de semana (2-3 líneas)  
- Fin de semana: descanso y reflexión (2-3 líneas)
- Números de la suerte y colores recomendados
- Mantra semanal (1 línea)

Tono: inspirador, detallado, práctico. Máximo 200 palabras.
      `,
      en: (sign, weekStart, weekEnd) => `
Generate a weekly horoscope for ${sign} from ${weekStart} to ${weekEnd}.
Include:
- General week overview (3-4 lines)
- Monday to Wednesday: week start (2-3 lines)
- Thursday to Friday: mid-week (2-3 lines)
- Weekend: rest and reflection (2-3 lines)
- Lucky numbers and recommended colors
- Weekly mantra (1 line)

Tone: inspiring, detailed, practical. Maximum 200 words.
      `
    };
  }

  /**
   * Enhanced daily horoscope generation with circuit breakers and caching
   */
  async generateDailyHoroscopes() {
    logger.getLogger().info('🌟 Starting enhanced daily horoscope generation...');
    const date = moment().format('YYYY-MM-DD');
    const results = {
      success: 0,
      errors: 0,
      cached: 0,
      details: [],
      notifications: [],
      performance: {
        startTime: Date.now(),
        endTime: null,
        duration: null
      }
    };

    try {
      // Clean old horoscopes with circuit breaker protection
      await circuitBreaker.executeDatabase(async () => {
        await this.cleanOldDailyHoroscopes();
        logger.logDatabase('cleanup', { type: 'daily_horoscopes', date });
      });

      const horoscopesToNotify = [];
      const batch = [];

      // Generate horoscopes in batches to prevent overload
      for (let signIndex = 0; signIndex < this.signs.length; signIndex++) {
        const sign = this.signs[signIndex];
        
        for (let langIndex = 0; langIndex < this.languages.length; langIndex++) {
          const language = this.languages[langIndex];
          batch.push({ sign, language });
        }
      }

      // Process in chunks of 6 to prevent API overload
      const chunkSize = 6;
      for (let i = 0; i < batch.length; i += chunkSize) {
        const chunk = batch.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async ({ sign, language }) => {
          try {
            const cacheKey = `daily_${sign}_${language.code}_${date}`;
            
            // Check cache first
            let horoscope = await cacheService.getCachedHoroscope(sign, 'daily');
            let fromCache = false;

            if (horoscope && horoscope.language === language.code) {
              fromCache = true;
              results.cached++;
              logger.logPerformance('horoscope_cache_hit', 1, { sign, language: language.code });
            } else {
              // Generate new horoscope with circuit breaker
              horoscope = await circuitBreaker.executeOpenAI(async () => {
                return await this.generateSingleDailyHoroscope(sign, language, date);
              }, {
                timeout: 30000,
                errorThresholdPercentage: 30
              });
              
              // Cache the generated horoscope
              await cacheService.cacheHoroscope(sign, 'daily', horoscope, 24 * 3600);
              logger.logPerformance('horoscope_generated', 1, { sign, language: language.code });
            }
            
            // Store in database with circuit breaker
            await circuitBreaker.executeDatabase(async () => {
              await this.storeDailyHoroscope(horoscope);
            });
            
            // Collect Spanish horoscopes for notifications
            if (language.code === 'es') {
              horoscopesToNotify.push(horoscope);
            }
            
            results.success++;
            results.details.push({
              sign,
              language: language.code,
              status: 'success',
              fromCache,
              generatedAt: new Date().toISOString()
            });

          } catch (error) {
            logger.logError(error, { 
              operation: 'generate_daily_horoscope',
              sign,
              language: language.code 
            });
            
            results.errors++;
            results.details.push({
              sign,
              language: language.code,
              status: 'error',
              error: error.message,
              errorType: error.name
            });
          }
        }));

        // Brief pause between chunks
        if (i + chunkSize < batch.length) {
          await this.delay(1000);
        }
      }

      // Send Firebase notifications
      if (horoscopesToNotify.length > 0) {
        try {
          const notificationResults = await circuitBreaker.executeFirebase(async () => {
            return await firebaseService.sendDailyHoroscopeNotifications(horoscopesToNotify);
          });
          
          results.notifications = notificationResults;
          logger.getLogger().info(`📱 Sent ${notificationResults.length} daily horoscope notifications`);
        } catch (error) {
          logger.logError(error, { operation: 'send_daily_notifications' });
        }
      }

    } catch (error) {
      logger.logError(error, { operation: 'generate_daily_horoscopes_main' });
      throw error;
    }

    // Calculate performance metrics
    results.performance.endTime = Date.now();
    results.performance.duration = results.performance.endTime - results.performance.startTime;
    
    logger.logPerformance('daily_horoscope_generation', results.performance.duration, {
      success: results.success,
      errors: results.errors,
      cached: results.cached,
      total: results.success + results.errors
    });

    logger.getLogger().info(`✅ Enhanced daily horoscope generation completed: ${results.success} success, ${results.errors} errors, ${results.cached} from cache (${results.performance.duration}ms)`);
    return results;
  }

  /**
   * Enhanced weekly horoscope generation
   */
  async generateWeeklyHoroscopes() {
    logger.getLogger().info('🔮 Starting enhanced weekly horoscope generation...');
    const weekStart = moment().startOf('week').format('YYYY-MM-DD');
    const weekEnd = moment().endOf('week').format('YYYY-MM-DD');
    
    const results = {
      success: 0,
      errors: 0,
      cached: 0,
      details: [],
      notifications: [],
      performance: {
        startTime: Date.now(),
        endTime: null,
        duration: null
      }
    };

    try {
      // Clean old weekly horoscopes
      await circuitBreaker.executeDatabase(async () => {
        await this.cleanOldWeeklyHoroscopes();
        logger.logDatabase('cleanup', { type: 'weekly_horoscopes', weekStart, weekEnd });
      });

      const horoscopesToNotify = [];

      for (const sign of this.signs) {
        for (const language of this.languages) {
          try {
            const cacheKey = `weekly_${sign}_${language.code}_${weekStart}`;
            
            // Check cache first
            let horoscope = await cacheService.get(cacheKey);
            let fromCache = false;

            if (horoscope) {
              fromCache = true;
              results.cached++;
            } else {
              // Generate new weekly horoscope
              horoscope = await circuitBreaker.executeOpenAI(async () => {
                return await this.generateSingleWeeklyHoroscope(sign, language, weekStart, weekEnd);
              }, {
                timeout: 45000, // Longer timeout for weekly horoscopes
                errorThresholdPercentage: 30
              });
              
              // Cache for a week
              await cacheService.set(cacheKey, horoscope, 7 * 24 * 3600);
            }
            
            // Store in database
            await circuitBreaker.executeDatabase(async () => {
              await this.storeWeeklyHoroscope(horoscope);
            });
            
            // Collect for notifications (Spanish only)
            if (language.code === 'es') {
              horoscopesToNotify.push(horoscope);
            }
            
            results.success++;
            results.details.push({
              sign,
              language: language.code,
              status: 'success',
              fromCache,
              weekStart,
              weekEnd
            });

            // Longer delay for weekly generation
            await this.delay(2000);

          } catch (error) {
            logger.logError(error, { 
              operation: 'generate_weekly_horoscope',
              sign,
              language: language.code,
              weekStart,
              weekEnd 
            });
            
            results.errors++;
            results.details.push({
              sign,
              language: language.code,
              status: 'error',
              error: error.message,
              weekStart,
              weekEnd
            });
          }
        }
      }

      // Send weekly notifications
      if (horoscopesToNotify.length > 0) {
        try {
          const notificationResults = await circuitBreaker.executeFirebase(async () => {
            return await firebaseService.sendWeeklyHoroscopeNotifications(horoscopesToNotify);
          });
          
          results.notifications = notificationResults;
          logger.getLogger().info(`📱 Sent ${notificationResults.length} weekly horoscope notifications`);
        } catch (error) {
          logger.logError(error, { operation: 'send_weekly_notifications' });
        }
      }

    } catch (error) {
      logger.logError(error, { operation: 'generate_weekly_horoscopes_main' });
      throw error;
    }

    // Performance metrics
    results.performance.endTime = Date.now();
    results.performance.duration = results.performance.endTime - results.performance.startTime;
    
    logger.logPerformance('weekly_horoscope_generation', results.performance.duration, {
      success: results.success,
      errors: results.errors,
      cached: results.cached
    });

    logger.getLogger().info(`✅ Enhanced weekly horoscope generation completed: ${results.success} success, ${results.errors} errors, ${results.cached} from cache (${results.performance.duration}ms)`);
    return results;
  }

  /**
   * Generate single daily horoscope with enhanced prompts
   */
  async generateSingleDailyHoroscope(sign, language, date) {
    const prompt = this.dailyPrompts[language.code] || this.dailyPrompts['en'];
    
    try {
      logger.logExternalAPI('openai', 'generate_daily_horoscope', { 
        sign, 
        language: language.code,
        date 
      });

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a professional astrologer creating personalized, positive horoscopes. Write in ${language.name}. Be specific, inspiring, and avoid generic statements.`
          },
          {
            role: "user",
            content: prompt(sign, date)
          }
        ],
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const content = completion.choices[0].message.content.trim();
      
      return {
        sign,
        date,
        content,
        language: language.code,
        created_at: new Date().toISOString(),
        model: 'gpt-4',
        tokens_used: completion.usage?.total_tokens || 0
      };

    } catch (error) {
      logger.logError(error, {
        operation: 'openai_generate_daily',
        sign,
        language: language.code,
        date
      });
      throw error;
    }
  }

  /**
   * Generate single weekly horoscope with enhanced prompts
   */
  async generateSingleWeeklyHoroscope(sign, language, weekStart, weekEnd) {
    const prompt = this.weeklyPrompts[language.code] || this.weeklyPrompts['en'];
    
    try {
      logger.logExternalAPI('openai', 'generate_weekly_horoscope', { 
        sign, 
        language: language.code,
        weekStart,
        weekEnd 
      });

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a professional astrologer creating detailed weekly horoscopes. Write in ${language.name}. Be comprehensive, inspiring, and provide practical guidance.`
          },
          {
            role: "user",
            content: prompt(sign, weekStart, weekEnd)
          }
        ],
        max_tokens: 400,
        temperature: 0.7,
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      });

      const content = completion.choices[0].message.content.trim();
      
      return {
        sign,
        week_start: weekStart,
        week_end: weekEnd,
        content,
        language: language.code,
        created_at: new Date().toISOString(),
        model: 'gpt-4',
        tokens_used: completion.usage?.total_tokens || 0
      };

    } catch (error) {
      logger.logError(error, {
        operation: 'openai_generate_weekly',
        sign,
        language: language.code,
        weekStart,
        weekEnd
      });
      throw error;
    }
  }

  /**
   * Store daily horoscope in database
   */
  async storeDailyHoroscope(horoscope) {
    const query = `
      INSERT INTO daily_horoscopes (sign, date, content, language_code, created_at, model, tokens_used) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (sign, date, language_code) 
      DO UPDATE SET 
        content = EXCLUDED.content,
        created_at = EXCLUDED.created_at,
        model = EXCLUDED.model,
        tokens_used = EXCLUDED.tokens_used
    `;
    
    const values = [
      horoscope.sign,
      horoscope.date,
      horoscope.content,
      horoscope.language,
      horoscope.created_at,
      horoscope.model || 'gpt-4',
      horoscope.tokens_used || 0
    ];

    await db.query(query, values);
    logger.logDatabase('insert', { 
      table: 'daily_horoscopes',
      sign: horoscope.sign,
      date: horoscope.date,
      language: horoscope.language
    });
  }

  /**
   * Store weekly horoscope in database
   */
  async storeWeeklyHoroscope(horoscope) {
    const query = `
      INSERT INTO weekly_horoscopes (sign, week_start, week_end, content, language_code, created_at, model, tokens_used) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (sign, week_start, language_code) 
      DO UPDATE SET 
        content = EXCLUDED.content,
        week_end = EXCLUDED.week_end,
        created_at = EXCLUDED.created_at,
        model = EXCLUDED.model,
        tokens_used = EXCLUDED.tokens_used
    `;
    
    const values = [
      horoscope.sign,
      horoscope.week_start,
      horoscope.week_end,
      horoscope.content,
      horoscope.language,
      horoscope.created_at,
      horoscope.model || 'gpt-4',
      horoscope.tokens_used || 0
    ];

    await db.query(query, values);
    logger.logDatabase('insert', { 
      table: 'weekly_horoscopes',
      sign: horoscope.sign,
      weekStart: horoscope.week_start,
      language: horoscope.language
    });
  }

  /**
   * Clean old daily horoscopes (keep last 7 days)
   */
  async cleanOldDailyHoroscopes() {
    const cutoffDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
    const query = 'DELETE FROM daily_horoscopes WHERE date < $1';
    const result = await db.query(query, [cutoffDate]);
    logger.logDatabase('cleanup', { 
      table: 'daily_horoscopes',
      cutoffDate,
      deletedRows: result.rowCount
    });
  }

  /**
   * Clean old weekly horoscopes (keep last 4 weeks)
   */
  async cleanOldWeeklyHoroscopes() {
    const cutoffDate = moment().subtract(4, 'weeks').startOf('week').format('YYYY-MM-DD');
    const query = 'DELETE FROM weekly_horoscopes WHERE week_start < $1';
    const result = await db.query(query, [cutoffDate]);
    logger.logDatabase('cleanup', { 
      table: 'weekly_horoscopes',
      cutoffDate,
      deletedRows: result.rowCount
    });
  }

  /**
   * Test OpenAI connection with circuit breaker
   */
  async testOpenAIConnection() {
    try {
      const result = await circuitBreaker.executeOpenAI(async () => {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a test assistant."
            },
            {
              role: "user",
              content: "Say 'Connection test successful' in exactly those words."
            }
          ],
          max_tokens: 10,
          temperature: 0
        });

        return completion.choices[0].message.content;
      });

      logger.logExternalAPI('openai', 'connection_test', { success: true });
      return { success: true, response: result };
    } catch (error) {
      logger.logError(error, { operation: 'openai_connection_test' });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats() {
    try {
      const dailyQuery = `
        SELECT 
          COUNT(*) as total_daily,
          COUNT(DISTINCT sign) as signs_daily,
          COUNT(DISTINCT language) as languages_daily,
          MAX(created_at) as last_daily_generation
        FROM daily_horoscopes 
        WHERE date = CURRENT_DATE
      `;
      
      const weeklyQuery = `
        SELECT 
          COUNT(*) as total_weekly,
          COUNT(DISTINCT sign) as signs_weekly,
          COUNT(DISTINCT language) as languages_weekly,
          MAX(created_at) as last_weekly_generation
        FROM weekly_horoscopes 
        WHERE week_start <= CURRENT_DATE AND week_end >= CURRENT_DATE
      `;

      const [dailyResult, weeklyResult] = await Promise.all([
        db.query(dailyQuery),
        db.query(weeklyQuery)
      ]);

      const cacheStats = cacheService.getStats();
      const circuitBreakerStats = circuitBreaker.getStatus();

      return {
        daily: dailyResult.rows[0],
        weekly: weeklyResult.rows[0],
        cache: cacheStats,
        circuitBreaker: circuitBreakerStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.logError(error, { operation: 'get_generation_stats' });
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const enhancedHoroscopeGenerator = new EnhancedHoroscopeGeneratorService();
module.exports = enhancedHoroscopeGenerator;