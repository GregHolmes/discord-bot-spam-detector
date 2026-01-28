import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'moderation.db');

export const db: DatabaseType = new Database(dbPath);

export function initDatabase(): void {
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create messages table for history tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create moderation log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS moderation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create index for fast user history lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_user_time
    ON messages(user_id, created_at)
  `);

  // Create index for guild-based queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_guild
    ON messages(guild_id, created_at)
  `);

  console.log('Database initialized');
}

export function cleanOldMessages(daysToKeep: number): void {
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
  const stmt = db.prepare('DELETE FROM messages WHERE created_at < ?');
  const result = stmt.run(cutoff);
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} old messages`);
  }
}
