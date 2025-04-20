require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const fs = require("fs");
const { getOAuth2Client } = require("./oauth");

const app = express();
app.use(bodyParser.json());

const SHEET_ID = process.env.SPREADSHEET_ID;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH = "token.json";

// ---------- AUTHORIZE ----------
app.get("/authorize", (req, res) => {
  const oAuth2Client = getOAuth2Client();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// ---------- CALLBACK ----------
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  const oAuth2Client = getOAuth2Client();
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send("✅ Authorized! You can close this tab.");
  } catch (err) {
    console.error("Error during authorization:", err);
    res.send("Error during authorization.");
  }
});

// ---------- WEBHOOK ----------
app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  if (!Array.isArray(events)) return res.sendStatus(400);

  for (const event of events) {
    const userId = event.source.userId;
    const timestamp = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    const auth = getOAuth2Client();
    const token = JSON.parse(fs.readFileSync("token.json"));
    auth.setCredentials(token);

    const sheets = google.sheets({ version: "v4", auth });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A2:A",
    });

    const existing = getRes.data.values || [];
    const alreadyExists = existing.some(row => row[0] === userId);

    if (!alreadyExists) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Sheet1!A:C",
        valueInputOption: "RAW",
        requestBody: {
          values: [[userId, "LINE Bot", timestamp]],
        },
      });
      console.log(`✅ New userId saved: ${userId}`);
    } else {
      console.log(`⏩ Skipped (already exists): ${userId}`);
    }
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("✅ LINE Bot is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
