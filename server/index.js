require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { initDB, getAll, getOne, runSql } = require("./db");
const email = require("./email");

// ─── Bootstrap ───────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// ─── Rate limiter for requests (anti-spam) ───────────────
const requestLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,   // 2-minute window
  max: 3,                      // max 3 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a couple minutes." },
});

// ─── API Routes ──────────────────────────────────────────

// GET /api/songs — full song catalogue
app.get("/api/songs", (_req, res) => {
  const songs = getAll("SELECT id, title, artist FROM songs ORDER BY title COLLATE NOCASE");
  res.json(songs);
});

// POST /api/request — submit a song request
app.post("/api/request", requestLimiter, (req, res) => {
  const { songId, requester } = req.body;

  if (!songId || !requester || typeof requester !== "string" || !requester.trim()) {
    return res.status(400).json({ error: "songId and requester name are required." });
  }

  const name = requester.trim().slice(0, 40);
  const song = getOne("SELECT id, title, artist FROM songs WHERE id = ?", [songId]);
  if (!song) return res.status(404).json({ error: "Song not found." });

  // Duplicate guard
  const dup = getOne(
    `SELECT COUNT(*) AS n FROM requests
     WHERE song_id = ? AND requester = ? COLLATE NOCASE
       AND created_at > datetime('now', '-10 minutes')
       AND status IN ('queued','up_next','now_playing')`,
    [songId, name]
  );
  if (dup && dup.n > 0) {
    return res.status(409).json({ error: "You already requested this song recently." });
  }

  const info = runSql("INSERT INTO requests (song_id, requester) VALUES (?, ?)", [songId, name]);

  // Fire-and-forget email
  email.sendRequestNotification({
    title: song.title,
    artist: song.artist,
    requester: name,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ id: info.lastInsertRowid, message: "Request submitted!" });
});

// GET /api/queue — audience-visible queue (active only)
app.get("/api/queue", (_req, res) => {
  const items = getAll(`
    SELECT r.id, s.title, s.artist, r.requester, r.status, r.created_at
    FROM requests r JOIN songs s ON s.id = r.song_id
    WHERE r.status IN ('now_playing','up_next','queued')
    ORDER BY
      CASE r.status
        WHEN 'now_playing' THEN 0
        WHEN 'up_next'     THEN 1
        WHEN 'queued'      THEN 2
      END,
      r.created_at ASC
  `);
  res.json(items);
});

// ─── Admin Routes (simple password auth) ─────────────────
function adminAuth(req, res, next) {
  const pw = req.headers["x-admin-password"] || req.query.pw;
  if (pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/admin/queue — full queue including played
app.get("/api/admin/queue", adminAuth, (_req, res) => {
  const items = getAll(`
    SELECT r.id, s.title, s.artist, r.requester, r.status, r.created_at
    FROM requests r JOIN songs s ON s.id = r.song_id
    ORDER BY
      CASE r.status
        WHEN 'now_playing' THEN 0
        WHEN 'up_next'     THEN 1
        WHEN 'queued'      THEN 2
        WHEN 'played'      THEN 3
        ELSE 4
      END,
      r.created_at ASC
  `);
  res.json(items);
});

// PATCH /api/admin/request/:id — update status
app.patch("/api/admin/request/:id", adminAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ["queued", "up_next", "now_playing", "played"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(", ")}` });
  }

  // If setting now_playing, clear any existing now_playing first
  if (status === "now_playing") {
    runSql("UPDATE requests SET status = 'queued' WHERE status = 'now_playing'");
  }

  runSql("UPDATE requests SET status = ? WHERE id = ?", [status, req.params.id]);
  res.json({ ok: true });
});

// DELETE /api/admin/request/:id — remove from queue
app.delete("/api/admin/request/:id", adminAuth, (req, res) => {
  runSql("DELETE FROM requests WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ─── Serve SPA pages ─────────────────────────────────────
app.get("/queue", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client/queue.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client/admin.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// ─── Start (async because sql.js init is async) ─────────
async function start() {
  await initDB();
  email.init();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🎸 GigRequest running → http://localhost:${PORT}`);
    console.log(`   Queue page         → http://localhost:${PORT}/queue`);
    console.log(`   Admin panel        → http://localhost:${PORT}/admin\n`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
