# ringdown — Claude Instructions

## Commits
- **Never commit automatically.** Always ask the user if they want to commit after making changes. Wait for explicit confirmation before running any `git commit` command.
- **Always push after committing.** Every commit should be followed by `git push`.
- Never add Claude as co-author in commits.
- Commit related changes separately — don't bundle unrelated fixes into one commit.

## Build
- Always run `npm run build` before committing.
- Node 22 via nvm. `.nvmrc` is pinned — don't change it.
- ffmpeg must be installed on the system for thumbnail generation.

## Database
- `better-sqlite3` is synchronous — no async/await needed for DB calls.
- Migrations are additive only — never DROP columns or modify existing ones.
- Always bump the schema version constant in `db.ts` when adding a migration.
- DB file lives at `~/.ringdown/ringdown.db`.

## Architecture
- `ringdown pull` = sync + download + thumbnails (the full pipeline).
- Ring video URLs expire quickly — sync and download should happen close together.
- The Fastify server reads SQLite directly per request — no caching layer, no restart needed after DB changes.
- All API routes live in `src/server/index.ts`.

## Code Style
- TypeScript throughout — avoid `any` unless absolutely necessary.
- Fastify for the server — not Express.
- Keep DB queries in `db.ts`, not scattered across other files.

## Documentation
- When adding new CLI commands, API routes, DB columns, or web components, update `ARCHITECTURE.md` to reflect the change.
- At the end of a session, do a pass on `ARCHITECTURE.md` to catch anything missed.

## Git
- `.gitignore` always includes: `.DS_Store`, `.idea/`, `.claude/`, `dist/`
- Never commit `.env` files or token files.
