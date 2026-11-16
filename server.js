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

const DIFY_BASE_URL = (process.env.DIFY_BASE_URL || "https://api.dify.ai/v1").replace(/\/$/, "");
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const PORT = process.env.PORT || 3000;

function requireConfig(req, res, next) {
  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: "DIFY_API_KEY is not configured on the server. Add it to your .env file." });
  }
  next();
}

async function difyRequest(url, options) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    const message = data.message || data.error || `Dify returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

app.post("/api/analyze", requireConfig, upload.single("file"), async (req, res) => {
  try {
    const guestFeedback = (req.body.guest_feedback || "").trim();
    const file = req.file;
    if (!guestFeedback && !file) {
      return res.status(400).json({ error: "Paste guest reviews or upload a file." });
    }
    if (guestFeedback && file) {
      return res.status(400).json({ error: "Please use either pasted text or one uploaded file per analysis." });
    }

    const user = "guestpulse-dashboard-user";
    const inputs = {};

    if (file) {
      const form = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
      form.append("file", blob, file.originalname);
      form.append("user", user);

      const uploaded = await difyRequest(`${DIFY_BASE_URL}/files/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DIFY_API_KEY}` },
        body: form
      });

      // Dify File List inputs expect an array of file objects.
      inputs.feedback_files = [{
        type: "document",
        transfer_method: "local_file",
        upload_file_id: uploaded.id
      }];
    } else {
      inputs.guest_feedback = guestFeedback;
    }

    const run = await difyRequest(`${DIFY_BASE_URL}/workflows/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DIFY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs,
        response_mode: "blocking",
        user
      })
    });

    if (run.data && run.data.status && run.data.status !== "succeeded") {
      throw new Error(run.data.error || `Workflow status: ${run.data.status}`);
    }

    const outputs = (run.data && run.data.outputs) || run.outputs || {};
    let structured = outputs.structured_data ?? outputs.structured_output ?? null;
    if (typeof structured === "string") {
      try { structured = JSON.parse(structured); } catch {}
    }

    let report = outputs.final_report ?? outputs.text ?? "";
    if (typeof report !== "string") report = JSON.stringify(report, null, 2);

    if (!structured && report) {
      try { structured = JSON.parse(report); } catch {}
    }

    if (!structured || typeof structured !== "object") {
      return res.status(502).json({
        error: "Dify completed, but no structured_data object was returned. Check the Output node and Variable Aggregator 2.",
        report,
        raw_outputs: outputs
      });
    }

    res.json({
      success: true,
      report,
      data: structured,
      meta: {
        workflow_run_id: run.workflow_run_id || (run.data && run.data.id) || null,
        total_tokens: (run.data && run.data.total_tokens) || null
      }
    });
  } catch (error) {
    console.error("GuestPulse analysis error:", error);
    res.status(502).json({ error: error.message || "Could not complete the analysis." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, configured: Boolean(DIFY_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`GuestPulse is running at http://localhost:${PORT}`);
});
