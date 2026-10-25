# Security policy

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting). Include:
- what's affected (route, component, version or commit);
- steps to reproduce, or a proof of concept;
- the impact you think it has.

We aim to:
- acknowledge reports within **3 working days**;
- give an initial assessment within **10 working days**;
- fix confirmed high-severity issues as quickly as possible.

We'll credit you in the release notes unless you'd rather stay anonymous.

## Scope and rules

In scope: this codebase and its default configuration.

Please:
- test only against **your own local installation**, never against someone else's deployment;
- don't access, modify or delete other people's data;
- don't run denial-of-service, spam or social-engineering tests;
- give us reasonable time to fix an issue before disclosing it.

Out of scope:
- vulnerabilities in third-party services (Google, Razorpay, SMTP providers);
- missing hardening on deployments that don't follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), such as no HTTPS or `TRUST_PROXY` set without a proxy.

## Supported versions

Only the latest release on `main` receives security fixes.

## Security design

See:
- [docs/ADMIN.md](docs/ADMIN.md) for roles, admin sign-in, MFA and the audit log;
- [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) for the most recent audit, its findings and the known remaining risks.

No software is completely secure. Deploy with the production checklist in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
