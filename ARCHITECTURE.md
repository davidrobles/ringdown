# ringdown — Architecture

## Overview

ringdown is a local-first CLI tool + web UI for archiving Ring camera videos.
It authenticates with Ring's API, syncs event metadata to a local SQLite database,
downloads MP4 files to disk, generates thumbnails via ffmpeg, and serves a browser
UI to browse and play everything locally.

No cloud dependency after auth. All data stays on your machine.

---

## Directory Structure

```
ringdown/
├── src/                   # CLI + server (TypeScript, compiled to dist/)
│   ├── cli.ts             # Entry point — all ringdown commands (auth, sync, pull, serve, etc.)
│   ├── auth.ts            # Ring OAuth flow, 2FA, token persistence (~/.ringdown/token.json)
│   ├── config.ts          # Loads/saves ~/.ringdown/config.json (outputDir, etc.)
│   ├── db.ts              # SQLite via better-sqlite3. Schema, migrations, all queries
│   ├── sync.ts            # Calls Ring API, upserts events into DB (idempotent)
│   ├── downloader.ts      # Downloads MP4s, marks downloaded in DB, triggers thumbnail
│   ├── thumbnails.ts      # ffmpeg wrapper — extracts frame at 1s, saves to ~/.ringdown/thumbnails/
│   └── server/
│       └── index.ts       # Fastify server — REST API + video streaming + static file serving
├── web/                   # React + Vite frontend (built to web/dist/, served by Fastify)
│   └── src/
│       ├── App.tsx        # Root — state, filtering, pagination, event selection
│       ├── api.ts         # Typed fetch wrappers for all API endpoints
│       ├── types.ts       # Shared TypeScript types (Event, Device, Stats)
│       └── components/
│           ├── Filters.tsx      # Sidebar — camera multiselect, event type, status, date range, favorites
│           ├── StatusBar.tsx    # Top bar — event counts (shown / downloaded / pending / total)
│           ├── EventCard.tsx    # Video card — thumbnail, metadata, heart button
│           └── VideoPlayer.tsx  # Modal — video player, heart button, prev/next navigation
├── docs/
│   └── screenshot.png     # Web UI screenshot used in README
└── dist/                  # Compiled CLI output (gitignored)
```

---

## Data Flow

```
Ring API
   │
   ▼
ringdown sync          → events table (id, device_id, kind, created_at, downloaded=0)
   │
   ▼
ringdown download      → MP4 files on disk → downloaded=1, file_path set
   │                   → ffmpeg → thumbnail JPEG → thumbnail_path set
   ▼
ringdown serve         → Fastify reads SQLite, streams videos, serves web UI
   │
   ▼
Browser (React)        → filters, plays, favorites
```

`ringdown pull` = sync + download in one command.

---

## Database

File: `~/.ringdown/ringdown.db`
Library: `better-sqlite3` (synchronous, no async needed)

### Schema (current: v3)

```sql
CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  device_id     TEXT,
  device_name   TEXT,
  kind          TEXT,           -- 'motion' | 'ding' | 'on_demand'
  created_at    INTEGER,        -- Unix timestamp (ms)
  duration      INTEGER,
  downloaded    INTEGER DEFAULT 0,
  file_path     TEXT,
  thumbnail_path TEXT,
  favorited     INTEGER DEFAULT 0
);

CREATE TABLE devices (
  id    TEXT PRIMARY KEY,
  name  TEXT
);
```

Migrations run automatically on startup via `runMigrations()` in `db.ts`. Each version is additive (ALTER TABLE), never destructive.

---

## CLI Commands

| Command | What it does |
|---------|-------------|
| `ringdown auth` | OAuth + 2FA, saves token to `~/.ringdown/token.json` |
| `ringdown sync [--days N]` | Fetches events from Ring API, upserts into DB |
| `ringdown download [--concurrency N]` | Downloads pending MP4s + generates thumbnails |
| `ringdown pull [--days N]` | sync + download in one step |
| `ringdown thumbnails` | Generate missing thumbnails for already-downloaded videos |
| `ringdown status` | Shows total / downloaded / pending counts |
| `ringdown serve [--port N]` | Starts web UI at localhost:3000 |

---

## Server API (Fastify)

Base URL: `http://localhost:3000`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/status` | Total/downloaded/pending counts |
| GET | `/api/devices` | All cameras |
| GET | `/api/events` | Paginated events (filters: device_id, kind, downloaded, date_from, date_to, favorited) |
| GET | `/api/events/:id` | Single event |
| POST | `/api/events/:id/favorite` | Toggle favorited |
| GET | `/api/video/:id` | Stream MP4 (supports HTTP Range requests) |
| GET | `/api/thumbnail/:id` | Serve thumbnail JPEG |

---

## Key Files & Config

| Path | Purpose |
|------|---------|
| `~/.ringdown/token.json` | Ring OAuth refresh token |
| `~/.ringdown/config.json` | outputDir (default: ~/Videos/Ring) |
| `~/.ringdown/ringdown.db` | SQLite database |
| `~/.ringdown/thumbnails/` | JPEG thumbnails (named by event ID) |
| `~/Videos/Ring/` | Downloaded MP4s (default, configurable) |

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Ring API | `ring-client-api` v12 |
| CLI framework | `commander` |
| DB | `better-sqlite3` |
| Server | `fastify` + `@fastify/static` + `@fastify/cors` |
| Frontend | React 18 + Vite + Tailwind CSS |
| Thumbnails | `ffmpeg` (system binary, must be installed) |
| Language | TypeScript throughout |
| Node | v22 (via nvm) |

---

## Idempotency

- **Sync** — uses `INSERT OR IGNORE` on event ID. Safe to run repeatedly.
- **Download** — skips events where `downloaded = 1`. Re-running is a no-op.
- **Thumbnails** — skips events where `thumbnail_path IS NOT NULL`.

---

## Known Limitations / Future Ideas

- Thumbnails only generated for newly downloaded videos (or via `ringdown thumbnails` backfill)
- Ring URL expiry: video download URLs expire; must download promptly after sync
- No push/real-time updates — pull-based only
- `ring-client-api` declares Node ^18||^20 but works fine on Node 22
- Could add: scheduled auto-pull via cron, export favorites, video search by date
