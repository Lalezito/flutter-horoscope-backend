const express = require("express");
const router = express.Router();
const coachingController = require("../controllers/coachingController");

router.get("/api/coaching/daily", coachingController.getDailyHoroscopes);
router.post("/api/coaching/notify", coachingController.notifyHoroscope);

module.exports = router;
