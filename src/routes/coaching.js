const express = require("express");
const coachingController = require("../controllers/coachingController"); // ✅ Importamos instancia

const router = express.Router();

router.get("/", coachingController.getDailyHoroscope);
router.post("/notify", coachingController.notifyHoroscope);

module.exports = router;
