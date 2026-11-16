# GuestPulse — Full app connected to Dify

This starter project provides:
- A browser dashboard with paste-text and file-upload modes.
- A small Express backend that keeps the Dify API key on the server.
- A call to Dify's file-upload endpoint for uploaded files, followed by `/workflows/run`.
- Live rendering of `structured_data` returned by the published GuestPulse workflow.

## 1. Requirements
- Node.js 18 or newer
- Your published Dify Workflow app
- A Dify app API key (keep it secret)

## 2. Configure
1. Extract the ZIP.
2. In this folder, copy `.env.example` to a new file named `.env`.
3. Open `.env` and replace `PASTE_YOUR_DIFY_APP_KEY_HERE` with your Dify app API key.
4. Do not share `.env`, upload it to chat, or commit it to GitHub.

## 3. Run locally
Open a terminal in this folder and run:

```bash
npm install
npm start
```

Then open http://localhost:3000

## 4. Dify workflow input names expected by this starter
This project expects the Dify User Input variables to be exactly:
- `guest_feedback` — paragraph/string
- `feedback_files` — File List

It expects the Output node to expose:
- `final_report` — string
- `structured_data` — object

For uploaded files, this starter sends one file per analysis, with the file object in `feedback_files`. The workflow should accept the uploaded file in its File List input.

## 5. Important security and deployment notes
- The API key is used only by `server.js`, never by browser JavaScript.
- For public hosting, deploy the Express server and static frontend together on a Node-capable host (for example Render, Railway, or another trusted Node host).
- Add `DIFY_API_KEY` as a secret/environment variable in the hosting provider's dashboard. Do not upload `.env`.
- Use HTTPS in production.
- This starter does not include user accounts, database storage, or persistent history.
- The file upload limit is 15 MB; adjust in `server.js` if needed and consistent with your Dify plan/configuration.

## 6. Troubleshooting
- `DIFY_API_KEY is not configured`: add the key to `.env` and restart the server.
- Dify says an input is missing: confirm the exact input variable names in Dify.
- `Invalid upload file`: confirm the File List input is enabled and that the same Dify app key is used for upload and workflow execution.
- `no structured_data object`: confirm the Output node exposes `structured_data` and the Variable Aggregator 2 is connected to it.
- If `final_report` contains JSON text rather than a narrative report, the dashboard still renders the structured data; you can later refine the LLM's text output instructions.

## API flow
- Text: `POST /api/analyze` with `guest_feedback`
- File: `POST /api/analyze` with one `file`
- Backend: Dify `/files/upload` (file mode) → `/workflows/run`
