# Database guide: SQLite (development) and MySQL (production)

QRSathi uses Prisma with two providers:

| Environment | Provider | Schema | How schema changes are applied |
|---|---|---|---|
| Local development | SQLite file | `prisma/schema.prisma` (canonical) | `npx prisma db push` (refuses data-losing changes) |
| Production | MySQL 8.0+ | `prisma/mysql/schema.prisma` (generated) | `npm run db:mysql:deploy` (versioned migrations in `prisma/mysql/migrations`) |

The provider is chosen **when the Prisma client is generated** (`npm install`, `npm run build`, `npm run db:generate`), based on the scheme of `DATABASE_URL` (`file:` or `mysql://`). Nothing switches databases at runtime. Build and run with the same `DATABASE_URL`.

## SQLite (development)

```bash
cp .env.example .env             # DATABASE_URL="file:./dev.db"
npm install
npx prisma db push               # creates/updates prisma/dev.db; keeps existing data
npm run dev
```

`prisma/dev.db` and every `*.backup*` copy hold real user data (e-mails, password hashes). They are git-ignored. Never commit them.

## MySQL (production)

### 1. Create the database and a least-privilege user

```sql
CREATE DATABASE qrsathi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'qrsathi'@'%' IDENTIFIED BY '<long random password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON qrsathi.* TO 'qrsathi'@'%';
```

`CREATE`, `ALTER`, `INDEX`, `REFERENCES` and `DROP` are needed only while migrations run. If your platform supports it, use a separate migration user and give the app user just `SELECT, INSERT, UPDATE, DELETE`.

Use TLS between the app and a remote database. Append `?sslaccept=strict` to the URL, or follow your provider's instructions.

### 2. Configure and apply the schema

```bash
# .env on the server (never commit)
DATABASE_URL="mysql://qrsathi:<password>@db.internal:3306/qrsathi"

npm ci
npm run db:mysql:deploy          # prisma migrate deploy — applies pending migrations only, never resets
npm run build                    # generates the MySQL client, builds Next.js
npm start
```

`prisma migrate deploy` is safe to run on every deployment. It applies only migrations that haven't been applied yet and never drops or resets anything by itself. **Never run `prisma migrate reset`, `prisma db push --accept-data-loss` or `prisma migrate dev` against production.**

### 3. Create the first administrator

```bash
npm run admin -- create --email you@company.com --name "Your Name" --super
```

See [ADMIN.md](ADMIN.md).

## Migrating existing data from SQLite to MySQL

`npm run db:migrate-data` copies every row from a SQLite file into an **empty** MySQL database that already has the schema.

What it guarantees:
- **The SQLite file is never modified.** A consistent snapshot is written first with `VACUUM INTO` to `prisma/backups/<name>-pre-mysql-<timestamp>.db`, and everything is read from that snapshot.
- **Pre-flight checks before any write:**
  - string lengths against the MySQL column sizes;
  - 32-bit integer ranges;
  - NULLs in required columns;
  - orphaned foreign keys;
  - unique-key collisions under MySQL comparison rules.
- **One transaction.** Any failure rolls back every row.
- **Exact copy.** IDs, foreign keys, timestamps (millisecond precision, UTC), booleans and NULLs are preserved.
- **Verification.** Every table is read back and compared with the source, both by row count and by a SHA-256 hash of every normalised row. A JSON report goes to `prisma/backups/`.

### Procedure

```bash
# 0. Stop the app (or put it in maintenance) so no writes happen during the copy.
# 1. Dry run: checks the source data, makes a snapshot, needs no MySQL connection.
npm run db:migrate-data -- --dry-run

# 2. Create the empty MySQL database and apply the schema.
DATABASE_URL="mysql://…" npm run db:mysql:deploy

# 3. Copy and verify.
MYSQL_URL="mysql://…" npm run db:migrate-data          # add --sqlite path/to/file.db for a non-default source

# 4. Switch the app: set DATABASE_URL to the MySQL URL, then rebuild and start.
npm run build && npm start
# 5. Smoke-test: sign in, open a dynamic QR short link, view analytics, open the admin console.
```

On Windows PowerShell set variables with `$env:MYSQL_URL="mysql://…"`.

Uploaded files are not in the database. Copy `UPLOAD_DIR` (default `./uploads`) to the new server as well.

### Rollback

| When | How |
|---|---|
| The migration script fails | Nothing was written (single transaction). Fix the reported problem and run it again. |
| Verification reports a mismatch | Don't switch `DATABASE_URL`. Drop and recreate the MySQL database (`DROP DATABASE qrsathi; CREATE DATABASE …`), run `db:mysql:deploy` again and investigate. |
| Problems after switching | Set `DATABASE_URL` back to the SQLite URL, rebuild and restart. The SQLite file is unchanged, but **writes made while on MySQL are not in it.** Export them first if needed. |

### MySQL vs SQLite differences that are handled

| Topic | SQLite | MySQL | How it's handled |
|---|---|---|---|
| String comparison | Exact (binary) | `utf8mb4_unicode_ci` ignores case and accents by default | Identifier columns use `utf8mb4_bin`: short codes, SKUs, barcode values and lookup keys, stored file names, payment references, token and recovery-code hashes, rate-limit keys. Free-text and search columns stay case-insensitive. User e-mails are stored lowercase. |
| Text length | Unlimited | `VARCHAR(191)` by default | Long fields are sized from the API validation limits (see `scripts/db/mysql-schema.mjs`). The migration checks every value against these sizes before writing. |
| Index length | Unlimited | 3,072 bytes per key | Barcode values (up to 1,500 characters) use a 512-character prefix in the per-user unique index. Two different barcodes would collide only if their first 512 characters were identical. |
| Defaults on long text | Allowed | Not allowed on `TEXT` | Fields with a `""` default use bounded `VARCHAR` instead. |
| Dates | Integer milliseconds | `DATETIME(3)`, UTC | Prisma reads and writes UTC; the migration converts exactly. |
| JSON | Stored as text | Stored as text (`TEXT`/`MEDIUMTEXT`) | Unchanged. The app parses JSON itself, so there are no JSON-column differences. |
| Money | Integer paise | `INT` | No floating point anywhere. |
| Booleans | `0`/`1` | `TINYINT(1)` | Converted by Prisma and by the migration. |
| Trailing spaces in unique keys | Significant | Ignored (PAD SPACE) | Inputs are trimmed by validation; the migration pre-flight detects collisions. |

## Migrations in this repository

| Migration | Contents |
|---|---|
| `20261025000000_init` | All original tables, plus binary collation for identifiers |
| `20261025180000_billing_branding` | Additive only: `PricingPlan`, `ProviderPlan`, `Subscription`, `WebhookEvent`, `BrandAsset`; new `Payment` columns (currency, interval, refunds, subscription link), `User.quotaLock`, `Session.reauthAt`; binary collation for Razorpay ids |

Tested on MySQL 8.4.13:
- both migrations applied together to empty databases;
- the upgrade path: a database on the previous release, with existing users and payments, then received the second migration. Existing rows kept their values and gained the column defaults (`currency = INR`, `kind = payment_link`).

In every case `prisma migrate status` reported no drift. For SQLite development, `npx prisma db push` applies the same changes additively.

**Rolling back** `20261025180000_billing_branding`:
1. Restore the pre-upgrade backup.
2. Alternatively, deploy the previous release. The new tables and columns are simply unused by older code, because every column has a default or is nullable.

Don't drop the tables by hand while subscriptions exist.

## Changing the schema

1. Edit `prisma/schema.prisma` (the canonical schema).
2. Locally: `npx prisma db push`.
3. Regenerate the MySQL schema: `npm run db:mysql:schema`. CI fails if you forget (`--check`).
4. Create a MySQL migration against a **disposable** MySQL database, never production:
   ```bash
   DATABASE_URL="mysql://root:pw@localhost:3307/qrsathi_dev" npx prisma migrate dev --schema prisma/mysql/schema.prisma --create-only --name <change>
   ```
   Review the generated SQL. Prefer additive changes: new nullable columns or columns with defaults, and new tables. Split renames and removals into expand → migrate data → contract releases.
5. Commit the schema files and the migration folder. Production applies it with `npm run db:mysql:deploy`.

## Backups

See [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md).
