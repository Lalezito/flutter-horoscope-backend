async getDailyHoroscopes(req, res) {
    const { sign, lang } = req.query;
  
    try {
      let query = `
        SELECT sign, language_code, date, content, rating, lucky_numbers,
               lucky_colors, advice, coaching_focus, ai_insight, content_type, generated_at
        FROM daily_horoscopes
        WHERE date = CURRENT_DATE
      `;
      const values = [];
  
      if (sign) {
        values.push(sign);
        query += ` AND sign ILIKE $${values.length}`;
      }
  
      if (lang) {
        values.push(lang);
        query += ` AND language_code = $${values.length}`;
      }
  
      query += ` ORDER BY language_code, sign;`;
  
      const result = await db.query(query, values);
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "No horoscopes found" });
      }
  
      // Si pidieron 1 signo, devolvemos objeto, si no, lista
      if (sign && lang && result.rows.length === 1) {
        return res.json(result.rows[0]);
      }
  
      return res.json(result.rows);
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }