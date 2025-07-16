const express = require("express");
const coachingController = require("../controllers/coachingController"); // ✅ ya es instancia

const router = express.Router();

router.get("/coaching", coachingController.getDailyHoroscope);
router.post("/coaching/notify", coachingController.notifyHoroscope);

module.exports = router;
