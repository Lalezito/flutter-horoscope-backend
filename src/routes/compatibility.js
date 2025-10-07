const express = require("express");
const router = express.Router();
const compatibilityController = require("../controllers/compatibilityController");
const { endpointLimits } = require("../middleware/rateLimiter");

/**
 * 💕 COMPATIBILITY ROUTES
 * Zodiac sign compatibility analysis endpoints
 */

// Get compatibility between two signs
router.get("/calculate", endpointLimits.api, (req, res) => compatibilityController.getCompatibility(req, res));

// Get all compatibility combinations for a sign
router.get("/sign/:sign", endpointLimits.api, (req, res) => compatibilityController.getSignCompatibilities(req, res));

// Get comprehensive compatibility analysis
router.post("/analysis", endpointLimits.api, (req, res) => compatibilityController.getDetailedAnalysis(req, res));

// Get compatibility insights for relationships
router.post("/insights", endpointLimits.api, (req, res) => compatibilityController.getCompatibilityInsights(req, res));

// Get compatibility statistics (admin only)
router.get("/stats", (req, res) => compatibilityController.getCompatibilityStats(req, res));

module.exports = router;