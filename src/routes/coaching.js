const express = require("express");
const router = express.Router();
const coachingController = require("../controllers/coachingController");

// Traditional horoscope endpoints
router.get("/getDailyHoroscope", coachingController.getDailyHoroscope);
router.get("/getAllHoroscopes", coachingController.getAllHoroscopes);
router.post("/notify", coachingController.notifyHoroscope); // Legacy n8n webhook

// AI Coach endpoints - Main chat functionality
router.post("/chat",
  coachingController.getChatValidation(),
  coachingController.chatWithCoach
);

// Conversation history and user management
router.get("/conversations/:userId", coachingController.getConversationHistory);
router.put("/preferences/:userId", coachingController.updateUserPreferences);
router.post("/feedback/:conversationId", coachingController.submitConversationFeedback);

// AI Coach service monitoring and statistics
router.get("/coach/stats", coachingController.getCoachStats);

module.exports = router;
