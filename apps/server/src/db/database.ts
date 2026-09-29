import { DatabaseSync } from 'node:sqlite';
import { CATALOG_COACHES, CATALOG_PLAYERS } from '@asta/core';
import { MIGRATIONS } from './schema.js';

export type Db = DatabaseSync;

/** Opens SQLite (built into Node ≥ 22.5, no native dependency), applies migrations and seeds the catalog. */
export function openDatabase(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set((db.prepare('SELECT id FROM _migrations').all() as { id: number }[]).map((r) => r.id));
  MIGRATIONS.forEach((sql, i) => {
    if (applied.has(i + 1)) return;
    transaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(i + 1, Date.now());
    });
  });
  seedCatalog(db);
  return db;
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Upserts the seed database (players & managers with league_id NULL). Idempotent. */
function seedCatalog(db: Db): void {
  transaction(db, () => {
    const player = db.prepare(`
      INSERT INTO players (id, league_id, name, nationality, position, prime_period, overall, era, rarity, base_value, source, data_json)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'catalog', ?)
      ON CONFLICT(id) WHERE league_id IS NULL DO UPDATE SET
        name = excluded.name, overall = excluded.overall, base_value = excluded.base_value, data_json = excluded.data_json`);
    for (const p of CATALOG_PLAYERS) {
      player.run(p.id, p.name, p.nationality, p.position, p.primePeriod, p.overall, p.era, p.rarity, p.baseAuctionValue, JSON.stringify(p));
    }
    const coach = db.prepare(`
      INSERT INTO managers (id, league_id, name, overall, tactic, source, data_json)
      VALUES (?, NULL, ?, ?, ?, 'catalog', ?)
      ON CONFLICT(id) WHERE league_id IS NULL DO UPDATE SET
        name = excluded.name, overall = excluded.overall, data_json = excluded.data_json`);
    for (const c of CATALOG_COACHES) coach.run(c.id, c.name, c.overall, c.preferredTactic, JSON.stringify(c));
  });
}
