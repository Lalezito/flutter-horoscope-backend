const { z } = require("@modelcontextprotocol/sdk/server/mcp");
const os = require("os");
const monitoringController = require("../../controllers/monitoringController");
const horoscopeGenerator = require("../../services/horoscopeGenerator");

// Registrar recursos del sistema
async function registerSystemResources(server) {
  // Recurso para estado del sistema
  server.resource(
    "system://status",
    "System Status",
    "Current system status and health information",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const status = await monitoringController.getSystemStatus();
        
        // Agregar información del sistema
        status.system = {
          platform: os.platform(),
          arch: os.arch(),
          uptime: os.uptime(),
          loadavg: os.loadavg(),
          totalmem: os.totalmem(),
          freemem: os.freemem()
        };
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading system status resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para analytics
  server.resource(
    "system://analytics",
    "System Analytics",
    "Analytics and usage statistics for the horoscope system",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const analytics = await monitoringController.getAnalytics();
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(analytics, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading system analytics resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para salud del sistema
  server.resource(
    "system://health",
    "System Health",
    "Health metrics and performance indicators for the system",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const health = await monitoringController.getSystemHealth();
        
        // Agregar estadísticas de generación
        const stats = await horoscopeGenerator.getGenerationStats();
        health.generationStats = stats;
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(health, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading system health resource:`, error);
        throw error;
      }
    }
  );
  
  return server;
}

module.exports = {
  registerSystemResources
};