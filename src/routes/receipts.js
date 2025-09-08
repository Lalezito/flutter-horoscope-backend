const express = require("express");
const router = express.Router();
const receiptController = require("../controllers/receiptController");
const { endpointLimits } = require("../middleware/rateLimiter");

/**
 * 🏪 RECEIPT VALIDATION ROUTES
 * Critical endpoints for App Store in-app purchase validation
 */

// Validate individual receipt
router.post("/validate", endpointLimits.api, receiptController.validateReceipt);

// Check subscription status
router.post("/subscription/status", endpointLimits.api, receiptController.getSubscriptionStatus);

// Get user premium status
router.post("/user/status", endpointLimits.api, receiptController.getUserStatus);

// Refresh receipt data (for auto-renewable subscriptions)
router.post("/refresh", endpointLimits.api, receiptController.refreshReceipt);

// Test receipt validation configuration (admin only)
router.get("/test", receiptController.testConfiguration);

module.exports = router;