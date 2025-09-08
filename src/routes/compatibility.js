const express = require("express");
const router = express.Router();
const compatibilityController = require("../controllers/compatibilityController");
const { endpointLimits } = require("../middleware/rateLimiter");

/**
 * 💕 COMPATIBILITY ROUTES
 * Zodiac sign compatibility analysis endpoints
 */

// Get compatibility between two signs
router.get("/calculate", endpointLimits.api, compatibilityController.getCompatibility);

// Get all compatibility combinations for a sign
router.get("/sign/:sign", endpointLimits.api, compatibilityController.getSignCompatibilities);

// Get comprehensive compatibility analysis
router.post("/analysis", endpointLimits.api, compatibilityController.getDetailedAnalysis);

// Get compatibility insights for relationships
router.post("/insights", endpointLimits.api, compatibilityController.getCompatibilityInsights);

// Get compatibility statistics (admin only)
router.get("/stats", compatibilityController.getCompatibilityStats);

module.exports = router;