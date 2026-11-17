# PlayVerse — Full Project Source

> Play More. Explore More. PlayVerse.

Exported 2026-11-17T11:49:57.109Z from Admin → Code Files. This zip contains the REAL
source code of the PlayVerse gaming portal: 100 published
playable games in 12 categories. Every source file was read live
from the project on disk at export time — see MANIFEST.txt for the exact
file list with sizes, plus anything that could not be included and why.

## What's inside

- `client/` — React + TypeScript frontend (Vite). Entry: `client/index.html`
  + `client/src/main.tsx`; portal in `App.tsx`; admin dashboard in
  `Admin.tsx`; the shared game shell in `gamekit.tsx`; ALL builtin game
  modules in `games.tsx` … `games5.tsx` (the 100 published games).
- `server/` — the backend: `actions.ts` (every API action), `schema.ts`
  (database schema), `library.ts` (the game catalog + per-game SEO
  content), `seed.ts`, `pages-content.ts`, `privileged.ts` (the host-side
  file reader that built this very export).
- `drizzle/` — the SQL migrations that create the database tables.
- `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.base.json`,
  `space.json` — project configuration, exactly as in the live project.
- `vercel.json`, `.env.example` — deployment templates (generated for
  this export, same content as the Code Files downloads).

## What a standalone host must provide

1. **A Node.js runtime** (Node 20+ or Bun) to build and serve the app.
   Install dependencies with `bun install` (or npm) using the included
   `package.json`; build the client with Vite.
2. **An action/API host for the server code.** `server/src/actions.ts` is
   written against the Muse `@hatch/space-sdk` runtime (`defineAction` +
   `ctx.db`). Outside Muse you must either run it on a compatible host or
   port the actions to your own framework (e.g. Next.js route handlers or
   Express). The business logic, schema and all game code port directly —
   only the thin action-host layer is Muse-specific.
3. **A database.** The schema targets SQLite via drizzle-orm
   (`server/src/schema.ts`, migrations in `drizzle/`). For Postgres /
   Supabase: change `INTEGER PRIMARY KEY AUTOINCREMENT` to `SERIAL` /
   `GENERATED ALWAYS AS IDENTITY`, integer millisecond timestamps to
   `BIGINT` or `TIMESTAMPTZ`, and 0/1 flag columns stay `INTEGER` (or
   convert to `BOOLEAN` and adjust the seed data). A ready-made Postgres
   schema + catalog data export is available in Admin → Code Files inside
   the app (schema SQL + playverse-games.json).
4. **Environment variables.** Copy `.env.example` and fill in your own
   values (site URL, Supabase URL + keys, analytics / ads IDs). This export
   contains NO secrets and NO database data — admin accounts, game catalog
   rows and settings live in the database, which is deliberately excluded
   (see MANIFEST.txt). Re-create the owner admin account on first run and
   re-seed the catalog from `server/src/library.ts` / `seed.ts`, or import
   `playverse-games.csv` from the app's Code Files page.
5. **Deploy (Vercel + GitHub).** Push this folder to a GitHub repo, import
   it in Vercel, set the environment variables, add your domain and point
   DNS at Vercel. `vercel.json` already carries the SPA rewrites and cache
   headers.

## Security note

No database data, no secrets, no API keys and no password hashes are in
this zip. Anything that exists in the project but was left out on purpose
is listed, with its reason, at the end of MANIFEST.txt.
