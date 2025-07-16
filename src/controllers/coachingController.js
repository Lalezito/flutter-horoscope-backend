const db = require("../config/db"); // Asegurate de tener la conexión bien configurada

class CoachingController {
  async getDailyHoroscope(req, res) {
    const { sign, lang } = req.query;

    try {
      const query = `
        SELECT sign, language_code, date, content, rating, lucky_numbers,
               lucky_colors, advice, coaching_focus, ai_insight, content_type, generated_at
        FROM daily_horoscopes
        WHERE sign ILIKE $1 AND language_code = $2
        LIMIT 1;
      `;

      const result = await db.query(query, [sign, lang]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "No horoscope found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getAllHoroscopes(req, res) {
    try {
      const query = `
        SELECT sign, language_code, date, content, rating, lucky_numbers,
               lucky_colors, advice, coaching_focus, ai_insight, content_type, generated_at
        FROM daily_horoscopes
        WHERE date = CURRENT_DATE;
      `;

      const result = await db.query(query);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching all horoscopes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  notifyHoroscope(req, res) {
    const horoscopeData = req.body;
    console.log("Received horoscope data:", horoscopeData);
    res.status(200).send("Notification received");
  }
}

module.exports = new CoachingController();
