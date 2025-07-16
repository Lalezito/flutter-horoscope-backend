const express = require("express");
const router = express.Router();
const coachingController = require("../controllers/coachingController");

router.get("/getDailyHoroscope", coachingController.getDailyHoroscope);
router.get("/getAllHoroscopes", coachingController.getAllHoroscopes);
router.post("/notify", coachingController.notifyHoroscope); // 👈 ESTA ES LA RUTA QUE FALTA

module.exports = router;
