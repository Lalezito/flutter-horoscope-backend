const db = require("../config/db");
const weeklyController = require("./weeklyController");
const moment = require('moment');

class RecoveryController {
  /**
   * Force generation of missing weekly horoscopes (admin endpoint)
   */
  async forceWeeklyGeneration(req, res) {
    const { admin_key } = req.query;
    
    if (admin_key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
      // Check if there are missing weekly horoscopes for this week
      const missing = await weeklyController.checkMissingWeeklyHoroscopes();
      
      if (missing.length > 0) {
        // Generate fallback weekly horoscopes using daily ones
        const generated = await this.generateFallbackWeeklies(missing);
        
        res.json({ 
          success: true, 
          generated_count: generated.success,
          errors: generated.errors,
          missing_before: missing.length,
          message: 'Weekly horoscopes generated as fallback from daily ones',
          details: generated.details
        });
      } else {
        res.json({ 
          success: true,
          message: 'All weekly horoscopes are already available for this week',
          total_expected: 72
        });
      }
      
    } catch (error) {
      console.error('Recovery error:', error);
      res.status(500).json({ 
        error: 'Recovery failed',
        message: error.message
      });
    }
  }
  
  /**
   * Generate fallback weekly horoscopes from daily ones
   */
  async generateFallbackWeeklies(missing) {
    const results = {
      success: 0,
      errors: 0,
      details: []
    };
    
    for (const item of missing) {
      try {
        // Try to find a recent daily horoscope for this sign and language
        const dailyQuery = `
          SELECT * FROM daily_horoscopes
          WHERE sign = $1 AND language_code = $2
          ORDER BY date DESC
          LIMIT 1
        `;
        const daily = await db.query(dailyQuery, [item.sign, item.language_code]);
        
        if (daily.rows.length > 0) {
          const weeklyContent = this.extendDailyToWeekly(daily.rows[0].content, item.sign);
          
          const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
          const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
          
          const insertQuery = `
            INSERT INTO weekly_horoscopes (sign, language_code, week_start, week_end, content)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (sign, language_code, week_start)
            DO UPDATE SET content = $5, updated_at = NOW()
          `;
          
          await db.query(insertQuery, [
            item.sign, 
            item.language_code, 
            weekStart, 
            weekEnd, 
            weeklyContent
          ]);
          
          results.success++;
          results.details.push({
            sign: item.sign,
            language: item.language_code,
            status: 'generated_from_daily'
          });
          
        } else {
          // No daily horoscope found, create a generic one
          const genericContent = this.createGenericWeekly(item.sign, item.language_code);
          
          const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
          const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
          
          const insertQuery = `
            INSERT INTO weekly_horoscopes (sign, language_code, week_start, week_end, content)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (sign, language_code, week_start)
            DO UPDATE SET content = $5, updated_at = NOW()
          `;
          
          await db.query(insertQuery, [
            item.sign, 
            item.language_code, 
            weekStart, 
            weekEnd, 
            genericContent
          ]);
          
          results.success++;
          results.details.push({
            sign: item.sign,
            language: item.language_code,
            status: 'generated_generic'
          });
        }
        
      } catch (error) {
        console.error(`Error generating fallback for ${item.sign} ${item.language_code}:`, error);
        results.errors++;
        results.details.push({
          sign: item.sign,
          language: item.language_code,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Convert daily horoscope content to weekly format
   */
  extendDailyToWeekly(dailyContent, sign) {
    const baseContent = typeof dailyContent === 'string' ? JSON.parse(dailyContent) : dailyContent;
    
    return {
      type: 'weekly',
      sign: sign,
      general: baseContent.general + " Esta energía se mantendrá a lo largo de toda la semana, con pequeñas variaciones que te permitirán adaptarte a las circunstancias.",
      love: baseContent.love + " En el ámbito amoroso, la semana te traerá oportunidades de profundizar conexiones existentes.",
      health: baseContent.health + " Mantén estos hábitos saludables durante toda la semana para obtener mejores resultados.",
      money: baseContent.money + " Las tendencias económicas de esta semana favorecen las decisiones bien planificadas.",
      weekly_trend: "Tendencia semanal basada en predicción diaria extendida",
      source: "fallback_from_daily",
      generated_at: new Date().toISOString(),
      note: "Contenido generado automáticamente como respaldo del sistema"
    };
  }
  
  /**
   * Create generic weekly horoscope when no daily is available
   */
  createGenericWeekly(sign, language) {
    const templates = {
      es: {
        general: `Esta semana trae energías de renovación para ${sign}. Es un buen momento para reflexionar sobre tus metas y ajustar tu rumbo si es necesario.`,
        love: "Las relaciones personales requieren atención y comunicación clara. Evita malentendidos siendo más directo en tus expresiones.",
        health: "Tu bienestar físico y mental necesita equilibrio. Considera incorporar momentos de relajación en tu rutina diaria.",
        money: "Las finanzas requieren atención especial esta semana. Revisa tus gastos y planifica con cuidado tus inversiones.",
        weekly_trend: "Semana de introspección y planificación"
      },
      en: {
        general: `This week brings renewal energies for ${sign}. It's a good time to reflect on your goals and adjust your path if necessary.`,
        love: "Personal relationships require attention and clear communication. Avoid misunderstandings by being more direct in your expressions.",
        health: "Your physical and mental wellbeing needs balance. Consider incorporating relaxation moments into your daily routine.",
        money: "Finances require special attention this week. Review your expenses and carefully plan your investments.",
        weekly_trend: "Week of introspection and planning"
      }
    };
    
    const template = templates[language] || templates.es;
    
    return {
      type: 'weekly',
      sign: sign,
      ...template,
      source: "generic_fallback",
      generated_at: new Date().toISOString(),
      note: "Generic content generated as system fallback"
    };
  }

  /**
   * Check system integrity and missing data
   */
  async systemHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      status: 'checking',
      checks: {}
    };

    try {
      // Check database connectivity
      await db.query('SELECT 1');
      health.checks.database = { status: 'ok', message: 'Database connection successful' };

      // Check current week coverage
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weeklyCount = await db.query(
        'SELECT COUNT(*) FROM weekly_horoscopes WHERE week_start = $1',
        [weekStart]
      );
      
      const expectedWeeklies = 72; // 12 signs × 6 languages
      const actualWeeklies = parseInt(weeklyCount.rows[0].count);
      const weeklyPercentage = Math.round((actualWeeklies / expectedWeeklies) * 100);
      
      health.checks.weekly_coverage = {
        status: actualWeeklies >= expectedWeeklies ? 'ok' : 'warning',
        expected: expectedWeeklies,
        actual: actualWeeklies,
        percentage: weeklyPercentage
      };

      // Check daily coverage for today
      const dailyCount = await db.query(
        'SELECT COUNT(*) FROM daily_horoscopes WHERE date = CURRENT_DATE'
      );
      const actualDailies = parseInt(dailyCount.rows[0].count);
      const dailyPercentage = Math.round((actualDailies / expectedWeeklies) * 100);
      
      health.checks.daily_coverage = {
        status: actualDailies >= expectedWeeklies ? 'ok' : 'error',
        expected: expectedWeeklies,
        actual: actualDailies,
        percentage: dailyPercentage
      };

      // Overall status
      const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
      const hasWarnings = Object.values(health.checks).some(check => check.status === 'warning');
      
      health.status = hasErrors ? 'error' : (hasWarnings ? 'warning' : 'ok');

    } catch (error) {
      health.status = 'error';
      health.error = error.message;
      health.checks.database = { status: 'error', message: error.message };
    }

    return health;
  }
}

module.exports = new RecoveryController();