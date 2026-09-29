import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from './database.js';

export interface User {
  id: string;
  displayName: string;
  avatar: string;
  pushToken: string | null;
  createdAt: number;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Lightweight guest accounts: the device stores an opaque bearer token; only its
 * hash is persisted. No passwords are ever handled by the app.
 */
export class UserRepository {
  constructor(private readonly db: Db) {}

  createGuest(displayName: string, avatar: string): { user: User; token: string } {
    const token = randomBytes(32).toString('hex');
    const user: User = { id: `u-${randomUUID()}`, displayName, avatar, pushToken: null, createdAt: Date.now() };
    this.db.prepare('INSERT INTO users (id, display_name, avatar, token_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, displayName, avatar, hash(token), user.createdAt);
    return { user, token };
  }

  byToken(token: string | undefined | null): User | null {
    if (!token || token.length < 32) return null;
    const row = this.db.prepare('SELECT * FROM users WHERE token_hash = ?').get(hash(token)) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  byId(id: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  update(id: string, patch: { displayName?: string; avatar?: string; pushToken?: string | null }): User | null {
    const current = this.byId(id);
    if (!current) return null;
    this.db
      .prepare('UPDATE users SET display_name = ?, avatar = ?, push_token = ? WHERE id = ?')
      .run(patch.displayName ?? current.displayName, patch.avatar ?? current.avatar, patch.pushToken === undefined ? current.pushToken : patch.pushToken, id);
    return this.byId(id);
  }

  pushTokens(userIds: string[]): string[] {
    if (!userIds.length) return [];
    const rows = this.db.prepare(`SELECT push_token FROM users WHERE push_token IS NOT NULL AND id IN (${userIds.map(() => '?').join(',')})`).all(...userIds) as { push_token: string }[];
    return rows.map((r) => r.push_token);
  }

  private map(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      displayName: row.display_name as string,
      avatar: row.avatar as string,
      pushToken: (row.push_token as string) ?? null,
      createdAt: Number(row.created_at),
    };
  }
}
