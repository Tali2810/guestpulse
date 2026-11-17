
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
).replace(/\/$/, "");

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const PORT = process.env.PORT || 3000;

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    configured: Boolean(DIFY_API_KEY)
  });
});

app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!DIFY_API_KEY) {
      return res.status(500).json({
        error: "DIFY_API_KEY is missing in Render Environment."
      });
    }

    const guestFeedback = (req.body.guest_feedback || "").trim();

    if (!guestFeedback && !req.file) {
      return res.status(400).json({
        error: "Please paste reviews or upload a file."
      });
    }

    if (req.file) {
      return res.status(400).json({
        error: "File upload is not configured in this version. Please paste reviews."
      });
    }

    const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {
          guest_feedback: guestFeedback
        },
        response_mode: "blocking",
        user: "guestpulse-dashboard-user"
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.message || result.error || "Dify API error"
      });
    }

    if (result.data?.status !== "succeeded") {
      return res.status(502).json({
        error: result.data?.error || "Dify workflow failed"
      });
    }

    const outputs = result.data.outputs || {};

    let structured =
      outputs.structured_data ??
      outputs.structured_output ??
      null;

    if (typeof structured === "string") {
      try {
        structured = JSON.parse(structured);
      } catch {
        structured = null;
      }
    }

    let report = outputs.final_report ?? outputs.text ?? "";

    if (typeof report !== "string") {
      report = JSON.stringify(report, null, 2);
    }

    if (!structured && report) {
      try {
        structured = JSON.parse(report);
      } catch {
        structured = null;
      }
    }

    if (!structured || typeof structured !== "object") {
      return res.status(502).json({
        error: "Dify did not return structured data.",
        report,
        raw_outputs: outputs
      });
    }

    return res.json({
      success: true,
      report,
      data: structured,
      meta: {
        workflow_run_id: result.workflow_run_id || result.data.id,
        total_tokens: result.data.total_tokens || null
      }
    });

  } catch (error) {
    console.error("GuestPulse error:", error);

    return res.status(500).json({
      error: error.message || "Analysis failed."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GuestPulse running on port ${PORT}`);
});



app.listen(PORT, () => {
  console.log(`GuestPulse is running at http://localhost:${PORT}`);
});
