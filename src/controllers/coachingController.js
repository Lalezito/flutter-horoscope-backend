const db = require("../config/db");

class CoachingController {
  // 🔮 Obtener todos los horóscopos del día
  async getAllHoroscopes(req, res) {
    const { lang, sign } = req.query;

    try {
      const result = await db.query(
        `
        SELECT sign, language_code, date, content, rating, lucky_numbers,
               lucky_colors, advice, coaching_focus, ai_insight, content_type, generated_at
        FROM daily_horoscopes
        WHERE date = CURRENT_DATE
        AND ($1::text IS NULL OR language_code = $1)
        AND ($2::text IS NULL OR sign ILIKE $2)
        `,
        [lang || null, sign || null]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching all horoscopes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new CoachingController();
