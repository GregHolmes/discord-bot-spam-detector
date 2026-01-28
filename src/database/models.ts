import { db } from './index.js';
import { config } from '../config.js';
import type { Statement } from 'better-sqlite3';

export interface StoredMessage {
  id: string;
  userId: string;
  channelId: string;
  guildId: string;
  content: string;
  createdAt: number;
}

export interface ModerationLogEntry {
  messageId: string;
  userId: string;
  action: 'approved' | 'spam' | 'spam_kick';
  moderatorId: string;
}

// Prepared statements for better performance
let insertMessageStmt: Statement;
let getUserMessagesStmt: Statement;
let insertModerationLogStmt: Statement;
let deleteMessageStmt: Statement;

export function initModels(): void {
  insertMessageStmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, user_id, channel_id, guild_id, content, created_at)
    VALUES (@id, @userId, @channelId, @guildId, @content, @createdAt)
  `);

  getUserMessagesStmt = db.prepare(`
    SELECT id, user_id as userId, channel_id as channelId, guild_id as guildId, content, created_at as createdAt
    FROM messages
    WHERE user_id = ? AND guild_id = ? AND created_at > ?
    ORDER BY created_at DESC
  `);

  insertModerationLogStmt = db.prepare(`
    INSERT INTO moderation_log (message_id, user_id, action, moderator_id, created_at)
    VALUES (@messageId, @userId, @action, @moderatorId, @createdAt)
  `);

  deleteMessageStmt = db.prepare(`
    DELETE FROM messages WHERE id = ?
  `);
}

function ensureInitialized(): void {
  if (
    !insertMessageStmt ||
    !getUserMessagesStmt ||
    !insertModerationLogStmt ||
    !deleteMessageStmt
  ) {
    throw new Error(
      'Database models not initialized. Call initModels() first.'
    );
  }
}

export function saveMessage(message: StoredMessage): void {
  ensureInitialized();
  insertMessageStmt.run(message);
}

export function getUserRecentMessages(
  userId: string,
  guildId: string
): StoredMessage[] {
  ensureInitialized();
  const cutoff = Date.now() - config.historyDays * 24 * 60 * 60 * 1000;
  return getUserMessagesStmt.all(userId, guildId, cutoff) as StoredMessage[];
}

export function logModerationAction(entry: ModerationLogEntry): void {
  ensureInitialized();
  insertModerationLogStmt.run({
    ...entry,
    createdAt: Date.now(),
  });
}

export function deleteStoredMessage(messageId: string): void {
  ensureInitialized();
  deleteMessageStmt.run(messageId);
}
