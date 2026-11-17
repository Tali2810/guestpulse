
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const DIFY_BASE_URL = (
  process.env.DIFY_BASE_URL || "https://api.dify.ai/v1"
).replace(/\/+$/, "");

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const PORT = process.env.PORT || 3000;

function requireConfig(req, res, next) {
  if (!DIFY_API_KEY) {
    return res.status(500).json({
      error: "DIFY_API_KEY is not configured on the server. Add it to your .env file."
    });
  }

  next();
}


app.listen(PORT, () => {
  console.log(`GuestPulse is running at http://localhost:${PORT}`);
});
