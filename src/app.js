const express = require("express");
const cors = require("./middleware/cors");
const coachingRoutes = require("./routes/coaching");

const app = express();

app.use(express.json());
app.use(cors);

app.use("/api/coaching", coachingRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
