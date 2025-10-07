const { Server } = require("@modelcontextprotocol/sdk/server");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server");
const monitoringController = require("../controllers/monitoringController");

// Importar herramientas
const { registerHoroscopeTools } = require("./tools/horoscopeTools");
const { registerSystemTools } = require("./tools/systemTools");

// Importar recursos
const { registerZodiacResources } = require("./resources/zodiacResources");
const { registerHoroscopeResources } = require("./resources/horoscopeResources");
const { registerSystemResources } = require("./resources/systemResources");

// Importar prompts
const { registerWorkflowPrompts } = require("./prompts/workflowPrompts");

// Crear instancia del servidor MCP
const server = new Server({
  name: "zodiac-horoscope",
  version: "1.0.0",
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  },
});

// Función para inicializar el servidor MCP
async function initializeMcpServer() {
  try {
    // Registrar herramientas
    await registerHoroscopeTools(server);
    await registerSystemTools(server);
    
    // Registrar recursos
    await registerZodiacResources(server);
    await registerHoroscopeResources(server);
    await registerSystemResources(server);
    
    // Registrar prompts
    await registerWorkflowPrompts(server);
    
    // Registrar estado del servidor en el sistema de monitoreo
    monitoringController.updateMcpServerStatus('initialized');
    
    console.log("Zodiac MCP Server initialized successfully");
    return server;
  } catch (error) {
    monitoringController.updateMcpServerStatus('error');
    console.error("Error initializing Zodiac MCP Server:", error);
    throw error;
  }
}

// Función principal para ejecutar el servidor
async function runMcpServer() {
  try {
    // Inicializar el servidor
    await initializeMcpServer();
    
    // Crear transporte stdio
    const transport = new StdioServerTransport();
    
    // Conectar el servidor al transporte
    await server.connect(transport);
    
    // Registrar que el servidor está corriendo en el sistema de monitoreo
    monitoringController.updateMcpServerStatus('running');
    
    console.error("Zodiac MCP Server running on stdio");
  } catch (error) {
    monitoringController.updateMcpServerStatus('error');
    console.error("Fatal error in Zodiac MCP Server:", error);
    process.exit(1);
  }
}

// Exportar funciones para uso externo
module.exports = {
  server,
  initializeMcpServer,
  runMcpServer
};

// Ejecutar el servidor si este archivo se ejecuta directamente
if (require.main === module) {
  runMcpServer();
}