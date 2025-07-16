const express = require("express");
const router = express.Router();
const coachingController = require("../controllers/coachingController");

// Endpoint para todos los horóscopos
router.get("/getAllHoroscopes", coachingController.getAllHoroscopes);

// Ya deberías tener esto también
router.get("/getDailyHoroscope", coachingController.getDailyHoroscope);

module.exports = router;
