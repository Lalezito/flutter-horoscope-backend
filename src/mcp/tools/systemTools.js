const { z } = require("@modelcontextprotocol/sdk/server/mcp");

// Importar servicios existentes
const monitoringController = require("../../controllers/monitoringController");
const horoscopeGenerator = require("../../services/horoscopeGenerator");
const cronJobs = require("../../services/cronJobs");

// Registrar herramientas del sistema
async function registerSystemTools(server) {
  // Obtener estado del sistema
  server.tool(
    "getSystemStatus",
    "Get the current system status and health information",
    {},
    async () => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        const status = await monitoringController.getSystemStatus();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error getting system status:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get system status: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  // Obtener estadísticas de generación
  server.tool(
    "getGenerationStats",
    "Get statistics about horoscope generation",
    {},
    async () => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        const stats = await horoscopeGenerator.getGenerationStats();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error getting generation stats:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get generation stats: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  // Activar trabajo cron
  server.tool(
    "triggerCronJob",
    "Trigger a specific cron job manually",
    {
      jobName: z.enum(["dailyGeneration", "weeklyGeneration", "healthCheck", "cleanup"]).describe("Name of the cron job to trigger")
    },
    async ({ jobName }) => {
      try {
        // Registrar uso de herramienta en el sistema de monitoreo
        monitoringController.incrementMcpToolsCalled();
        
        let result;
        
        switch (jobName) {
          case "dailyGeneration":
            result = await cronJobs.scheduleDailyGeneration();
            break;
          case "weeklyGeneration":
            result = await cronJobs.scheduleWeeklyGeneration();
            break;
          case "healthCheck":
            result = await cronJobs.scheduleHealthCheck();
            break;
          case "cleanup":
            result = await cronJobs.scheduleCleanup();
            break;
          default:
            throw new Error(`Unknown job name: ${jobName}`);
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error triggering cron job ${jobName}:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to trigger cron job ${jobName}: ${error.message}`
            }
          ]
        };
      }
    }
  );
  
  return server;
}

module.exports = {
  registerSystemTools
};