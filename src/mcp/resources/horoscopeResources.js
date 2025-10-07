const { z } = require("@modelcontextprotocol/sdk/server/mcp");
const pool = require("../../config/database");
const monitoringController = require("../../controllers/monitoringController");

// Definir signos zodiacales
const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

// Definir idiomas soportados
const SUPPORTED_LANGUAGES = ["es", "en", "de", "fr", "it", "pt"];

// Registrar recursos de horóscopos
async function registerHoroscopeResources(server) {
  // Recurso para horóscopo diario específico
  server.resource(
    "horoscope://daily/{sign}/{language}/{date}",
    "Daily Horoscope",
    "A specific daily horoscope for a zodiac sign and language",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const parts = uri.split('/');
        const sign = parts[parts.length - 3];
        const language = parts[parts.length - 2];
        const date = parts[parts.length - 1];
        
        if (!ZODIAC_SIGNS.includes(sign)) {
          throw new Error(`Invalid zodiac sign: ${sign}`);
        }
        
        if (!SUPPORTED_LANGUAGES.includes(language)) {
          throw new Error(`Unsupported language: ${language}`);
        }
        
        // Validar formato de fecha (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
        }
        
        // Consultar la base de datos para obtener el horóscopo
        const query = `SELECT * FROM daily_horoscopes WHERE sign = $1 AND language_code = $2 AND date = $3`;
        const result = await pool.query(query, [sign, language, date]);
        
        if (result.rows.length === 0) {
          throw new Error(`No daily horoscope found for ${sign} in ${language} on ${date}`);
        }
        
        const horoscope = result.rows[0];
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(horoscope, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading daily horoscope resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para horóscopo semanal específico
  server.resource(
    "horoscope://weekly/{sign}/{language}/{weekStart}",
    "Weekly Horoscope",
    "A specific weekly horoscope for a zodiac sign and language",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const parts = uri.split('/');
        const sign = parts[parts.length - 3];
        const language = parts[parts.length - 2];
        const weekStart = parts[parts.length - 1];
        
        if (!ZODIAC_SIGNS.includes(sign)) {
          throw new Error(`Invalid zodiac sign: ${sign}`);
        }
        
        if (!SUPPORTED_LANGUAGES.includes(language)) {
          throw new Error(`Unsupported language: ${language}`);
        }
        
        // Validar formato de fecha (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
          throw new Error(`Invalid date format: ${weekStart}. Expected YYYY-MM-DD`);
        }
        
        // Consultar la base de datos para obtener el horóscopo
        const query = `SELECT * FROM weekly_horoscopes WHERE sign = $1 AND language_code = $2 AND week_start = $3`;
        const result = await pool.query(query, [sign, language, weekStart]);
        
        if (result.rows.length === 0) {
          throw new Error(`No weekly horoscope found for ${sign} in ${language} starting on ${weekStart}`);
        }
        
        const horoscope = result.rows[0];
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(horoscope, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading weekly horoscope resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para cobertura de generación diaria
  server.resource(
    "horoscope://coverage/daily/{date}",
    "Daily Horoscope Coverage",
    "Coverage information for daily horoscopes on a specific date",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const date = uri.split('/').pop();
        
        // Validar formato de fecha (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
        }
        
        // Consultar la base de datos para obtener la cobertura
        const query = `
          SELECT 
            COUNT(*) as generated_count,
            $1 as target_date,
            12 * 6 as total_expected
          FROM daily_horoscopes 
          WHERE date = $1
        `;
        
        const result = await pool.query(query, [date]);
        const coverage = result.rows[0];
        
        // Calcular porcentaje de cobertura
        coverage.coverage_percentage = (coverage.generated_count / coverage.total_expected) * 100;
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(coverage, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading daily coverage resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para cobertura de generación semanal
  server.resource(
    "horoscope://coverage/weekly/{weekStart}",
    "Weekly Horoscope Coverage",
    "Coverage information for weekly horoscopes for a specific week",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const weekStart = uri.split('/').pop();
        
        // Validar formato de fecha (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
          throw new Error(`Invalid date format: ${weekStart}. Expected YYYY-MM-DD`);
        }
        
        // Consultar la base de datos para obtener la cobertura
        const query = `
          SELECT 
            COUNT(*) as generated_count,
            $1 as week_start,
            12 * 6 as total_expected
          FROM weekly_horoscopes 
          WHERE week_start = $1
        `;
        
        const result = await pool.query(query, [weekStart]);
        const coverage = result.rows[0];
        
        // Calcular porcentaje de cobertura
        coverage.coverage_percentage = (coverage.generated_count / coverage.total_expected) * 100;
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(coverage, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading weekly coverage resource:`, error);
        throw error;
      }
    }
  );
  
  return server;
}

module.exports = {
  registerHoroscopeResources
};