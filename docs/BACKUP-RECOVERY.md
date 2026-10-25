# Backup and recovery

Two things hold user data: **the database** and **the uploads directory** (`UPLOAD_DIR`). Back up both, keep copies off the server, encrypt them, and test a restore regularly. A backup that has never been restored is a hope, not a backup.

Backups contain personal data: e-mail addresses, password hashes and customer content.
- Store them encrypted, with restricted access.
- Delete them according to your retention policy.
- **Never commit them to git.** `.gitignore` excludes `*.db`, `*.backup*`, `*.dump`, `*.sql.gz` and `prisma/backups/`.

## MySQL

**Nightly logical backup** (consistent for InnoDB, doesn't lock tables):

```bash
mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF \
  -h db.internal -u backup -p qrsathi | gzip > qrsathi-$(date +%F).sql.gz
```

- Use a dedicated `backup` user with `SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, PROCESS`.
- Managed MySQL (RDS, Cloud SQL, DigitalOcean) also offers automated snapshots and point-in-time recovery. Turn them on.

**Restore into a new, empty database first.** Never restore over the live database without a fresh backup of it.

```bash
mysql -h db.internal -u admin -p -e "CREATE DATABASE qrsathi_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c qrsathi-2026-10-25.sql.gz | mysql -h db.internal -u admin -p qrsathi_restore
DATABASE_URL="mysql://…/qrsathi_restore" npx prisma migrate status --schema prisma/mysql/schema.prisma   # expect "up to date"
```

Then point `DATABASE_URL` at the restored database, or rename the databases, and restart.

## SQLite (development / single-server installs)

Copy the file only through SQLite, so the copy is consistent even while the app runs:

```bash
sqlite3 prisma/dev.db ".backup 'backups/dev-$(date +%F).db'"
# or, without the sqlite3 CLI (Node 22.5+):
node -e "new (require('node:sqlite').DatabaseSync)('prisma/dev.db',{readOnly:true}).exec(\"VACUUM INTO 'backups/dev-copy.db'\")"
```

To restore:
1. Stop the app.
2. Keep the current file aside (`mv prisma/dev.db prisma/dev.db.broken`).
3. Copy the backup to `prisma/dev.db`.
4. Start the app.

## Uploads

```bash
rsync -a --delete /srv/qrsathi-data/uploads/ backup-host:/backups/qrsathi/uploads/
```

To restore, copy them back to `UPLOAD_DIR`. Rows in the `Upload` table refer to files by `storedName`, so restore the database and uploads from the same point in time.

## Secrets

Keep `AUTH_SECRET` and `MFA_ENCRYPTION_KEY` in a password manager or secret store, separately from the data backups.
- Losing `MFA_ENCRYPTION_KEY`, or `AUTH_SECRET` if no MFA key is set, makes administrators' 2FA enrolments unreadable. Recover with `npm run admin -- reset-mfa`.
- Rotating `AUTH_SECRET` signs everyone out. That is safe, and it's the right response to a suspected leak.

## Before risky operations

Before upgrades, migrations or bulk administrative changes, take a fresh backup and write down its name.

The SQLite → MySQL migration (`npm run db:migrate-data`) always snapshots the source to `prisma/backups/` first and never modifies the SQLite file.

## Recovery scenarios

| Situation | Action |
|---|---|
| Accidental deletion of a user's data | Restore the latest backup into a **separate** database and copy back only the affected rows. |
| Bad deployment | Roll back the code (previous tag), rebuild and restart. Restore the database only if a migration damaged data. |
| Server lost | New server → install → restore database and uploads → same `.env` secrets → same domain. Printed QR codes keep working once DNS points to the new server. |
| Suspected credential leak | Rotate `AUTH_SECRET` (signs everyone out), the database password, SMTP/Google/Razorpay secrets; review `/admin/security`; reset affected admins' MFA. |
| Lost admin access | `npm run admin -- create …` or `reset-mfa` on the server (see [ADMIN.md](ADMIN.md)). |
