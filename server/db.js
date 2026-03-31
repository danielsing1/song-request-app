const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const songs = require("./songs-data");

const DB_PATH = path.join(__dirname, "gig.db");

let db = null;

// ─── Save database to disk ──────────────────────────────
function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Auto-save every 30 seconds
setInterval(save, 30000);

// Save on process exit
process.on("exit", save);
process.on("SIGINT", () => { save(); process.exit(); });
process.on("SIGTERM", () => { save(); process.exit(); });

// ─── Initialize database ────────────────────────────────
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");

  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id    INTEGER NOT NULL REFERENCES songs(id),
      requester  TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title)");
  db.run("CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist)");

  // Seed songs if table is empty
  const [{ n }] = getAll("SELECT COUNT(*) AS n FROM songs");
  if (n === 0) {
    console.log(`Seeding ${songs.length} songs…`);
    const stmt = db.prepare("INSERT INTO songs (title, artist) VALUES (?, ?)");
    for (const s of songs) {
      stmt.run([s.title, s.artist]);
    }
    stmt.free();
    console.log("Done.");
    save();
  } else {
    console.log(`Database has ${n} songs.`);
  }

  return db;
}

// ─── Helper: run a SELECT and return array of objects ────
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// ─── Helper: run a SELECT and return first row or null ───
function getOne(sql, params = []) {
  const rows = getAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// ─── Helper: run INSERT/UPDATE/DELETE ────────────────────
function runSql(sql, params = []) {
  db.run(sql, params);
  save();
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid() AS id")[0]?.values[0]?.[0],
    changes: db.getRowsModified(),
  };
}

module.exports = { initDB, getAll, getOne, runSql, save };
