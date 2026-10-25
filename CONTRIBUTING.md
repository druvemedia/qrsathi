# Contributing to QRSathi

Thanks for helping! Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

**Security problems:** never open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

```bash
nvm use                       # Node 22 (see .nvmrc)
npm install
cp .env.example .env          # set AUTH_SECRET; keep DATABASE_URL="file:./dev.db"
npx prisma db push
npm run admin -- create --email you@example.com --super   # local administrator
npm run dev
```

Optional demo data: `DEMO_MODE="true"` in `.env`, then `npm run seed:demo`.

**Windows:** stop `npm run dev` before running `npm install` or `prisma generate`; Windows locks Prisma's engine file.

## Before you open a pull request

```bash
npm run typecheck
npm run lint
npm test
```

If you changed APIs, auth or the UI, also run the integration suites against a production build with a **throw-away** database (see README → Tests). If you changed the database, also run `npm run test:mysql` against a local MySQL.

The pull request template has a checklist. In short:

- **No data or secrets.** Never commit `.env`, databases (`*.db`), backups, uploads or real customer data. `.gitignore` covers the usual paths; double-check `git status`.
- **Deny by default.** Every new API route:
  - validates its input with zod;
  - calls `requireUser()` / `requireAdmin()`;
  - checks that the record belongs to the caller (404 otherwise).
- **Admin actions** call `requireAdmin()` (`{ superAdmin: true }` for role changes or deletion) and write an `audit(...)` entry.
- **Roles** are only ever set server-side. Never read a role, plan or status from a sign-up or client request body.
- **Logging.** Use `logger` / `logEvent` / `audit`; they redact secrets. Don't `console.log` request bodies, tokens or cookies.
- **No secrets in the browser.** `NEXT_PUBLIC_*` variables are visible to everyone.
- **Tests.** Add or extend a test for every fix. Don't delete or weaken existing tests to make a change pass.

## Database changes

1. Edit `prisma/schema.prisma` (SQLite, canonical). Locally: `npx prisma db push`.
2. Run `npm run db:mysql:schema` to regenerate `prisma/mysql/schema.prisma`. CI checks it's in sync.
3. Create a MySQL migration against a disposable MySQL database ([docs/DATABASE.md](docs/DATABASE.md#changing-the-schema)) and review the SQL.
4. Keep changes **additive**: new tables, or columns that are nullable or have defaults. Split renames and removals into separate releases. Never ship destructive migrations without a documented data-migration and rollback plan.
5. Long text fields: add the field to `TYPES` in `scripts/db/mysql-schema.mjs`, sized from your zod validation limit.

## Code style

- TypeScript strict mode. Keep components small and reuse the primitives in `src/components/ui.tsx`.
- Server-only code (`src/lib/session.ts`, `db.ts`, `mfa.ts`, …) must never be imported by client components.
- Match the style of the surrounding code: comment density, naming and idioms.
- Commit messages: short imperative subject (`Add admin bulk suspend`), with details in the body when needed.

## Licensing of contributions

The project licence hasn't been chosen yet ([docs/LICENSING.md](docs/LICENSING.md)). Until it has, maintainers may ask contributors to confirm that their contribution can be released under the licence the owner selects. If the owner picks AGPL with dual licensing, contributors will also be asked to sign a CLA.
