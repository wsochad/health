require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { pool, initDB } = require("./db");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve React build in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
}

// ── DAY LOGS ─────────────────────────────────────────────────────

// Get a day's exercise log
app.get("/api/day/:date", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM daily_logs WHERE date = $1",
      [req.params.date]
    );
    res.json(rows[0] || { date: req.params.date, exercises: {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Upsert a single exercise within a day (accumulates reps)
app.put("/api/day/:date/exercise/:exId", async (req, res) => {
  try {
    const { date, exId } = req.params;
    const { reps, done } = req.body;

    const existing = await pool.query(
      "SELECT exercises FROM daily_logs WHERE date = $1",
      [date]
    );
    const exercises = existing.rows[0]?.exercises || {};
    exercises[exId] = { reps, done, t: new Date().toISOString() };

    const { rows } = await pool.query(
      `INSERT INTO daily_logs (date, exercises)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE
         SET exercises = $2, updated_at = NOW()
       RETURNING *`,
      [date, JSON.stringify(exercises)]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a single exercise from a day
app.delete("/api/day/:date/exercise/:exId", async (req, res) => {
  try {
    const { date, exId } = req.params;
    const existing = await pool.query(
      "SELECT exercises FROM daily_logs WHERE date = $1",
      [date]
    );
    const exercises = existing.rows[0]?.exercises || {};
    delete exercises[exId];

    const { rows } = await pool.query(
      `INSERT INTO daily_logs (date, exercises)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE
         SET exercises = $2, updated_at = NOW()
       RETURNING *`,
      [date, JSON.stringify(exercises)]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all days that have exercise data (for streak calculation)
app.get("/api/days", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT date FROM daily_logs WHERE exercises != '{}' ORDER BY date ASC"
    );
    res.json(rows.map(r => r.date.toISOString().slice(0, 10)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── WEIGHT LOGS ──────────────────────────────────────────────────

app.get("/api/weights", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT date, weight FROM weight_logs ORDER BY date ASC"
    );
    res.json(rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      weight: parseFloat(r.weight)
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/weights", async (req, res) => {
  try {
    const { date, weight } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO weight_logs (date, weight)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE SET weight = $2, updated_at = NOW()
       RETURNING *`,
      [date, weight]
    );
    res.json({ date: rows[0].date.toISOString().slice(0, 10), weight: parseFloat(rows[0].weight) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/weights/:date", async (req, res) => {
  try {
    await pool.query("DELETE FROM weight_logs WHERE date = $1", [req.params.date]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── XP ───────────────────────────────────────────────────────────

app.get("/api/xp", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT total_xp FROM user_xp WHERE id = 1");
    res.json({ total_xp: rows[0]?.total_xp || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/xp", async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO user_xp (id, total_xp)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET total_xp = $1, updated_at = NOW()`,
      [req.body.total_xp]
    );
    res.json({ total_xp: req.body.total_xp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EXERCISE HISTORY (for charts) ────────────────────────────────

app.get("/api/history/:exId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT date, exercises->$1 AS data
       FROM daily_logs
       WHERE exercises ? $1
       ORDER BY date ASC
       LIMIT 60`,
      [req.params.exId]
    );
    res.json(rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      reps: r.data?.reps || 0
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SPA FALLBACK ──────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

// ── BOOT ─────────────────────────────────────────────────────────

initDB()
  .then(() => app.listen(PORT, () => console.log(`Beast Mode running on :${PORT}`)))
  .catch(err => { console.error("DB init failed:", err); process.exit(1); });
