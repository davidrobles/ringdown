import Database from 'better-sqlite3';
import { DB_FILE } from './config.js';

export interface DbEvent {
  id: string;
  device_id: string;
  device_name: string;
  kind: string;
  created_at: number;
  duration: number | null;
  file_size: number | null;
  downloaded: number;
  file_deleted: number;
  file_path: string | null;
  downloaded_at: number | null;
  thumbnail_path: string | null;
  favorited: number;
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
  // v3: add favorited column if missing
  if (!columns.includes('favorited')) {
    db.exec(`ALTER TABLE events ADD COLUMN favorited INTEGER NOT NULL DEFAULT 0`);
  }
  // v4: add file_size column if missing
  if (!columns.includes('file_size')) {
    db.exec(`ALTER TABLE events ADD COLUMN file_size INTEGER`);
  }
  // v5: add file_deleted column if missing
  if (!columns.includes('file_deleted')) {
    db.exec(`ALTER TABLE events ADD COLUMN file_deleted INTEGER NOT NULL DEFAULT 0`);
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

export function upsertEvent(event: Omit<DbEvent, 'downloaded' | 'file_path' | 'file_size' | 'file_deleted' | 'downloaded_at' | 'thumbnail_path' | 'favorited'>): void {
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

export function markDownloaded(id: string, filePath: string, fileSize?: number): void {
  getDb().prepare(`
    UPDATE events
    SET downloaded = 1, file_path = @filePath, downloaded_at = @now, file_size = @fileSize
    WHERE id = @id
  `).run({ id, filePath, now: Math.floor(Date.now() / 1000), fileSize: fileSize ?? null });
}

export function markThumbnailed(id: string, thumbnailPath: string): void {
  getDb().prepare(`UPDATE events SET thumbnail_path = @thumbnailPath WHERE id = @id`)
    .run({ id, thumbnailPath });
}

export function setDuration(id: string, duration: number): void {
  getDb().prepare(`UPDATE events SET duration = @duration WHERE id = @id`).run({ id, duration });
}

export function getEventsWithoutThumbnails(): DbEvent[] {
  return getDb()
    .prepare(`SELECT * FROM events WHERE downloaded = 1 AND file_path IS NOT NULL AND thumbnail_path IS NULL ORDER BY created_at DESC`)
    .all() as DbEvent[];
}

export function getEventsWithoutDuration(): DbEvent[] {
  return getDb()
    .prepare(`SELECT * FROM events WHERE downloaded = 1 AND file_path IS NOT NULL AND duration IS NULL ORDER BY created_at DESC`)
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

export type TimeOfDay = 'night' | 'morning' | 'afternoon' | 'evening';

export interface EventsQuery {
  device_ids?: string[];
  kind?: string;
  downloaded?: number;
  favorited?: number;
  show_deleted?: boolean;
  time_of_day?: TimeOfDay;
  dateFrom?: number;
  dateTo?: number;
  sort_by?: 'created_at' | 'duration' | 'file_size';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export function queryEvents(q: EventsQuery): { events: DbEvent[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};

  if (q.device_ids?.length) {
    const placeholders = q.device_ids.map((_, i) => `@did${i}`).join(', ');
    conditions.push(`device_id IN (${placeholders})`);
    q.device_ids.forEach((id, i) => { params[`did${i}`] = id; });
  }
  if (q.kind)      { conditions.push('kind = @kind');           params.kind = q.kind; }
  if (q.downloaded !== undefined) { conditions.push('downloaded = @downloaded'); params.downloaded = q.downloaded; }
  if (q.favorited  !== undefined) { conditions.push('favorited = @favorited');   params.favorited  = q.favorited;  }
  if (!q.show_deleted) { conditions.push('file_deleted = 0'); }
  if (q.time_of_day) {
    const hour = `CAST(strftime('%H', created_at, 'unixepoch', 'localtime') AS INTEGER)`;
    if (q.time_of_day === 'night')     conditions.push(`(${hour} >= 22 OR ${hour} < 7)`);
    if (q.time_of_day === 'morning')   conditions.push(`(${hour} >= 7  AND ${hour} < 12)`);
    if (q.time_of_day === 'afternoon') conditions.push(`(${hour} >= 12 AND ${hour} < 18)`);
    if (q.time_of_day === 'evening')   conditions.push(`(${hour} >= 18 AND ${hour} < 22)`);
  }
  if (q.dateFrom)  { conditions.push('created_at >= @dateFrom'); params.dateFrom = q.dateFrom; }
  if (q.dateTo)    { conditions.push('created_at <= @dateTo');   params.dateTo = q.dateTo; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = q.limit ?? 50;
  const offset = q.offset ?? 0;
  const validSortCols = new Set(['created_at', 'duration', 'file_size']);
  const sortCol = validSortCols.has(q.sort_by ?? '') ? q.sort_by : 'created_at';
  const sortDir = q.sort_dir === 'asc' ? 'ASC' : 'DESC';

  const total = (db.prepare(`SELECT COUNT(*) as n FROM events ${where}`).get(params) as { n: number }).n;
  const events = db.prepare(`SELECT * FROM events ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as DbEvent[];

  return { events, total };
}

export function getEventById(id: string): DbEvent | null {
  return (getDb().prepare(`SELECT * FROM events WHERE id = ?`).get(id) as DbEvent | undefined) ?? null;
}

export function getDownloadedFilePaths(): { device_name: string; file_path: string }[] {
  return getDb()
    .prepare(`SELECT device_name, file_path FROM events WHERE downloaded = 1 AND file_path IS NOT NULL`)
    .all() as { device_name: string; file_path: string }[];
}

export interface CameraStorageRow {
  device_name: string;
  total: number;
  downloaded: number;
  deleted: number;
  pending: number;
}

export function getCameraStorageStats(): CameraStorageRow[] {
  return getDb().prepare(`
    SELECT
      device_name,
      COUNT(*)                                              AS total,
      SUM(CASE WHEN downloaded = 1 AND file_deleted = 0 THEN 1 ELSE 0 END) AS downloaded,
      SUM(CASE WHEN file_deleted = 1 THEN 1 ELSE 0 END)                   AS deleted,
      SUM(CASE WHEN downloaded = 0 THEN 1 ELSE 0 END)                     AS pending
    FROM events
    GROUP BY device_name
    ORDER BY device_name
  `).all() as CameraStorageRow[];
}

export function getEventsWithoutFileSize(): { id: string; file_path: string }[] {
  return getDb()
    .prepare(`SELECT id, file_path FROM events WHERE downloaded = 1 AND file_path IS NOT NULL AND file_size IS NULL`)
    .all() as { id: string; file_path: string }[];
}

export function setFileSize(id: string, fileSize: number): void {
  getDb().prepare(`UPDATE events SET file_size = @fileSize WHERE id = @id`).run({ id, fileSize });
}

export function deleteLocalFile(id: string): void {
  getDb().prepare(`UPDATE events SET file_deleted = 1 WHERE id = ?`).run(id);
}

export function toggleFavorite(id: string): { favorited: number } {
  const db = getDb();
  db.prepare(`UPDATE events SET favorited = CASE WHEN favorited = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id);
  const row = db.prepare(`SELECT favorited FROM events WHERE id = ?`).get(id) as { favorited: number };
  return row;
}
