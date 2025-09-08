const express = require("express");
const router = express.Router();
const mcpController = require("../controllers/mcpController");
const { requireAdminKey } = require("../middleware/auth");

// Rutas para control del servidor MCP
// Todas estas rutas requieren autenticación de administrador

// Iniciar el servidor MCP
router.post("/start", requireAdminKey, mcpController.startMcpServer);

// Detener el servidor MCP
router.post("/stop", requireAdminKey, mcpController.stopMcpServer);

// Obtener el estado del servidor MCP
router.get("/status", requireAdminKey, mcpController.getMcpServerStatus);

// Obtener información de las herramientas registradas
router.get("/tools", requireAdminKey, mcpController.getMcpTools);

// Obtener información de los recursos registrados
router.get("/resources", requireAdminKey, mcpController.getMcpResources);

// Obtener información de los prompts registrados
router.get("/prompts", requireAdminKey, mcpController.getMcpPrompts);

module.exports = router;