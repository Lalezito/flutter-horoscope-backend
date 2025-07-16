class CoachingController {
  async getDailyHoroscope(req, res) {
    const { sign, lang, date } = req.query;

    res.json({
      sign,
      lang,
      date,
      horoscope: "Este es tu horóscopo diario.",
    });
  }

  notifyHoroscope(req, res) {
    const data = req.body;
    console.log("📩 Recibido desde n8n:", data);
    res.status(200).send("Recibido");
  }
}

module.exports = new CoachingController(); // ✅ Instancia exportada
