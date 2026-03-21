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
  thumbnail_path: string | null;
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

  // v2: add thumbnail_path column if missing
  const columns = (db.pragma('table_info(events)') as { name: string }[]).map(c => c.name);
  if (!columns.includes('thumbnail_path')) {
    db.exec(`ALTER TABLE events ADD COLUMN thumbnail_path TEXT`);
  }
}

export function upsertDevice(device: DbDevice): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO devices (id, name, kind)
    VALUES (@id, @name, @kind)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind
  `).run(device);
}

export function upsertEvent(event: Omit<DbEvent, 'downloaded' | 'file_path' | 'downloaded_at' | 'thumbnail_path'>): void {
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

export function markThumbnailed(id: string, thumbnailPath: string): void {
  getDb().prepare(`UPDATE events SET thumbnail_path = @thumbnailPath WHERE id = @id`)
    .run({ id, thumbnailPath });
}

export function getEventsWithoutThumbnails(): DbEvent[] {
  return getDb()
    .prepare(`SELECT * FROM events WHERE downloaded = 1 AND file_path IS NOT NULL AND thumbnail_path IS NULL ORDER BY created_at DESC`)
    .all() as DbEvent[];
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

export interface EventsQuery {
  device_id?: string;
  kind?: string;
  downloaded?: number;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
}

export function queryEvents(q: EventsQuery): { events: DbEvent[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};

  if (q.device_id) { conditions.push('device_id = @device_id'); params.device_id = q.device_id; }
  if (q.kind)      { conditions.push('kind = @kind');           params.kind = q.kind; }
  if (q.downloaded !== undefined) { conditions.push('downloaded = @downloaded'); params.downloaded = q.downloaded; }
  if (q.dateFrom)  { conditions.push('created_at >= @dateFrom'); params.dateFrom = q.dateFrom; }
  if (q.dateTo)    { conditions.push('created_at <= @dateTo');   params.dateTo = q.dateTo; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = q.limit ?? 50;
  const offset = q.offset ?? 0;

  const total = (db.prepare(`SELECT COUNT(*) as n FROM events ${where}`).get(params) as { n: number }).n;
  const events = db.prepare(`SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as DbEvent[];

  return { events, total };
}

export function getEventById(id: string): DbEvent | null {
  return (getDb().prepare(`SELECT * FROM events WHERE id = ?`).get(id) as DbEvent | undefined) ?? null;
}
