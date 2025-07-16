const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const coachingRoutes = require("./routes/coaching");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/coaching", coachingRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Servidor corriendo en Railway");
});
