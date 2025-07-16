const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const coachingRoutes = require("./routes/coaching");

dotenv.config();
const app = express();

app.use(cors()); // ✅ Permite peticiones cross-origin
app.use(express.json()); // ✅ Para parsear JSON del body

// ✅ Todas las rutas empiezan con /api/coaching
app.use("/api/coaching", coachingRoutes);

// ✅ Levanta el servidor
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Servidor corriendo en Railway");
});
