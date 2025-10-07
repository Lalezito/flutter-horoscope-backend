const monitoringController = require("../../controllers/monitoringController");

// Registrar prompts de flujo de trabajo
async function registerWorkflowPrompts(server) {
  // Prompt para generar horóscopos diarios
  server.prompt(
    "generate-daily-horoscopes",
    "Generate Daily Horoscopes",
    "Generate daily horoscopes for all zodiac signs in all supported languages",
    [
      {
        name: "date",
        type: "string",
        description: "Date for horoscope generation (YYYY-MM-DD). Defaults to today.",
        required: false
      },
      {
        name: "force",
        type: "boolean",
        description: "Force regeneration even if horoscopes already exist",
        required: false
      }
    ],
    async (args) => {
      const { date, force } = args || {};
      
      // Registrar uso de prompt en el sistema de monitoreo
      monitoringController.incrementMcpPromptsUsed();
      
      // Este prompt sería utilizado por el usuario para iniciar el flujo
      // La implementación real se haría a través de las herramientas
      return {
        description: `Generate daily horoscopes for ${date || 'today'}${force ? ' (forced)' : ''}`,
        steps: [
          "Check system status and health",
          "Verify database connectivity",
          "Generate horoscopes for all 12 zodiac signs",
          "Store results in database",
          "Verify generation coverage",
          "Log completion statistics"
        ]
      };
    }
  );
  
  // Prompt para generar horóscopos semanales
  server.prompt(
    "generate-weekly-horoscopes",
    "Generate Weekly Horoscopes",
    "Generate weekly horoscopes for all zodiac signs in all supported languages",
    [
      {
        name: "weekStart",
        type: "string",
        description: "Start date of the week (YYYY-MM-DD). Defaults to current week.",
        required: false
      },
      {
        name: "force",
        type: "boolean",
        description: "Force regeneration even if horoscopes already exist",
        required: false
      }
    ],
    async (args) => {
      const { weekStart, force } = args || {};
      
      // Registrar uso de prompt en el sistema de monitoreo
      monitoringController.incrementMcpPromptsUsed();
      
      return {
        description: `Generate weekly horoscopes for week starting ${weekStart || 'current week'}${force ? ' (forced)' : ''}`,
        steps: [
          "Check system status and health",
          "Verify database connectivity",
          "Generate horoscopes for all 12 zodiac signs",
          "Store results in database",
          "Verify generation coverage",
          "Log completion statistics"
        ]
      };
    }
  );
  
  // Prompt para verificar horóscopos faltantes
  server.prompt(
    "check-missing-horoscopes",
    "Check Missing Horoscopes",
    "Check for missing horoscopes and generate them if needed",
    [
      {
        name: "date",
        type: "string",
        description: "Date to check for missing horoscopes (YYYY-MM-DD). Defaults to today.",
        required: false
      },
      {
        name: "autoGenerate",
        type: "boolean",
        description: "Automatically generate missing horoscopes",
        required: false
      }
    ],
    async (args) => {
      const { date, autoGenerate } = args || {};
      
      // Registrar uso de prompt en el sistema de monitoreo
      monitoringController.incrementMcpPromptsUsed();
      
      return {
        description: `Check for missing horoscopes on ${date || 'today'}${autoGenerate ? ' and auto-generate if missing' : ''}`,
        steps: [
          "Check current horoscope coverage",
          "Identify missing combinations",
          autoGenerate ? "Generate missing horoscopes" : "Report missing horoscopes",
          "Update system status",
          "Log results"
        ]
      };
    }
  );
  
  // Prompt para verificación de salud del sistema
  server.prompt(
    "system-health-check",
    "System Health Check",
    "Perform a complete system health check and generate a report",
    [
      {
        name: "detailed",
        type: "boolean",
        description: "Include detailed metrics and analysis",
        required: false
      }
    ],
    async (args) => {
      const { detailed } = args || {};
      
      // Registrar uso de prompt en el sistema de monitoreo
      monitoringController.incrementMcpPromptsUsed();
      
      return {
        description: `Perform system health check${detailed ? ' with detailed analysis' : ''}`,
        steps: [
          "Check database connectivity and performance",
          "Verify API endpoints and services",
          "Test AI generation capabilities",
          "Validate cron jobs and scheduling",
          "Check resource usage and system load",
          "Generate health report"
        ]
      };
    }
  );
  
  return server;
}

module.exports = {
  registerWorkflowPrompts
};