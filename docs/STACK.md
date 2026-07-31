# Stack — Odfinex Games

## Figé (Phase 0 / 1)

| Couche | Choix |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Langage | TypeScript (strict) |
| Front (`web`, `play`, `admin`) | Next.js 15 App Router, React 19 |
| API | Node 22 + Hono |
| Validation | Zod (`@odfinex/shared`) |
| DB | Postgres 16 (Docker local, port hôte **55432**) |
| ORM / migrations | Drizzle + `postgres.js` (`@odfinex/db`) |
| Auth | Auth.js (`next-auth` v5) — **Google OAuth**, sessions **database** |
| Tests | Vitest |
| Runtime Node | 22 (`.nvmrc`) |

## Production (déployé — juillet 2026)

| Couche | Choix |
|---|---|
| DB hébergée | Postgres 16 géré par Railway (volume persisté, region sfo) |
| Deploy front | Vercel (web, admin, play — git integration) |
| Deploy API | Railway (`Dockerfile.api`, healthcheck `/health`) |
| CI/CD | GitHub Actions (lint/typecheck/test/build) + deploys auto Vercel |
| Cache turbo | Remote cache Vercel (`TURBO_TOKEN` / `TURBO_TEAM` en secrets GitHub) |

Détails : [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Prévu (phases suivantes)

| Couche | Choix prévu |
|---|---|
| Cache / sessions scale | Redis (quand nécessaire) |
| Wallet | Ledger Postgres + APIs debit/credit idempotents (Phase 2) — fait, reste l'activation par jeu |
| Domaine perso | `odfinexgames` / `play.odfinexgames` (Vercel custom domains) |
| Paiements | MonCash dépôts / retraits |

## Notes locales

- Docker Desktop doit tourner avant `pnpm db:migrate` / `pnpm --filter @odfinex/api dev`.
- Variables Google : `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` dans `apps/web/.env.local`.
- Redirect OAuth autorisé : `http://localhost:3000/api/auth/callback/google`.
- Jeux externes : ajouter l’origine à `CORS_ORIGINS` (ex. DUELPION `http://localhost:3002`).
- Guide intégrateur : [`SDK-INTEGRATION.md`](./SDK-INTEGRATION.md).

## Ce qui n’est pas dans ce repo

- Code des jeux de production (DUELPION, LudoLakay, …) — repos séparés, consommateurs du SDK
- Finance Odfinex (web3 / exchange) — produit distinct
