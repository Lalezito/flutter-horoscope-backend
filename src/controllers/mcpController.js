const { runMcpServer, initializeMcpServer } = require("../mcp/mcpServer");

// Variable para almacenar la instancia del servidor MCP
let mcpServerInstance = null;
let isMcpServerRunning = false;

// Iniciar el servidor MCP
async function startMcpServer(req, res) {
  try {
    // Verificar si el servidor ya está corriendo
    if (isMcpServerRunning) {
      return res.status(200).json({
        success: true,
        message: "MCP server is already running",
        running: true
      });
    }
    
    // Inicializar el servidor MCP
    mcpServerInstance = await initializeMcpServer();
    isMcpServerRunning = true;
    
    // Enviar respuesta inmediata
    res.status(200).json({
      success: true,
      message: "MCP server started successfully",
      running: true
    });
    
    // Nota: El servidor MCP se ejecuta en modo stdio, por lo que no bloquea la respuesta HTTP
    console.log("MCP server started and ready for connections");
  } catch (error) {
    console.error("Error starting MCP server:", error);
    res.status(500).json({
      success: false,
      message: `Failed to start MCP server: ${error.message}`,
      running: false
    });
  }
}

// Detener el servidor MCP
async function stopMcpServer(req, res) {
  try {
    // Verificar si el servidor está corriendo
    if (!isMcpServerRunning) {
      return res.status(200).json({
        success: true,
        message: "MCP server is not running",
        running: false
      });
    }
    
    // Detener el servidor (lógica de detención)
    // Nota: En modo stdio, el servidor se detiene cuando el proceso padre termina
    isMcpServerRunning = false;
    mcpServerInstance = null;
    
    res.status(200).json({
      success: true,
      message: "MCP server stopped successfully",
      running: false
    });
    
    console.log("MCP server stopped");
  } catch (error) {
    console.error("Error stopping MCP server:", error);
    res.status(500).json({
      success: false,
      message: `Failed to stop MCP server: ${error.message}`,
      running: true
    });
  }
}

// Obtener el estado del servidor MCP
async function getMcpServerStatus(req, res) {
  try {
    res.status(200).json({
      success: true,
      running: isMcpServerRunning,
      message: isMcpServerRunning ? "MCP server is running" : "MCP server is not running"
    });
  } catch (error) {
    console.error("Error getting MCP server status:", error);
    res.status(500).json({
      success: false,
      message: `Failed to get MCP server status: ${error.message}`,
      running: false
    });
  }
}

// Obtener información de las herramientas registradas
async function getMcpTools(req, res) {
  try {
    // Esta función devolvería la lista de herramientas disponibles
    // En una implementación completa, esto se conectaría al servidor MCP
    const tools = [
      "generateDailyHoroscope",
      "generateWeeklyHoroscope",
      "getMissingHoroscopes",
      "forceGenerateMissing",
      "getSystemStatus",
      "getGenerationStats",
      "triggerCronJob"
    ];
    
    res.status(200).json({
      success: true,
      tools: tools,
      count: tools.length
    });
  } catch (error) {
    console.error("Error getting MCP tools:", error);
    res.status(500).json({
      success: false,
      message: `Failed to get MCP tools: ${error.message}`,
      tools: []
    });
  }
}

// Obtener información de los recursos registrados
async function getMcpResources(req, res) {
  try {
    // Esta función devolvería la lista de recursos disponibles
    const resources = [
      "zodiac://signs/{sign}",
      "zodiac://compatibility/{sign1}/{sign2}",
      "zodiac://elements/{element}",
      "horoscope://daily/{sign}/{language}/{date}",
      "horoscope://weekly/{sign}/{language}/{weekStart}",
      "horoscope://coverage/daily/{date}",
      "horoscope://coverage/weekly/{weekStart}",
      "system://status",
      "system://analytics",
      "system://health"
    ];
    
    res.status(200).json({
      success: true,
      resources: resources,
      count: resources.length
    });
  } catch (error) {
    console.error("Error getting MCP resources:", error);
    res.status(500).json({
      success: false,
      message: `Failed to get MCP resources: ${error.message}`,
      resources: []
    });
  }
}

// Obtener información de los prompts registrados
async function getMcpPrompts(req, res) {
  try {
    // Esta función devolvería la lista de prompts disponibles
    const prompts = [
      "generate-daily-horoscopes",
      "generate-weekly-horoscopes",
      "check-missing-horoscopes",
      "system-health-check"
    ];
    
    res.status(200).json({
      success: true,
      prompts: prompts,
      count: prompts.length
    });
  } catch (error) {
    console.error("Error getting MCP prompts:", error);
    res.status(500).json({
      success: false,
      message: `Failed to get MCP prompts: ${error.message}`,
      prompts: []
    });
  }
}

module.exports = {
  startMcpServer,
  stopMcpServer,
  getMcpServerStatus,
  getMcpTools,
  getMcpResources,
  getMcpPrompts
};