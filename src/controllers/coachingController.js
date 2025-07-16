const pool = require("../db"); // Asegurate de tener este archivo

class CoachingController {
  async getDailyHoroscope(req, res) {
    const { sign, lang, date } = req.query;

    try {
      const result = await pool.query(
        `SELECT sign, language_code, date, content, rating, lucky_numbers, lucky_colors, advice, coaching_focus, ai_insight, content_type, generated_at
                 FROM daily_horoscopes
                 WHERE sign = $1 AND language_code = $2 AND generated_at::date = $3`,
        [sign, lang, date]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "No horoscope found" });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  notifyHoroscope(req, res) {
    const horoscopeData = req.body;
    console.log("Received horoscope data:", horoscopeData);
    res.status(200).send("Notification received");
  }
}

module.exports = new CoachingController();
