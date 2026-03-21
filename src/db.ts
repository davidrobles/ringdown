import Database from 'better-sqlite3';
import { DB_FILE } from './config.js';

export interface DbEvent {
  id: string;
  device_id: string;
  device_name: string;
  kind: string;
  created_at: number;
  duration: number | null;
  downloaded: number;
  file_path: string | null;
  downloaded_at: number | null;
}

export interface DbDevice {
  id: string;
  name: string;
  kind: string;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_FILE);
  _db.pragma('journal_mode = WAL');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id            TEXT PRIMARY KEY,
      device_id     TEXT NOT NULL,
      device_name   TEXT NOT NULL,
      kind          TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      duration      INTEGER,
      downloaded    INTEGER NOT NULL DEFAULT 0,
      file_path     TEXT,
      downloaded_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_events_downloaded ON events (downloaded);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at);
    CREATE INDEX IF NOT EXISTS idx_events_device_id  ON events (device_id);
  `);
}

export function upsertDevice(device: DbDevice): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO devices (id, name, kind)
    VALUES (@id, @name, @kind)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind
  `).run(device);
}

export function upsertEvent(event: Omit<DbEvent, 'downloaded' | 'file_path' | 'downloaded_at'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO events (id, device_id, device_name, kind, created_at, duration)
    VALUES (@id, @device_id, @device_name, @kind, @created_at, @duration)
    ON CONFLICT(id) DO NOTHING
  `).run(event);
}

export function getPendingEvents(): DbEvent[] {
  return getDb()
    .prepare(`SELECT * FROM events WHERE downloaded = 0 ORDER BY created_at ASC`)
    .all() as DbEvent[];
}

export function markDownloaded(id: string, filePath: string): void {
  getDb().prepare(`
    UPDATE events
    SET downloaded = 1, file_path = @filePath, downloaded_at = @now
    WHERE id = @id
  `).run({ id, filePath, now: Math.floor(Date.now() / 1000) });
}

export function getStats(): { total: number; downloaded: number; pending: number } {
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) as n FROM events`).get() as { n: number }).n;
  const downloaded = (db.prepare(`SELECT COUNT(*) as n FROM events WHERE downloaded = 1`).get() as { n: number }).n;
  return { total, downloaded, pending: total - downloaded };
}

export function getRecentEvents(limit = 20): DbEvent[] {
  return getDb()
    .prepare(`SELECT * FROM events ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as DbEvent[];
}

export function getDevices(): DbDevice[] {
  return getDb()
    .prepare(`SELECT * FROM devices ORDER BY name`)
    .all() as DbDevice[];
}
