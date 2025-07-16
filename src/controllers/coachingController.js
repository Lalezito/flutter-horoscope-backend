class CoachingController {
    async getDailyHoroscope(req, res) {
        const { sign, lang, date } = req.query;

        // Here you would typically query the database using the sign, lang, and date
        // For now, we'll just send a placeholder response
        res.json({
            sign,
            lang,
            date,
            horoscope: "This is your daily horoscope."
        });
    }

    notifyHoroscope(req, res) {
        const horoscopeData = req.body;
        console.log("Received horoscope data:", horoscopeData);
        res.status(200).send("Notification received");
    }
}

module.exports = new CoachingController();