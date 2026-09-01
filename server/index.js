require("dotenv").config();
const express = require("express");
const path = require("path");
const { handleCoachRequest } = require("./coachHandler");

const app = express();
app.use(express.json({ limit: "1mb" }));

// Basic rate limiting per IP (in-memory; fine for a single instance / low traffic).
// For real production scale behind multiple instances, swap for a shared store.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const hits = new Map();

app.use("/api/coach", (req, res, next) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests, slow down." });
  }
  next();
});

app.post("/api/coach", handleCoachRequest);

app.get("/healthz", (req, res) => res.status(200).send("ok"));

// Serve the built frontend (see frontend/README for the build step).
const distDir = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Leverage coach server listening on port ${PORT}`);
});
