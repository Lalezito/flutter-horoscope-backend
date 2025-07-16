const express = require("express");
const router = express.Router();
const coachingController = require("../controllers/coachingController");

// Devuelve 1 horóscopo según signo e idioma
router.get("/getDailyHoroscope", coachingController.getDailyHoroscope);

// Devuelve los 72 horóscopos del día actual
router.get("/getAllHoroscopes", coachingController.getAllHoroscopes);

// Recibe los datos desde n8n
router.post("/notifyHoroscope", coachingController.notifyHoroscope);

module.exports = router;
