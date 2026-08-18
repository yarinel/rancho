# Rancho RideCare

Hebrew-first (RTL) mobile web app + field-service OS for **רנצ'ו — תיקוני אופניים עד הבית**: guest booking that starts from the customer's problem, smart appointment suggestions, and a mobile operator surface (Rancho Pro) built around the Service Job — inspection, findings, customer-approved additional work, safety check, payment, and per-bicycle service history.

## Quick start

```bash
npm install
npm run db:migrate   # uses PGlite locally when DATABASE_URL is unset
npm run dev
```

## Checks

```bash
npm run lint
npm run typecheck
npm run test         # Vitest (domain + integration)
npm run build && npm run e2e   # Playwright, mobile profile
```

## Documentation

Start with [CLAUDE.md](CLAUDE.md) (working rules), then [docs/ROADMAP.md](docs/ROADMAP.md) (milestones + acceptance criteria), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and the rest of `docs/`. Environment configuration: [.env.example](.env.example).
