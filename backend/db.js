const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Serialize tables creation
db.serialize(() => {
  // 1. Summoners profile cache table
  // Key: name_tag (lowercase) e.g., "xkai_uwu"
  db.run(`
    CREATE TABLE IF NOT EXISTS summoners (
      riot_id TEXT PRIMARY KEY,
      puuid TEXT,
      summoner_data TEXT,
      cached_at INTEGER
    )
  `);

  // 2. Matches scoreboard cache table
  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      match_id TEXT PRIMARY KEY,
      match_data TEXT
    )
  `);

  // 3. Summoner lightweight directory table for autocomplete
  db.run(`
    CREATE TABLE IF NOT EXISTS summoner_directory (
      riot_id TEXT PRIMARY KEY,
      game_name TEXT,
      tag_line TEXT,
      puuid TEXT,
      region TEXT
    )
  `);

  // Index on game_name for faster wildcard searching
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_directory_search ON summoner_directory (game_name COLLATE NOCASE)
  `);

  // 4. Cached individual player ranks for Elo average calculations
  db.run(`
    CREATE TABLE IF NOT EXISTS player_ranks (
      puuid TEXT PRIMARY KEY,
      solo_tier TEXT,
      solo_rank TEXT,
      cached_at INTEGER
    )
  `);
});

// Helper functions wrapped in Promises
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

module.exports = query;
