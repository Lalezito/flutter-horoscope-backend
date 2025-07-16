const express = require("express");
const CoachingController = require("../controllers/coachingController");

const router = express.Router();
const coachingController = new CoachingController(); // ✅ ahora sí

router.get(
  "/coaching",
  coachingController.getDailyHoroscope.bind(coachingController)
);
router.post(
  "/coaching/notify",
  coachingController.notifyHoroscope.bind(coachingController)
);

module.exports = router;
