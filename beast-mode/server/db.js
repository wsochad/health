const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id         SERIAL PRIMARY KEY,
      date       DATE NOT NULL UNIQUE,
      exercises  JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id         SERIAL PRIMARY KEY,
      date       DATE NOT NULL UNIQUE,
      weight     DECIMAL(5,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      total_xp   INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    INSERT INTO user_xp (id, total_xp) VALUES (1, 0) ON CONFLICT DO NOTHING;
  `);
  console.log("✓ Database ready");
}

module.exports = { pool, initDB };
