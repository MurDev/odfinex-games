# Déploiement — Odfinex Games

> Statut : **production en ligne** (31 juillet 2026)

## Architecture de déploiement

```text
GitHub (MurDev/odfinex-games)
   │  git push → main / developement
   ├─ GitHub Actions (CI) : typecheck, lint, test, build
   └─ Vercel (git integration) : deploys des apps Next.js
        │
        ├── odfinex-web    → https://odfinex-web.vercel.app      (catalogue + Google OAuth)
        ├── odfinex-admin  → https://odfinex-admin.vercel.app    (ops, admin)
        └── odfinex-play   → https://odfinex-play.vercel.app     (launch → jeux / sandbox)
        │
        └── appelent l'API via API_URL / NEXT_PUBLIC_API_URL
             │
             ▼
        Railway (odfinex-api)
             │  https://odfinex-api-production.up.railway.app  (/health)
             ▼
        Postgres 16 (Railway, region sfo, volume persisté)
```

## Services

| Service | Hébergeur | Rôle | URL |
|---|---|---|---|
| `odfinex-web` | Vercel | Catalogue, login Google, profil | https://odfinex-web.vercel.app |
| `odfinex-admin` | Vercel | Admin (jeux, joueurs, transactions) | https://odfinex-admin.vercel.app |
| `odfinex-play` | Vercel | `/launch/[clientId]` + sandbox SDK | https://odfinex-play.vercel.app |
| `odfinex-api` | Railway | Hono API (identity, launch, wallet) | https://odfinex-api-production.up.railway.app |
| Postgres | Railway | Base de données | interne, service `Postgres` |

### Identifiants utiles

- Vercel team : `murdet-pierres-projects` (slug `murdet-pierres-projects`)
- Projets Vercel : `odfinex-web`, `odfinex-admin`, `odfinex-play`
- Projet Railway : `odfinex-games` (id `297d36ba-6b74-4d86-a24f-3e1b0741b961`), service `odfinex-api`
- Repo : `https://github.com/MurDev/odfinex-games` (public)

## Git flow

```text
developement  →  commit de dev (CI)
      ↓ merge
main          →  production (CI + deploys Vercel)
```

- Le travail se commit sur `developement`, puis est mergé vers `main`.
- Le push sur `main` déclenche : CI GitHub + deploys production Vercel (web, admin, play).

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

- **`quality`** : install → `turbo run typecheck` → `turbo run lint` → `turbo run test`
  - Postgres 16 (service container `ci:ci@localhost:5432/ci`) pour les tests.
- **`build`** (needs `quality`) : `turbo run build`, upload `.next` en artifact.
  - Env : `DATABASE_URL` (Postgres CI), `AUTH_SECRET` (valeur CI factice), `AUTH_URL`, `AUTH_TRUST_HOST`.
- Secrets requis : `TURBO_TOKEN` + `TURBO_TEAM` (cache turbo partagé Vercel/CI).

### Vercel (git integration)

- `rootDirectory` par projet : `apps/web`, `apps/admin`, `apps/play`.
- Build : `turbo run build` (le `vercel.json` de chaque app fixe `installCommand: pnpm install --frozen-lockfile`).
- Le push sur `main` = deploy production ; push sur `developement` = preview (URL `*-git-*.vercel.app`).
- `envDir` retiré de `next.config.ts` (le root `.env` n'est pas chargé en build).

### Railway

- Déploiement via `Dockerfile.api` (single-stage, `node:22-alpine`, `pnpm install --frozen-lockfile`).
- `CMD`: `db:migrate` puis `pnpm --filter @odfinex/api start` (tsx).
- `railway.json`: healthcheck `/health` (timeout 300s), restart ON_FAILURE.
- Un changement de variables redéploie automatiquement le service.

## Variables d'environnement (production)

### Railway `odfinex-api`

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (interne) |
| `PORT` | `4000` |
| `WEB_URL` | `https://odfinex-web.vercel.app` |
| `PLAY_URL` | `https://odfinex-play.vercel.app` |
| `CORS_ORIGINS` | `https://odfinex-web.vercel.app` |

### Vercel (web/admin/play, targets production + preview)

- `API_URL` / `NEXT_PUBLIC_API_URL` = `https://odfinex-api-production.up.railway.app`
- `AUTH_URL` = domaine de l'app (`odfinex-web` ou `odfinex-admin`)
- `AUTH_TRUST_HOST` = `true`
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (secrets)
- `DATABASE_URL` = URL **publique** Postgres Railway (web, admin)
- `WEB_URL` / `NEXT_PUBLIC_WEB_URL` = `https://odfinex-web.vercel.app` (play)
- `PLAY_URL` / `NEXT_PUBLIC_PLAY_URL` = `https://odfinex-play.vercel.app` (web, play)
- Type `sensitive` (valeurs non lisibles), ne peut pas cibler `development`.

> Vercel injecte aussi `VERCEL_*`, et turbo doit les voir via `globalPassThroughEnv` dans `turbo.json` (DATABASE_URL, AUTH_*, API_URL, PLAY_URL, WEB_URL, PORT).

## Notes opérationnelles

- **Login Google** : les callback URIs enregistrées côté Google (console) :
  - `https://odfinex-web.vercel.app/api/auth/callback/google`
  - `https://odfinex-admin.vercel.app/api/auth/callback/google`
- **Accès admin** : `UPDATE "user" SET is_admin = true WHERE email = '...'` (table `user`, colonne `is_admin`).
- **DB prod** : accessible en psql via `DATABASE_PUBLIC_URL` (`*.proxy.rlwy.net`).
- **Cache turbo** : `turbo.json` → `remoteCache.enabled` + secrets GitHub `TURBO_TOKEN`/`TURBO_TEAM`.
- Redéploiement Vercel sans commit : bouton *Redeploy* du dashboard, ou CLI depuis le dossier de l'app
  (`vercel --prod --force`). Attention au `rootDirectory` quand on lance depuis un sous-dossier.

## Suivi

Ce qui reste à faire : [`ROADMAP.md`](./ROADMAP.md).
