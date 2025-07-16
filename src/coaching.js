const express = require("express");
const coachingController = require("../controllers/coachingController"); // ✅ Importamos la instancia directamente

const router = express.Router();

// ✅ Ya no usamos "new", porque coachingController ya es una instancia
router.get("/", coachingController.getDailyHoroscope);
router.post("/notify", coachingController.notifyHoroscope);

module.exports = router;
