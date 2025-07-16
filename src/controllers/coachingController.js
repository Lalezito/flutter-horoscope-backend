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
    const horoscopeData = req.body;
    console.log("✅ Recibido desde n8n:", horoscopeData);
    res.status(200).send("Notificación recibida");
  }
}

// ❗ Exportamos la instancia directamente (NO la clase)
module.exports = new CoachingController();
