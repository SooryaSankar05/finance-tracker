require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

console.log("GEMINI KEY:", process.env.GEMINI_API_KEY);
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://finance-tracker-f62de.web.app",
      "https://finance-tracker-f62de.firebaseapp.com",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "20mb" }));

connectDB();

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/sms", require("./routes/smsRoutes"));
app.use("/api/pdf", require("./routes/pdfRoutes"));

app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/", (req, res) => res.json({ message: "MoneyMind API running" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
