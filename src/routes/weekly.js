const express = require("express");
const router = express.Router();
const weeklyController = require("../controllers/weeklyController");

/**
 * @route GET /api/weekly/getWeeklyHoroscope
 * @description Get weekly horoscope for a specific sign and language
 * @query {string} sign - Zodiac sign (required)
 * @query {string} lang - Language code (optional, defaults to 'es')
 * @example /api/weekly/getWeeklyHoroscope?sign=Aries&lang=es
 */
router.get("/getWeeklyHoroscope", weeklyController.getWeeklyHoroscope);

/**
 * @route GET /api/weekly/getAllWeeklyHoroscopes
 * @description Get all weekly horoscopes for current week
 * @query {string} lang - Language filter (optional)
 * @example /api/weekly/getAllWeeklyHoroscopes?lang=es
 */
router.get("/getAllWeeklyHoroscopes", weeklyController.getAllWeeklyHoroscopes);

/**
 * @route GET /api/weekly/checkMissing
 * @description Check which weekly horoscopes are missing (admin endpoint)
 * @query {string} admin_key - Admin authentication key (required)
 */
router.get("/checkMissing", async (req, res) => {
  const { admin_key } = req.query;

  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const missing = await weeklyController.checkMissingWeeklyHoroscopes();

    res.json({
      missing_count: missing.length,
      expected_total: 72, // 12 signs × 6 languages
      missing_horoscopes: missing,
      coverage_percentage: Math.round(((72 - missing.length) / 72) * 100)
    });
  } catch (error) {
    console.error("Check missing error:", error);
    res.status(500).json({ error: "Failed to check missing horoscopes" });
  }
});

/**
 * @route POST /api/weekly/generate
 * @description Generate all weekly horoscopes using OpenAI (admin endpoint)
 * @query {string} admin_key - Admin authentication key (required)
 * @query {boolean} force - Force regeneration even if data exists (optional)
 */
router.post("/generate", weeklyController.generateWeeklyHoroscopes);

module.exports = router;