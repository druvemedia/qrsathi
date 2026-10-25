## What and why

<!-- What does this change, and which problem does it solve? Link the issue: Fixes #123 -->

## How it was tested

<!-- Commands run and results. Say clearly what you did NOT test (e.g. no MySQL, no real Razorpay). -->

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:api` / `npm run test:admin` against a local build (if APIs or auth changed)
- [ ] `npm run test:browser` (if UI changed): light and `DARK=1`, phone/tablet/desktop widths

## Checklist

- [ ] No secrets, `.env` files, databases, backups, uploads or real customer data are included
- [ ] Every new API route validates input with zod and checks authentication **and ownership** (deny by default)
- [ ] Admin routes call `requireAdmin()` (and `{ superAdmin: true }` where needed) and write an audit entry
- [ ] Nothing secret is logged, returned to the browser or placed in a `NEXT_PUBLIC_*` variable
- [ ] Schema changes: edited `prisma/schema.prisma`, ran `npm run db:mysql:schema`, added a reviewed MySQL migration; the change is additive/non-destructive
- [ ] Docs updated (README / docs/*) if behaviour, configuration or operations changed
- [ ] Existing features and tests still pass; no test was removed or weakened
