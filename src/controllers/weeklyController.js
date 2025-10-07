const db = require("../config/db");
const moment = require('moment');
const OpenAI = require('openai');

class WeeklyController {
  /**
   * Get weekly horoscope for a specific sign and language
   */
  async getWeeklyHoroscope(req, res) {
    const { sign, lang } = req.query;
    
    if (!sign) {
      return res.status(400).json({ 
        error: "Sign parameter is required",
        example: "/api/weekly/getWeeklyHoroscope?sign=Aries&lang=es"
      });
    }
    
    try {
      // Get current week (Monday to Sunday)
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
      
      const query = `
        SELECT * FROM weekly_horoscopes
        WHERE week_start = $1 AND week_end = $2
        AND sign ILIKE $3 AND language_code = $4
        LIMIT 1;
      `;
      
      const result = await db.query(query, [
        weekStart, 
        weekEnd, 
        sign, 
        lang || 'es'
      ]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: "Weekly horoscope not available yet",
          week: `${weekStart} to ${weekEnd}`,
          sign: sign,
          language: lang || 'es',
          message: "Weekly horoscopes are generated every Monday at 6 AM"
        });
      }
      
      const horoscope = result.rows[0];
      
      res.json({
        id: horoscope.id,
        sign: horoscope.sign,
        language_code: horoscope.language_code,
        type: 'weekly',
        week_start: horoscope.week_start,
        week_end: horoscope.week_end,
        content: horoscope.content,
        generated_at: horoscope.created_at,
        cached: true,
        week_period: `${weekStart} - ${weekEnd}`
      });
      
    } catch (error) {
      console.error("Weekly horoscope DB error:", error);
      res.status(500).json({ 
        error: "Internal server error",
        message: "Failed to fetch weekly horoscope"
      });
    }
  }
  
  /**
   * Get all weekly horoscopes for current week (optionally filtered by language)
   */
  async getAllWeeklyHoroscopes(req, res) {
    const { lang } = req.query;
    
    try {
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
      
      let query = `
        SELECT * FROM weekly_horoscopes
        WHERE week_start = $1 AND week_end = $2
      `;
      
      const queryParams = [weekStart, weekEnd];
      
      if (lang) {
        query += ` AND language_code = $3`;
        queryParams.push(lang);
      }
      
      query += ` ORDER BY sign`;
      
      const result = await db.query(query, queryParams);
      
      res.json({
        week_period: `${weekStart} - ${weekEnd}`,
        language_filter: lang || 'all',
        horoscopes: result.rows.map(row => ({
          id: row.id,
          sign: row.sign,
          language_code: row.language_code,
          content: row.content,
          generated_at: row.created_at
        })),
        total: result.rows.length,
        cached: true,
        expected_total: lang ? 12 : 72 // 12 signs per language or 72 total (12 x 6 languages)
      });
      
    } catch (error) {
      console.error("All weekly horoscopes DB error:", error);
      res.status(500).json({ 
        error: "Internal server error",
        message: "Failed to fetch all weekly horoscopes"
      });
    }
  }

  /**
   * Store weekly horoscopes (called from n8n webhook)
   */
  async storeWeeklyHoroscopes(horoscopes) {
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    for (const horoscope of horoscopes) {
      try {
        const { sign, language_code, content, week_start, week_end } = horoscope;
        
        if (!sign || !language_code || !content || !week_start || !week_end) {
          results.errors++;
          results.details.push({
            sign: sign || 'unknown',
            language_code: language_code || 'unknown',
            error: 'Missing required fields'
          });
          continue;
        }

        // Insert or update weekly horoscope
        const query = `
          INSERT INTO weekly_horoscopes (sign, language_code, week_start, week_end, content)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (sign, language_code, week_start)
          DO UPDATE SET 
            content = $5, 
            updated_at = NOW(),
            week_end = $4;
        `;
        
        await db.query(query, [sign, language_code, week_start, week_end, content]);
        
        results.success++;
        results.details.push({
          sign,
          language_code,
          status: 'stored'
        });

      } catch (error) {
        console.error(`Error storing weekly horoscope for ${horoscope.sign}:`, error);
        results.errors++;
        results.details.push({
          sign: horoscope.sign || 'unknown',
          language_code: horoscope.language_code || 'unknown',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check which weekly horoscopes are missing for current week
   */
  async checkMissingWeeklyHoroscopes() {
    const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
    const signs = [
      'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
      'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
    ];
    const languages = ['es', 'en', 'de', 'fr', 'it', 'pt'];
    
    const missing = [];
    
    for (const sign of signs) {
      for (const lang of languages) {
        try {
          const query = `
            SELECT COUNT(*) FROM weekly_horoscopes
            WHERE week_start = $1 AND sign = $2 AND language_code = $3
          `;
          const result = await db.query(query, [weekStart, sign, lang]);
          
          if (result.rows[0].count == 0) {
            missing.push({ 
              sign, 
              language_code: lang,
              week_start: weekStart 
            });
          }
        } catch (error) {
          console.error(`Error checking ${sign} ${lang}:`, error);
          missing.push({ 
            sign, 
            language_code: lang, 
            error: error.message 
          });
        }
      }
    }
    
    return missing;
  }

  /**
   * Generate all weekly horoscopes using OpenAI
   */
  async generateWeeklyHoroscopes(req, res) {
    const { admin_key, force, fill_missing } = req.query;

    // Security check
    if (admin_key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');

      // Check if horoscopes already exist for this week
      if (!force && !fill_missing) {
        const checkQuery = `SELECT COUNT(*) FROM weekly_horoscopes WHERE week_start = $1`;
        const checkResult = await db.query(checkQuery, [weekStart]);

        if (parseInt(checkResult.rows[0].count) > 0) {
          return res.status(400).json({
            error: 'Horoscopes already exist for this week',
            message: 'Use force=true to regenerate or fill_missing=true to complete',
            week: `${weekStart} to ${weekEnd}`,
            existing_count: parseInt(checkResult.rows[0].count)
          });
        }
      }

      // Initialize OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                     'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
      const languages = {
        'en': 'English',
        'es': 'Spanish',
        'de': 'German',
        'fr': 'French',
        'it': 'Italian',
        'pt': 'Portuguese'
      };

      const results = {
        success: 0,
        errors: 0,
        skipped: 0,
        week: `${weekStart} to ${weekEnd}`,
        details: []
      };

      // Generate horoscopes for each sign and language
      for (const sign of signs) {
        for (const [langCode, langName] of Object.entries(languages)) {
          try {
            // If fill_missing mode, check if this specific horoscope already exists
            if (fill_missing && !force) {
              const existsQuery = `
                SELECT COUNT(*) FROM weekly_horoscopes
                WHERE week_start = $1 AND sign = $2 AND language_code = $3
              `;
              const existsResult = await db.query(existsQuery, [weekStart, sign, langCode]);

              if (parseInt(existsResult.rows[0].count) > 0) {
                results.skipped++;
                continue; // Skip this one, already exists
              }
            }
            console.log(`Generating weekly horoscope for ${sign} in ${langName}...`);

            const prompt = `Generate a detailed weekly horoscope for ${sign} for the week of ${weekStart} to ${weekEnd}.

Write in ${langName} language.

The horoscope should include:
- Overview of the week (2-3 sentences)
- Love & Relationships forecast
- Career & Finance insights
- Health & Wellness advice
- Lucky numbers and colors for the week

Write in a warm, insightful, and encouraging tone. Be specific about the week's energy and opportunities.
Keep the total length around 200-250 words.`;

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You are a professional astrologer with deep knowledge of zodiac signs and planetary influences. You provide insightful, positive, and actionable weekly horoscopes."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.8,
              max_tokens: 500
            });

            const content = completion.choices[0].message.content;

            // Store in database
            const insertQuery = `
              INSERT INTO weekly_horoscopes (sign, language_code, week_start, week_end, content)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (sign, language_code, week_start)
              DO UPDATE SET
                content = $5,
                updated_at = NOW(),
                week_end = $4
            `;

            await db.query(insertQuery, [sign, langCode, weekStart, weekEnd, content]);

            results.success++;
            results.details.push({
              sign,
              language: langName,
              status: 'generated'
            });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            console.error(`Error generating ${sign} ${langName}:`, error);
            results.errors++;
            results.details.push({
              sign,
              language: langName,
              status: 'error',
              error: error.message
            });
          }
        }
      }

      res.json({
        message: 'Weekly horoscope generation completed',
        week: `${weekStart} to ${weekEnd}`,
        total_expected: 72,
        success: results.success,
        skipped: results.skipped,
        errors: results.errors,
        completion_rate: `${Math.round((results.success / 72) * 100)}%`,
        details: results.details
      });

    } catch (error) {
      console.error("Generate weekly horoscopes error:", error);
      res.status(500).json({
        error: 'Failed to generate weekly horoscopes',
        message: error.message
      });
    }
  }
}

module.exports = new WeeklyController();