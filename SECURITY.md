# Security Policy / Biztonsági irányelv

This document is the public vulnerability-reporting policy for the Gulumen webshop (`gulumen-webshop`).  
Ez a fájl a Gulumen webshop nyilvános sebezhetőség-bejelentési irányelve.

Internal operator rules (admin login, keys, 2FA, IP allowlist) live in **[docs/ADMIN-BIZTONSAGI-SZABALYZAT.md](docs/ADMIN-BIZTONSAGI-SZABALYZAT.md)**. Related: [docs/BACKUP.md](docs/BACKUP.md), [docs/WAF.md](docs/WAF.md), [docs/STAGING.md](docs/STAGING.md).

---

## Supported versions / Támogatott verziók

This is a single production application, not a versioned library.

| Surface | Status |
|---------|--------|
| Current default branch deployed to production (`https://www.gulumen.com`) | Supported |
| Historical commits / forks / local copies | Unsupported — please reproduce on current `main` / production |

---

## Reporting a vulnerability / Sebezhetőség bejelentése

**Do not** open a public GitHub issue, pull request, or discussion that includes exploit details, secrets, customer data, or a working proof of concept against production.

**Ne** nyiss nyilvános GitHub issue-t, PR-t vagy discussiont exploit részletekkel, titkokkal, vásárlói adatokkal, vagy éles rendszer elleni PoC-kal.

### Preferred / Elsődleges

1. GitHub **private vulnerability report** (Security Advisories):  
   https://github.com/Gulumen404750/gulumen-webshop/security/advisories/new
2. If private reporting is unavailable, email **info@gulumen.hu** with subject `SECURITY`.

Please include:

- Affected URL / route (e.g. `/api/admin/login`, `/admin/dashboard`)
- Description and impact (auth bypass, data leak, payment integrity, XSS, CSRF, …)
- Steps to reproduce **without** targeting live customer data
- Your report date and a contact for follow-up

### Please do not / Kérjük, ne

- Run destructive tests on production (data deletion, bulk price changes, payment fraud)
- Access or exfiltrate real customer orders, emails, or payment identifiers
- Social-engineer staff or share stolen credentials
- Demand payment as a condition of disclosure (ransomware / extortion)

Coordinated disclosure is welcome. We do not run a paid bug bounty.

---

## Scope / Hatály

In scope: this repository and the production site it deploys — authentication (customer + admin), sessions, payments/webhooks, admin dashboard, personal data in orders, secrets handling.

Out of scope: third-party outages (Stripe, Railway, Resend, Google OAuth), issues that require a leaked `ADMIN_API_KEY` / `JWT_SECRET` already in the attacker’s possession (report the leak itself), and theoretical findings with no realistic impact.

---

## Handling / Feldolgozás

We aim to acknowledge reports within **7 days** and to share a remediation plan or a reasoned decline after triage. Fix timelines depend on severity (auth/payment bypass first). Please keep the issue private until a fix is deployed or we agree it can be published.

A bejelentéseket **7 napon belül** igyekszünk visszaigazolni. A javítás ideje a súlyosságtól függ (auth / fizetés először). A részleteket tartsd titokban, amíg a javítás kint van, vagy meg nem egyeztetjük a közlést.

---

## Secrets in this repo

Never commit `.env`, `.env.local`, live `ADMIN_API_KEY`, `JWT_SECRET`, `NEXTAUTH_SECRET`, Stripe keys, or database URLs. Placeholders belong only in `.env.example`. If a secret was committed, rotate it in Railway/hosting **before** relying on a git history rewrite.
