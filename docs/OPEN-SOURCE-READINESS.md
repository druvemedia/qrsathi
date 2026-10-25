# Open-source readiness report: github.com/druvemedia/qrsathi

Audit date: 2026-10-25. The repository has 3 commits on `main`, all pushed to `origin`. Earlier in this work session the GitHub repository was confirmed **private**. Re-check before publishing: *Settings → General → Danger zone → Change visibility*.

## Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | `prisma/dev.db.backup-20261025-121707` (SQLite database) was committed in the **first commit** (`21277e0`) and pushed. It contains 3 user accounts with **bcrypt password hashes**: two demo accounts (`demo@demo.local`, `admin@demo.local`) and one personal-looking address (`d***@gmal.com`). It also holds QR codes, ~1,000 scans, logs and site settings. | **High** if the repo becomes public | **Untracked** in the working tree (`git rm --cached`; your local copy is kept). `.gitignore` now blocks `*.db`, `*.backup*` and `prisma/backups/`. **Still present in git history: see "History cleanup" below.** |
| 2 | Demo administrator `admin@demo.local` with a documented password (`admin12345`) exists in the development database and appeared in the old README. | High (if that DB were ever deployed) | The README no longer documents it, and the seeder no longer creates admins. **Delete the account from every non-throw-away database** (e.g. demote/delete it in the console after creating a super admin). |
| 3 | Secrets scan of all history (AWS/GitHub/Razorpay live keys, private keys, non-empty SMTP/Google/Razorpay secrets) | – | **Nothing found.** The only `AUTH_SECRET` value in history is the placeholder `change-me-to-a-long-random-string`. |
| 4 | `.env` (real local configuration) | – | Never committed (ignored from the start). |
| 5 | `uploads/` | – | Only `.gitkeep` is tracked. |
| 6 | No LICENSE | Blocker for publishing | Owner decision needed: see [LICENSING.md](LICENSING.md). |

## Credential rotation (recommended regardless)

- **Account passwords in the leaked backup.** bcrypt (cost 12) is slow to crack, but weak passwords can still be guessed offline.
  - The owner of `d***@gmal.com` should change that password, here and anywhere else it was reused.
  - Delete the demo accounts from any database that matters.
- **`AUTH_SECRET`.** It was never committed, so no rotation is required because of git. Rotate it if `.env` was ever shared.
- **Google / SMTP / Razorpay secrets.** None are in git. Keep them only in the server's `.env` or secret store.

## History cleanup procedure (NOT executed — needs your explicit approval)

Removing the file from history **rewrites every commit hash** and needs a **force-push**. Everyone with a clone must re-clone. Do this only while the repository is still private, and only with owner approval.

```bash
# 0. Work on a fresh mirror clone, never your working copy.
git clone --mirror https://github.com/druvemedia/qrsathi.git qrsathi-mirror
cd qrsathi-mirror

# 1. Keep an offline copy of the original (encrypted storage; it contains personal data).
git bundle create ../qrsathi-before-cleanup.bundle --all

# 2. Remove all SQLite databases and backups from every commit (pip install git-filter-repo).
git filter-repo --invert-paths \
  --path-glob 'prisma/*.db' --path-glob 'prisma/*.backup*' --path-glob '*.db' --path-glob '*.sqlite'

# 3. Verify nothing remains.
git log --all --name-only --pretty=format: | grep -Ei '\.db|backup' || echo "clean"

# 4. Force-push the rewritten history (DESTRUCTIVE for other clones).
git push --force --mirror origin

# 5. Ask GitHub Support to purge cached views of the old commits
#    (https://support.github.com → "Remove sensitive data").
#    Delete forks/clones that contain the old history.
```

Then, in your normal working folder:

```bash
git fetch origin && git reset --hard origin/main   # discards local commits; push or stash them first
```

If you'd rather **not** rewrite history:
- Keep the repository private forever.
- Or publish a fresh repository that starts from a clean commit (`git checkout --orphan public-main` → commit → push to a new repo). This loses the history but needs no force-push.

## Repository hygiene added

| File | Purpose |
|---|---|
| `README.md` | Overview, quick start, admin bootstrap, databases, tests, deployment links |
| `CONTRIBUTING.md` | Dev setup, checks to run, commit/PR rules, schema-change rules |
| `SECURITY.md` | Private vulnerability reporting, supported versions, scope |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 (adapted summary + link) |
| `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md` | Structured bug/feature reports; PR checklist (security, data, tests) |
| `.github/workflows/ci.yml` | Typecheck, lint, unit tests, MySQL schema check, licence check, build, and the MySQL integration test against a MySQL 8.4 service |
| `.github/dependabot.yml` | Weekly npm and GitHub Actions updates |
| `.nvmrc`, `package.json#engines` | Node 22 LTS, npm 10 |
| `.env.example` | Every variable, placeholders only |
| `docs/` | Admin/RBAC, database & migration, deployment, backup & recovery, licensing, security audit |

## Before flipping the repository to public

- [ ] Choose and add a LICENSE ([LICENSING.md](LICENSING.md)).
- [ ] Decide on history cleanup (above) and carry it out, or publish a fresh repository.
- [ ] Rotate or change the passwords listed under "Credential rotation".
- [ ] Turn on **private vulnerability reporting** (*Settings → Code security*), Dependabot alerts and secret scanning with push protection.
- [ ] Protect `main`: require PRs and passing CI.
- [ ] Re-run `git log --all --name-only --pretty=format: | sort -u` and confirm no data files are listed.
