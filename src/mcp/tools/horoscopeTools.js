const { z } = require("@modelcontextprotocol/sdk/server/mcp");
const monitoringController = require("../../controllers/monitoringController");

// Importar servicios existentes
const horoscopeGenerator = require("../../services/horoscopeGenerator");
const weeklyController = require("../../controllers/weeklyController");
const recoveryController = require("../../controllers/recoveryController");

// Definir signos zodiacales
const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

// Definir idiomas soportados
const SUPPORTED_LANGUAGES = ["es", "en", "de", "fr", "it", "pt"];

// Registrar herramientas de horóscopo
async function registerHoroscopeTools(server) {
  // Generar horóscopo diario
  server.tool(
    "generateDailyHoroscope",
    "Generate a daily horoscope for a specific zodiac sign",
    {
      sign: z.enum(ZODIAC_SIGNS).describe("Zodiac sign for the horoscope"),
      language: z.enum(SUPPORTED_LANGUAGES).describe("Language code for the horoscope"),
      date: z.string().optional().describe("Date for the horoscope (YYYY-MM-DD). Defaults to today.")
    },
    async ({ sign, language, date }) => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        const horoscopeDate = date || new Date().toISOString().split('T')[0];
        const result = await horoscopeGenerator.generateDailyHoroscope(sign, language, horoscopeDate);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error generating daily horoscope:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate daily horoscope: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  // Generar horóscopo semanal
  server.tool(
    "generateWeeklyHoroscope",
    "Generate a weekly horoscope for a specific zodiac sign",
    {
      sign: z.enum(ZODIAC_SIGNS).describe("Zodiac sign for the horoscope"),
      language: z.enum(SUPPORTED_LANGUAGES).describe("Language code for the horoscope"),
      weekStart: z.string().optional().describe("Start date of the week (YYYY-MM-DD). Defaults to current week.")
    },
    async ({ sign, language, weekStart }) => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        const startDate = weekStart || getMonday(new Date());
        const result = await horoscopeGenerator.generateWeeklyHoroscope(sign, language, startDate);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error generating weekly horoscope:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate weekly horoscope: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  // Obtener horóscopos faltantes
  server.tool(
    "getMissingHoroscopes",
    "Get a list of missing horoscopes for a specific date",
    {
      date: z.string().optional().describe("Date to check for missing horoscopes (YYYY-MM-DD). Defaults to today.")
    },
    async ({ date }) => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        const checkDate = date || new Date().toISOString().split('T')[0];
        const missing = await weeklyController.getMissingHoroscopesForDate(checkDate);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(missing, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error getting missing horoscopes:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get missing horoscopes: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  // Forzar generación de horóscopos faltantes
  server.tool(
    "forceGenerateMissing",
    "Force generation of missing horoscopes",
    {},
    async () => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        const result = await recoveryController.forceGenerateMissingWeeklyHoroscopes();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error forcing generation of missing horoscopes:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to force generate missing horoscopes: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  return server;
}

// Función auxiliar para obtener el lunes de la semana actual
function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando el día es domingo
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

module.exports = {
  registerHoroscopeTools
};