const OpenAI = require('openai');
const moment = require('moment');
const db = require('../config/db');

class HoroscopeGeneratorService {
  constructor() {
    // Initialize OpenAI only if API key is available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.enabled = true;
    } else {
      console.warn('⚠️  OpenAI API key not configured - running in mock mode');
      this.openai = null;
      this.enabled = false;
    }
    
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
  }

  /**
   * Generate daily horoscopes for all signs and languages
   */
  async generateDailyHoroscopes() {
    console.log('🌟 Starting daily horoscope generation...');
    const date = moment().format('YYYY-MM-DD');
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    // Clean old daily horoscopes (keep only last 7 days)
    await this.cleanOldDailyHoroscopes();

    for (const sign of this.signs) {
      for (const language of this.languages) {
        try {
          const horoscope = await this.generateDailyHoroscope(sign, language, date);
          await this.storeDailyHoroscope(horoscope);
          
          results.success++;
          results.details.push({
            sign,
            language: language.code,
            status: 'generated'
          });
          
          // Small delay to avoid rate limits
          await this.delay(100);
          
        } catch (error) {
          console.error(`Error generating daily horoscope for ${sign} ${language.code}:`, error.message);
          results.errors++;
          results.details.push({
            sign,
            language: language.code,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    console.log(`✅ Daily generation completed: ${results.success} success, ${results.errors} errors`);
    return results;
  }

  /**
   * Generate weekly horoscopes for all signs and languages
   */
  async generateWeeklyHoroscopes() {
    console.log('📅 Starting weekly horoscope generation...');
    const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
    const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    // Clean old weekly horoscopes (keep only last 4 weeks)
    await this.cleanOldWeeklyHoroscopes();

    for (const sign of this.signs) {
      for (const language of this.languages) {
        try {
          const horoscope = await this.generateWeeklyHoroscope(sign, language, weekStart, weekEnd);
          await this.storeWeeklyHoroscope(horoscope);
          
          results.success++;
          results.details.push({
            sign,
            language: language.code,
            status: 'generated'
          });
          
          // Delay to avoid rate limits
          await this.delay(200);
          
        } catch (error) {
          console.error(`Error generating weekly horoscope for ${sign} ${language.code}:`, error.message);
          results.errors++;
          results.details.push({
            sign,
            language: language.code,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    console.log(`✅ Weekly generation completed: ${results.success} success, ${results.errors} errors`);
    return results;
  }

  /**
   * Generate single daily horoscope using OpenAI
   */
  async generateDailyHoroscope(sign, language, date) {
    // Return mock data if OpenAI is not enabled
    if (!this.enabled || !this.openai) {
      return this.getMockDailyHoroscope(sign, language, date);
    }

    const prompt = this.getDailyPrompt(sign, language.name, date);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // gpt-4o-mini: más rápido y barato, soporta json_object
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Generate daily horoscope for ${sign} in ${language.name} for ${date}` }
        ],
        temperature: 0.8,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const content = JSON.parse(response.choices[0].message.content);
      
      return {
        sign,
        language_code: language.code,
        date,
        content
      };
      
    } catch (error) {
      console.error(`OpenAI API error for ${sign} ${language.code}:`, error);
      throw error;
    }
  }

  /**
   * Generate single weekly horoscope using OpenAI
   */
  async generateWeeklyHoroscope(sign, language, weekStart, weekEnd) {
    // Return mock data if OpenAI is not enabled
    if (!this.enabled || !this.openai) {
      return this.getMockWeeklyHoroscope(sign, language, weekStart, weekEnd);
    }

    const prompt = this.getWeeklyPrompt(sign, language.name, weekStart, weekEnd);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // gpt-4o-mini: más rápido y barato, soporta json_object
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Generate weekly horoscope for ${sign} in ${language.name} for week ${weekStart} to ${weekEnd}` }
        ],
        temperature: 0.8,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      });

      const content = JSON.parse(response.choices[0].message.content);
      
      return {
        sign,
        language_code: language.code,
        week_start: weekStart,
        week_end: weekEnd,
        content
      };
      
    } catch (error) {
      console.error(`OpenAI API error for weekly ${sign} ${language.code}:`, error);
      throw error;
    }
  }

  /**
   * Daily horoscope prompt (based on your original)
   */
  getDailyPrompt(sign, languageName, date) {
    // Características astrológicas profundas por signo
    const signTraits = {
      'Aries': 'elemento Fuego, planeta Marte, cualidades: valentía, liderazgo, impulsividad, energía pionera, necesidad de acción',
      'Tauro': 'elemento Tierra, planeta Venus, cualidades: estabilidad, sensualidad, determinación, amor por belleza, resistencia al cambio',
      'Géminis': 'elemento Aire, planeta Mercurio, cualidades: comunicación, curiosidad, versatilidad, dualidad, pensamiento rápido',
      'Cáncer': 'elemento Agua, planeta Luna, cualidades: emotividad, intuición, protección, nostalgia, necesidad de seguridad',
      'Leo': 'elemento Fuego, planeta Sol, cualidades: creatividad, generosidad, orgullo, necesidad de reconocimiento, liderazgo natural',
      'Virgo': 'elemento Tierra, planeta Mercurio, cualidades: perfeccionismo, análisis, servicio, salud, atención al detalle',
      'Libra': 'elemento Aire, planeta Venus, cualidades: equilibrio, diplomacia, estética, relaciones, búsqueda de justicia',
      'Escorpio': 'elemento Agua, planeta Plutón/Marte, cualidades: intensidad, transformación, profundidad emocional, poder personal',
      'Sagitario': 'elemento Fuego, planeta Júpiter, cualidades: expansión, filosofía, aventura, optimismo, búsqueda de verdad',
      'Capricornio': 'elemento Tierra, planeta Saturno, cualidades: disciplina, ambición, responsabilidad, estructura, paciencia',
      'Acuario': 'elemento Aire, planeta Urano/Saturno, cualidades: innovación, independencia, humanitarismo, originalidad, visión futura',
      'Piscis': 'elemento Agua, planeta Neptuno/Júpiter, cualidades: compasión, intuición espiritual, creatividad, sensibilidad, conexión universal'
    };

    return `Eres "Cosmic Coach", un astrólogo profesional experto con conocimiento profundo de astrología tradicional y psicológica.

📌 CONTEXTO ASTROLÓGICO ESPECIALIZADO PARA ${sign.toUpperCase()}:
${signTraits[sign] || signTraits['Aries']}

Tu tarea: Generar un coaching diario **altamente personalizado** para ${sign} en idioma ${languageName}, fecha ${date}.

⭐ PRINCIPIOS ASTROLÓGICOS A CONSIDERAR:
- Tránsitos planetarios actuales y su impacto en ${sign}
- La energía natural del elemento y planeta regente
- Los desafíos y fortalezas inherentes del signo
- Ciclos lunares y su influencia emocional
- Aspectos con otros planetas que afectan áreas de vida

🎯 REQUISITOS DE CALIDAD:
1. NUNCA usar frases genéricas que sirvan para cualquier signo
2. SIEMPRE mencionar características específicas de ${sign}
3. Conectar el consejo con las cualidades naturales del signo
4. Ser práctico, específico y aplicable al día actual
5. Tono empático pero profesional, como un astrólogo experto

Responde SOLO con este JSON (sin texto adicional):

{
  "sign": "${sign}",
  "language_code": "CODIGO_IDIOMA_CORRECTO",
  "date": "${date}",
  "coaching_focus": "2-4 palabras tema del día conectado a naturaleza de ${sign}",
  "ai_insight": "15-25 palabras sobre tránsito astrológico actual relevante para ${sign}",
  "content": "80-120 palabras de coaching ESPECÍFICO para ${sign}, mencionando sus cualidades naturales y cómo usarlas hoy. NO genérico.",
  "rating": "entero 3-5 basado en energía planetaria del día para ${sign}",
  "lucky_numbers": [int, int, int],
  "lucky_colors": ["color1", "color2"],
  "advice": "10-15 palabras de acción concreta aprovechando fortalezas de ${sign}",
  "content_type": "cosmic_coaching",
  "generated_at": "${date}"
}`;
  }

  /**
   * Weekly horoscope prompt (enhanced version)
   */
  getWeeklyPrompt(sign, languageName, weekStart, weekEnd) {
    return `Eres "Cosmic Coach", una IA sabia y empática experta en astrología y coaching de vida. Tu tarea es generar un objeto JSON completo y válido en idioma ${languageName}, con un coaching semanal personalizado para el signo ${sign}, para la semana del ${weekStart} al ${weekEnd}.

La salida debe ser **solo** un objeto JSON, sin ningún texto adicional antes o después.

{
  "sign": "${sign}",
  "language_code": "USAR_CODIGO_CORRESPONDIENTE",
  "week_start": "${weekStart}",
  "week_end": "${weekEnd}",
  "weekly_theme": "string",
  "cosmic_overview": "string",
  "general": "string",
  "love": "string",
  "health": "string",
  "money": "string",
  "career": "string",
  "spirituality": "string",
  "weekly_challenge": "string",
  "weekly_opportunity": "string",
  "best_days": ["string", "string"],
  "energy_level": "integer entre 6 y 10",
  "luck_rating": "integer entre 4 y 8",
  "lucky_numbers": [int, int, int, int],
  "lucky_colors": ["string", "string", "string"],
  "power_mantra": "string",
  "key_advice": "string",
  "content_type": "weekly_cosmic_coaching",
  "generated_at": "${moment().format('YYYY-MM-DD')}"
}

### Instrucciones específicas:

- "weekly_theme": 3 a 5 palabras que capturen la esencia de la semana
- "cosmic_overview": análisis astrológico breve (25-35 palabras)
- "general": predicción general detallada (120-150 palabras)
- "love": relaciones y romance (80-100 palabras)
- "health": bienestar físico y mental (60-80 palabras)  
- "money": finanzas y economía (80-100 palabras)
- "career": trabajo y desarrollo profesional (60-80 palabras)
- "spirituality": crecimiento personal (50-70 palabras)
- "weekly_challenge": principal reto (20-30 palabras)
- "weekly_opportunity": mejor oportunidad (20-30 palabras)
- "best_days": dos días más favorables ["Lunes", "Miércoles"]
- "energy_level": entero entre 6 y 10
- "luck_rating": entero entre 4 y 8
- "lucky_numbers": cuatro enteros entre 1 y 99
- "lucky_colors": tres colores como strings
- "power_mantra": afirmación (8-12 palabras)
- "key_advice": consejo principal (15-25 palabras)

Tu salida debe ser **solo** ese JSON.`;
  }

  /**
   * Store daily horoscope in database
   */
  async storeDailyHoroscope(horoscope) {
    const query = `
      INSERT INTO daily_horoscopes (sign, language_code, date, content)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sign, language_code, date) 
      DO UPDATE SET content = $4, updated_at = NOW()
    `;
    
    await db.query(query, [
      horoscope.sign,
      horoscope.language_code,
      horoscope.date,
      JSON.stringify(horoscope.content)
    ]);
  }

  /**
   * Store weekly horoscope in database
   */
  async storeWeeklyHoroscope(horoscope) {
    const query = `
      INSERT INTO weekly_horoscopes (sign, language_code, week_start, week_end, content)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (sign, language_code, week_start)
      DO UPDATE SET content = $5, updated_at = NOW(), week_end = $4
    `;
    
    await db.query(query, [
      horoscope.sign,
      horoscope.language_code,
      horoscope.week_start,
      horoscope.week_end,
      JSON.stringify(horoscope.content)
    ]);
  }

  /**
   * Clean old daily horoscopes (keep last 7 days)
   */
  async cleanOldDailyHoroscopes() {
    try {
      const result = await db.query(`
        DELETE FROM daily_horoscopes 
        WHERE date < CURRENT_DATE - INTERVAL '7 days'
      `);
      console.log(`🧹 Cleaned ${result.rowCount} old daily horoscopes`);
    } catch (error) {
      console.error('Error cleaning old daily horoscopes:', error);
    }
  }

  /**
   * Clean old weekly horoscopes (keep last 4 weeks)
   */
  async cleanOldWeeklyHoroscopes() {
    try {
      const result = await db.query(`
        DELETE FROM weekly_horoscopes 
        WHERE week_start < CURRENT_DATE - INTERVAL '28 days'
      `);
      console.log(`🧹 Cleaned ${result.rowCount} old weekly horoscopes`);
    } catch (error) {
      console.error('Error cleaning old weekly horoscopes:', error);
    }
  }

  /**
   * Utility: Add delay between requests
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get generation status and statistics
   */
  async getGenerationStats() {
    try {
      const dailyCount = await db.query(`
        SELECT COUNT(*) as count FROM daily_horoscopes 
        WHERE date = CURRENT_DATE
      `);
      
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weeklyCount = await db.query(`
        SELECT COUNT(*) as count FROM weekly_horoscopes 
        WHERE week_start = $1
      `, [weekStart]);

      return {
        daily: {
          current: parseInt(dailyCount.rows[0].count),
          expected: 72,
          coverage: Math.round((parseInt(dailyCount.rows[0].count) / 72) * 100)
        },
        weekly: {
          current: parseInt(weeklyCount.rows[0].count),
          expected: 72,
          coverage: Math.round((parseInt(weeklyCount.rows[0].count) / 72) * 100)
        }
      };
    } catch (error) {
      console.error('Error getting generation stats:', error);
      return null;
    }
  }

  /**
   * 🎭 MOCK DAILY HOROSCOPE (for development without OpenAI)
   */
  getMockDailyHoroscope(sign, language, date) {
    return {
      sign: sign,
      date: date,
      language_code: language.code,
      general: `Mock daily horoscope for ${sign} on ${date}. The stars are aligned for positive energy and new opportunities.`,
      content: `Your ${sign} daily prediction. Focus on personal growth and embrace the changes coming your way.`,
      daily: `Today's ${sign} horoscope brings cosmic insights for your journey ahead.`,
      weekly: `This week brings transformation for ${sign} signs.`,
      monthly: `This month holds special significance for ${sign} individuals.`,
      yearly: `The year ahead promises growth and success for ${sign}.`,
      love_rating: Math.floor(Math.random() * 5) + 1,
      work_rating: Math.floor(Math.random() * 5) + 1,
      health_rating: Math.floor(Math.random() * 5) + 1,
      money_rating: Math.floor(Math.random() * 5) + 1,
      overall_rating: Math.floor(Math.random() * 5) + 1,
      lucky_number: Math.floor(Math.random() * 99) + 1,
      lucky_color: ['Gold', 'Silver', 'Blue', 'Green', 'Red', 'Purple'][Math.floor(Math.random() * 6)],
      mood: ['Optimistic', 'Energetic', 'Calm', 'Focused', 'Creative'][Math.floor(Math.random() * 5)],
      advice: 'Trust your instincts today and take positive action toward your goals.',
      keywords: 'Success, Growth, Opportunity, Change, Wisdom'
    };
  }

  /**
   * 🎭 MOCK WEEKLY HOROSCOPE (for development without OpenAI)
   */
  getMockWeeklyHoroscope(sign, language, weekStart, weekEnd) {
    return {
      sign: sign,
      week_start: weekStart,
      week_end: weekEnd,
      language_code: language.code,
      content: `Mock weekly horoscope for ${sign} from ${weekStart} to ${weekEnd}. This week brings opportunities for growth.`,
      weekly: `Weekly predictions for ${sign}: Expect positive changes and new beginnings this week.`,
      predictions: `The cosmos suggests this is a powerful week for ${sign} individuals.`,
      love_rating: Math.floor(Math.random() * 5) + 1,
      work_rating: Math.floor(Math.random() * 5) + 1,
      health_rating: Math.floor(Math.random() * 5) + 1,
      money_rating: Math.floor(Math.random() * 5) + 1,
      overall_rating: Math.floor(Math.random() * 5) + 1,
      lucky_numbers: [Math.floor(Math.random() * 99) + 1, Math.floor(Math.random() * 99) + 1].join(', '),
      lucky_colors: ['Gold', 'Silver', 'Blue'][Math.floor(Math.random() * 3)],
      advice: 'Focus on your goals and trust the process this week.',
      keywords: 'Progress, Wisdom, Balance, Success, Harmony'
    };
  }
}

module.exports = new HoroscopeGeneratorService();