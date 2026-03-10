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

    // Biorhythm phases for personalized horoscopes
    this.biorhythmPhases = [
      { code: 'high', name: 'Peak Energy', description: 'User is in high energy phase - focus on action and achievement' },
      { code: 'neutral', name: 'Balanced', description: 'User is in balanced phase - good for reflection and planning' },
      { code: 'low', name: 'Recovery', description: 'User is in recovery phase - focus on rest and self-care' }
    ];

    // Frases genéricas prohibidas (para validación de calidad)
    this.genericPhrases = [
      'today is a good day',
      'hoy es un buen día',
      'you will have success',
      'tendrás éxito',
      'be positive',
      'sé positivo',
      'good luck',
      'buena suerte',
      'trust yourself',
      'confía en ti',
      'follow your heart',
      'sigue tu corazón'
    ];
  }

  /**
   * Generate daily horoscopes for all signs and languages
   */
  async generateDailyHoroscopes() {
    // // console.log('🌟 Starting daily horoscope generation...');
    const today = moment().format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    // Clean old daily horoscopes (keep yesterday, today, tomorrow)
    await this.cleanOldDailyHoroscopes();

    // Generate for today and tomorrow
    for (const date of [today, tomorrow]) {
      // Paralelizar generación por signo (12 signos en paralelo)
      const signPromises = this.signs.map(async (sign) => {
        // Para cada signo, generar todos los idiomas en serie
        for (const language of this.languages) {
          try {
            const horoscope = await this.generateDailyHoroscope(sign, language, date);
            await this.storeDailyHoroscope(horoscope);

            results.success++;
            results.details.push({
              sign,
              language: language.code,
              date,
              status: 'generated'
            });

            // Small delay between languages for same sign
            await this.delay(100);

          } catch (error) {
            console.error(`Error generating daily horoscope for ${sign} ${language.code} (${date}):`, error.message);
            results.errors++;
            results.details.push({
              sign,
              language: language.code,
              date,
              status: 'error',
              error: error.message
            });
          }
        }
      });

      // Esperar que todos los signos terminen para esta fecha
      await Promise.all(signPromises);
    }

    // // console.log(`✅ Daily generation completed: ${results.success} success, ${results.errors} errors`);
    return results;
  }

  /**
   * Generate weekly horoscopes for all signs and languages
   */
  async generateWeeklyHoroscopes() {
    // // console.log('📅 Starting weekly horoscope generation...');
    const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
    const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    // Clean old weekly horoscopes (keep only last 4 weeks)
    await this.cleanOldWeeklyHoroscopes();

    // Paralelizar generación por signo (12 signos en paralelo)
    const signPromises = this.signs.map(async (sign) => {
      // Para cada signo, generar todos los idiomas en serie
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

          // Delay between languages for same sign
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
    });

    // Esperar que todos los signos terminen
    await Promise.all(signPromises);

    // // console.log(`✅ Weekly generation completed: ${results.success} success, ${results.errors} errors`);
    return results;
  }

  /**
   * Generate single daily horoscope using OpenAI with retry logic
   */
  async generateDailyHoroscope(sign, language, date) {
    // Return mock data if OpenAI is not enabled
    if (!this.enabled || !this.openai) {
      return this.getMockDailyHoroscope(sign, language, date);
    }

    const prompt = this.getDailyPrompt(sign, language.name, date);
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // // console.log(`📝 Generating daily ${sign} ${language.code} (attempt ${attempt}/${maxRetries})`);

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

        // Validar calidad del contenido
        const validation = this.validateHoroscopeQuality(content, sign);
        if (!validation.valid) {
          console.warn(`⚠️ Quality issues in daily ${sign} ${language.code}:`, validation.issues);
          // Continuar de todos modos, pero loggear
        } else {
          // // console.log(`✅ Daily ${sign} ${language.code} generated with high quality`);
        }

        return {
          sign,
          language_code: language.code,
          date,
          content
        };

      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;

        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for daily ${sign} ${language.code}:`, error.message);

        if (isLastAttempt) {
          console.error(`🚨 All ${maxRetries} attempts failed for daily ${sign} ${language.code}`);
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        // // console.log(`⏳ Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  /**
   * Generate single weekly horoscope using OpenAI with retry logic
   */
  async generateWeeklyHoroscope(sign, language, weekStart, weekEnd) {
    // Return mock data if OpenAI is not enabled
    if (!this.enabled || !this.openai) {
      return this.getMockWeeklyHoroscope(sign, language, weekStart, weekEnd);
    }

    const prompt = this.getWeeklyPrompt(sign, language.name, weekStart, weekEnd);
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // // console.log(`📅 Generating weekly ${sign} ${language.code} (attempt ${attempt}/${maxRetries})`);

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

        // Validar calidad del contenido
        const validation = this.validateHoroscopeQuality(content, sign);
        if (!validation.valid) {
          console.warn(`⚠️ Quality issues in weekly ${sign} ${language.code}:`, validation.issues);
          // Continuar de todos modos, pero loggear
        } else {
          // // console.log(`✅ Weekly ${sign} ${language.code} generated with high quality`);
        }

        return {
          sign,
          language_code: language.code,
          week_start: weekStart,
          week_end: weekEnd,
          content
        };

      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;

        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for weekly ${sign} ${language.code}:`, error.message);

        if (isLastAttempt) {
          console.error(`🚨 All ${maxRetries} attempts failed for weekly ${sign} ${language.code}`);
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        // // console.log(`⏳ Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  /**
   * Validate horoscope content quality
   * Returns { valid: boolean, issues: string[] }
   */
  validateHoroscopeQuality(content, sign) {
    const issues = [];

    // Convertir todo a minúsculas para comparación
    const textToCheck = JSON.stringify(content).toLowerCase();
    const signLower = sign.toLowerCase();

    // 1. Verificar que NO contenga frases genéricas
    for (const phrase of this.genericPhrases) {
      if (textToCheck.includes(phrase.toLowerCase())) {
        issues.push(`Contains generic phrase: "${phrase}"`);
      }
    }

    // 2. Verificar que mencione el signo específico
    if (!textToCheck.includes(signLower)) {
      issues.push(`Does not mention sign name: "${sign}"`);
    }

    // 3. Verificar longitud mínima (al menos 100 caracteres)
    if (textToCheck.length < 100) {
      issues.push(`Content too short: ${textToCheck.length} characters`);
    }

    // 4. Verificar que tenga estructura JSON correcta
    if (!content.general && !content.love && !content.work && !content.health) {
      issues.push('Missing required content fields (general/love/work/health)');
    }

    return {
      valid: issues.length === 0,
      issues
    };
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
6. SIEMPRE escribir en PRESENTE, como si el lector estuviera viviendo ese día AHORA. Nunca decir "mañana", "tomorrow", "demain", etc. Escribe como si la fecha ${date} fuera HOY para quien lee.

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
   * Weekly horoscope prompt (ENHANCED with astrological context)
   */
  getWeeklyPrompt(sign, languageName, weekStart, weekEnd) {
    // Reutilizar definiciones astrológicas del prompt diario
    const signTraits = {
      'Aries': 'Fuego/Marte: liderazgo natural, energía pionera, impulso competitivo, coraje en desafíos',
      'Tauro': 'Tierra/Venus: construcción sólida, placeres sensoriales, persistencia inquebrantable, necesidad de seguridad material',
      'Géminis': 'Aire/Mercurio: mente versátil, comunicación multifacética, curiosidad intelectual, adaptabilidad social',
      'Cáncer': 'Agua/Luna: profundidad emocional, instinto protector, memoria del pasado, necesidad de hogar',
      'Leo': 'Fuego/Sol: expresión creativa, necesidad de brillo, generosidad natural, liderazgo carismático',
      'Virgo': 'Tierra/Mercurio: perfección en detalles, servicio dedicado, análisis meticuloso, mejora continua',
      'Libra': 'Aire/Venus: búsqueda de armonía, diplomacia relacional, estética refinada, justicia equilibrada',
      'Escorpio': 'Agua/Plutón: transformación profunda, poder emocional, regeneración constante, investigación de misterios',
      'Sagitario': 'Fuego/Júpiter: expansión filosófica, búsqueda de verdad, optimismo aventurero, visión global',
      'Capricornio': 'Tierra/Saturno: ambición estructurada, responsabilidad madura, logro a largo plazo, maestría profesional',
      'Acuario': 'Aire/Urano: innovación revolucionaria, conciencia humanitaria, independencia intelectual, visión futurista',
      'Piscis': 'Agua/Neptuno: compasión universal, intuición mística, creatividad ilimitada, disolución de fronteras'
    };

    return `Eres "Cosmic Coach", astrólogo profesional con especialización en predicciones semanales basadas en tránsitos planetarios.

📌 PERFIL ASTROLÓGICO DE ${sign.toUpperCase()}:
${signTraits[sign] || signTraits['Aries']}

CONTEXTO TEMPORAL: Semana ${weekStart} a ${weekEnd}

🌟 TU MISIÓN: Crear predicción semanal ALTAMENTE PERSONALIZADA para ${sign} en ${languageName}.

⚡ ENFOQUE ASTROLÓGICO PROFESIONAL:
- Considera cómo tránsitos planetarios afectan ESPECÍFICAMENTE a ${sign}
- Conecta cada área de vida con cualidades naturales del signo
- Menciona fortalezas inherentes y cómo aprovecharlas esta semana
- Identifica desafíos típicos de ${sign} y cómo superarlos
- Usa lenguaje de astrólogo experto, no genérico

🚫 PROHIBIDO:
- Frases que sirvan para cualquier signo
- Consejos genéricos sin conexión al perfil de ${sign}
- Ignorar elemento (Fuego/Tierra/Aire/Agua) y planeta regente

Responde SOLO con JSON (sin texto antes/después):

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
   * Clean old daily horoscopes (keep yesterday, today, and tomorrow only)
   */
  async cleanOldDailyHoroscopes() {
    try {
      const result = await db.query(`
        DELETE FROM daily_horoscopes
        WHERE date < CURRENT_DATE - INTERVAL '1 day'
      `);
      // // console.log(`🧹 Cleaned ${result.rowCount} old daily horoscopes`);
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
      // // console.log(`🧹 Cleaned ${result.rowCount} old weekly horoscopes`);
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

  // ============================================
  // BIORHYTHM-ENHANCED HOROSCOPE GENERATION
  // ============================================

  /**
   * Generate daily horoscopes with biorhythm phases (36 base + translations)
   * Cost optimization: Generate 36 in English, translate to 5 other languages with GPT-3.5
   */
  async generateDailyHoroscopesWithBiorhythm() {
    console.log('🌟 Starting biorhythm-enhanced daily horoscope generation...');
    const date = moment().format('YYYY-MM-DD');
    const results = {
      success: 0,
      errors: 0,
      translations: 0,
      details: []
    };

    // Clean old daily horoscopes
    await this.cleanOldDailyHoroscopes();

    // STEP 1: Generate 36 horoscopes in English (12 signs × 3 phases)
    const englishHoroscopes = [];

    for (const sign of this.signs) {
      for (const phase of this.biorhythmPhases) {
        try {
          const horoscope = await this.generateDailyHoroscopeWithPhase(sign, { code: 'en', name: 'english' }, date, phase);
          englishHoroscopes.push(horoscope);
          await this.storeDailyHoroscopeWithPhase(horoscope);

          results.success++;
          results.details.push({ sign, phase: phase.code, language: 'en', status: 'generated' });

          await this.delay(100);
        } catch (error) {
          console.error(`Error generating ${sign} ${phase.code}:`, error.message);
          results.errors++;
        }
      }
    }

    console.log(`✅ Generated ${englishHoroscopes.length} English horoscopes with biorhythm phases`);

    // STEP 2: Translate to other 5 languages with GPT-3.5-turbo (cheaper)
    const otherLanguages = this.languages.filter(l => l.code !== 'en');

    for (const horoscope of englishHoroscopes) {
      for (const targetLang of otherLanguages) {
        try {
          const translated = await this.translateHoroscope(horoscope, targetLang);
          await this.storeDailyHoroscopeWithPhase(translated);

          results.translations++;
          results.details.push({
            sign: horoscope.sign,
            phase: horoscope.biorhythm_phase,
            language: targetLang.code,
            status: 'translated'
          });

          await this.delay(50); // Shorter delay for translations
        } catch (error) {
          console.error(`Error translating ${horoscope.sign} to ${targetLang.code}:`, error.message);
          results.errors++;
        }
      }
    }

    console.log(`✅ Biorhythm generation completed: ${results.success} generated, ${results.translations} translated, ${results.errors} errors`);
    return results;
  }

  /**
   * Generate single horoscope with biorhythm phase context
   */
  async generateDailyHoroscopeWithPhase(sign, language, date, phase) {
    if (!this.enabled || !this.openai) {
      return this.getMockDailyHoroscopeWithPhase(sign, language, date, phase);
    }

    const prompt = this.getDailyPromptWithBiorhythm(sign, language.name, date, phase);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Generate biorhythm-aware daily horoscope for ${sign} in ${phase.name} phase` }
      ],
      temperature: 0.8,
      max_tokens: 900,
      response_format: { type: 'json_object' }
    });

    const content = JSON.parse(response.choices[0].message.content);

    return {
      sign,
      language_code: language.code,
      date,
      biorhythm_phase: phase.code,
      content
    };
  }

  /**
   * Translate horoscope using GPT-3.5-turbo (cheaper model)
   */
  async translateHoroscope(horoscope, targetLanguage) {
    if (!this.enabled || !this.openai) {
      return { ...horoscope, language_code: targetLanguage.code };
    }

    const contentToTranslate = JSON.stringify(horoscope.content);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Cheaper model for translations
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in astrology content.
Translate the following JSON horoscope content to ${targetLanguage.name}.
Keep all JSON keys in English, only translate the VALUES.
Maintain the mystical and empathetic tone of astrology.
Return ONLY valid JSON, no other text.`
        },
        { role: 'user', content: contentToTranslate }
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const translatedContent = JSON.parse(response.choices[0].message.content);

    return {
      sign: horoscope.sign,
      language_code: targetLanguage.code,
      date: horoscope.date,
      biorhythm_phase: horoscope.biorhythm_phase,
      content: translatedContent
    };
  }

  /**
   * Daily prompt WITH biorhythm context
   */
  getDailyPromptWithBiorhythm(sign, languageName, date, phase) {
    const signTraits = {
      'Aries': 'elemento Fuego, planeta Marte, cualidades: valentía, liderazgo, impulsividad, energía pionera',
      'Tauro': 'elemento Tierra, planeta Venus, cualidades: estabilidad, sensualidad, determinación, resistencia',
      'Géminis': 'elemento Aire, planeta Mercurio, cualidades: comunicación, curiosidad, versatilidad, dualidad',
      'Cáncer': 'elemento Agua, planeta Luna, cualidades: emotividad, intuición, protección, nostalgia',
      'Leo': 'elemento Fuego, planeta Sol, cualidades: creatividad, generosidad, orgullo, liderazgo natural',
      'Virgo': 'elemento Tierra, planeta Mercurio, cualidades: perfeccionismo, análisis, servicio, atención al detalle',
      'Libra': 'elemento Aire, planeta Venus, cualidades: equilibrio, diplomacia, estética, búsqueda de justicia',
      'Escorpio': 'elemento Agua, planeta Plutón, cualidades: intensidad, transformación, profundidad emocional',
      'Sagitario': 'elemento Fuego, planeta Júpiter, cualidades: expansión, filosofía, aventura, optimismo',
      'Capricornio': 'elemento Tierra, planeta Saturno, cualidades: disciplina, ambición, responsabilidad, paciencia',
      'Acuario': 'elemento Aire, planeta Urano, cualidades: innovación, independencia, humanitarismo, originalidad',
      'Piscis': 'elemento Agua, planeta Neptuno, cualidades: compasión, intuición espiritual, creatividad'
    };

    const phaseGuidance = {
      'high': `The user is in PEAK ENERGY phase (biorhythm cycles above 50%).
Focus your advice on: taking action, starting projects, physical activities,
important decisions, social interactions, and maximizing productivity.
Tone: Motivating, energetic, encouraging bold moves.`,
      'neutral': `The user is in BALANCED phase (biorhythm cycles between -20% and 50%).
Focus your advice on: reflection, planning, moderate activities,
maintaining routines, and preparing for future opportunities.
Tone: Balanced, thoughtful, steady guidance.`,
      'low': `The user is in RECOVERY phase (biorhythm cycles below -20%).
Focus your advice on: rest, self-care, avoiding major decisions,
introspection, healing, and conserving energy for better days ahead.
Tone: Compassionate, gentle, supportive, reassuring.`
    };

    return `You are "Cosmic Coach", a professional astrologer creating PERSONALIZED horoscopes.

📌 ASTROLOGICAL PROFILE FOR ${sign.toUpperCase()}:
${signTraits[sign] || signTraits['Aries']}

🔋 BIORHYTHM ENERGY CONTEXT (CRITICAL):
${phaseGuidance[phase.code]}

Your task: Generate a daily coaching message for ${sign} in ${languageName} for ${date}.
The advice MUST be specifically tailored to someone in ${phase.name} energy phase.

⚠️ IMPORTANT RULES:
1. NEVER use generic phrases that work for any sign or any energy level
2. ALWAYS connect advice to the user's current biorhythm phase
3. Mention ${sign}'s natural qualities and how to use them TODAY given their energy
4. Be practical, specific, and relevant to their energy state
5. ALWAYS write in PRESENT TENSE as if the reader is living this day RIGHT NOW. Never say "tomorrow" or "yesterday" — write as if ${date} is TODAY for the reader.

Respond ONLY with this JSON (no additional text):

{
  "sign": "${sign}",
  "language_code": "en",
  "date": "${date}",
  "biorhythm_phase": "${phase.code}",
  "energy_insight": "15-20 words about how ${sign}'s natural energy combines with ${phase.name} phase today",
  "coaching_focus": "3-5 words - theme of the day based on sign + energy phase",
  "content": "100-130 words of coaching SPECIFICALLY for ${sign} in ${phase.name} phase. Include actionable advice matching their energy level.",
  "energy_tip": "15-20 words - specific tip for managing ${phase.name} energy as a ${sign}",
  "rating": "integer 3-5 based on how favorable the day is for ${sign} in this phase",
  "lucky_numbers": [int, int, int],
  "lucky_colors": ["color1", "color2"],
  "best_activity": "5-10 words - ideal activity for ${sign} in ${phase.name} phase",
  "content_type": "biorhythm_cosmic_coaching",
  "generated_at": "${date}"
}`;
  }

  /**
   * Store horoscope with biorhythm phase
   */
  async storeDailyHoroscopeWithPhase(horoscope) {
    // First, try to create the column if it doesn't exist (safe migration)
    try {
      await db.query(`
        ALTER TABLE daily_horoscopes
        ADD COLUMN IF NOT EXISTS biorhythm_phase VARCHAR(20) DEFAULT 'neutral'
      `);
    } catch (e) {
      // Column might already exist, ignore
    }

    const query = `
      INSERT INTO daily_horoscopes (sign, language_code, date, biorhythm_phase, content)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (sign, language_code, date, biorhythm_phase)
      DO UPDATE SET content = $5, updated_at = NOW()
    `;

    await db.query(query, [
      horoscope.sign,
      horoscope.language_code,
      horoscope.date,
      horoscope.biorhythm_phase || 'neutral',
      JSON.stringify(horoscope.content)
    ]);
  }

  /**
   * Get horoscope by sign, language, date, and biorhythm phase
   */
  async getDailyHoroscopeWithPhase(sign, languageCode, date, biorhythmPhase = 'neutral') {
    const query = `
      SELECT * FROM daily_horoscopes
      WHERE sign = $1 AND language_code = $2 AND date = $3 AND biorhythm_phase = $4
    `;

    const result = await db.query(query, [sign, languageCode, date, biorhythmPhase]);
    return result.rows[0] || null;
  }

  /**
   * Mock horoscope with biorhythm phase (for development)
   */
  getMockDailyHoroscopeWithPhase(sign, language, date, phase) {
    const phaseMessages = {
      'high': `Your ${sign} energy is at peak levels today! This is the perfect time to take action.`,
      'neutral': `As a ${sign}, today offers balanced energy for reflection and steady progress.`,
      'low': `Dear ${sign}, today calls for gentle self-care and rest. Honor your body's need to recover.`
    };

    return {
      sign,
      language_code: language.code,
      date,
      biorhythm_phase: phase.code,
      content: {
        sign,
        date,
        biorhythm_phase: phase.code,
        energy_insight: `Mock insight for ${sign} in ${phase.name} phase`,
        coaching_focus: `${phase.name} Focus`,
        content: phaseMessages[phase.code],
        energy_tip: `Tip for ${sign} in ${phase.code} energy`,
        rating: phase.code === 'high' ? 5 : phase.code === 'neutral' ? 4 : 3,
        lucky_numbers: [7, 14, 21],
        lucky_colors: ['Gold', 'Silver'],
        best_activity: `Best activity for ${phase.code} phase`,
        content_type: 'biorhythm_cosmic_coaching'
      }
    };
  }
}

module.exports = new HoroscopeGeneratorService();