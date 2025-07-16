const db = require("../config/db");

class CoachingController {
  async getDailyHoroscope(req, res) {
    const { sign, lang } = req.query;

    try {
      const query = `
        SELECT * FROM daily_horoscopes
        WHERE date = CURRENT_DATE
        AND sign ILIKE $1 AND language_code = $2
        LIMIT 1;
      `;
      const result = await db.query(query, [sign, lang]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "No horoscope found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("DB error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getAllHoroscopes(req, res) {
    const { sign, lang } = req.query;

    try {
      const query = `
        SELECT * FROM daily_horoscopes
        WHERE date = CURRENT_DATE
        AND ($1::text IS NULL OR language_code = $1)
        AND ($2::text IS NULL OR sign ILIKE $2)
        ORDER BY sign;
      `;
      const result = await db.query(query, [lang || null, sign || null]);
      res.json(result.rows);
    } catch (error) {
      console.error("DB error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new CoachingController();
