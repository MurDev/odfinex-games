# Déploiement — Odfinex Games

> Statut : **production en ligne** (31 juillet 2026)

## Architecture de déploiement

```text
GitHub (MurDev/odfinex-games)
   │  git push → main / developement
   ├─ GitHub Actions (CI) : typecheck, lint, test, build
   └─ Vercel (git integration) : deploys des apps Next.js
        │
         ├── odfinex-web    → https://odfinex-web.vercel.app      (catalogue + Google OAuth + launch)
         ├── odfinex-admin  → https://odfinex-admin.vercel.app    (ops, admin)
         └── odfinex-play   → https://odfinex-play.vercel.app     (surface sandbox, lit ?token=)
        │
        └── appelent l'API via API_URL / NEXT_PUBLIC_API_URL
             │
             ▼
        Railway (odfinex-api)
             │  https://odfinex-api-production.up.railway.app  (/health)
             ▼
        Postgres 16 (Railway, region sfo, volume persisté)

DUELPION (web app)
   │  git push → MurDev/duelpion-web (main)
   ├─ Vercel : duelpion-web → https://duelpion-web.vercel.app
   │     (appelle API Odfinex + serveur DUELPION)
   └─ Railway : duelpion (serveur Hono + SQLite)
         │  https://duelpion-production.up.railway.app  (/health)
         └─ volume persisté /data → server/data/duelpion.db
```

## Services

| Service | Hébergeur | Rôle | URL |
|---|---|---|---|
| `odfinex-web` | Vercel | Catalogue, login Google, profil | https://odfinex-web.vercel.app |
| `odfinex-admin` | Vercel | Admin (jeux, joueurs, transactions) | https://odfinex-admin.vercel.app |
| `odfinex-play` | Vercel | Surface sandbox SDK (lit `?token=` depuis l'URL) | https://odfinex-play.vercel.app |
| `odfinex-api` | Railway | Hono API (identity, launch, wallet) | https://odfinex-api-production.up.railway.app |
| Postgres | Railway | Base de données | interne, service `Postgres` |
| `duelpion-web` | Vercel | Front DUELPION (Next.js + Phaser) | https://duelpion-web.vercel.app |
| `duelpion` | Railway | Serveur DUELPION (Hono + SQLite persisté) | https://duelpion-production.up.railway.app |

### Identifiants utiles

- Vercel team : `murdet-pierres-projects` (slug `murdet-pierres-projects`)
- Projets Vercel : `odfinex-web`, `odfinex-admin`, `odfinex-play`, `duelpion-web`
- Projet Railway : `odfinex-games` (id `297d36ba-6b74-4d86-a24f-3e1b0741b961`), service `odfinex-api`
- Projet Railway : `duelpion` (id `ca0b6503-3016-459c-9088-acb7213ae735`), service `duelpion`
- Repo : `https://github.com/MurDev/odfinex-games` (public)
- Repo : `https://github.com/MurDev/duelpion-web` (privé)

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
| `CORS_ORIGINS` | `https://odfinex-web.vercel.app,https://duelpion-web.vercel.app` |

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

### Railway `duelpion` (serveur DUELPION)

| Variable | Valeur |
|---|---|
| `PORT` | `3100` |
| `ODFINEX_API_URL` | `https://odfinex-api-production.up.railway.app` |
| `ODFINEX_CLIENT_ID` | `duelpion.live` |
| `ODFINEX_CLIENT_SECRET` | secret live du jeu `duelpion.live` (voir admin) |
| `APP_URL` | `https://duelpion-web.vercel.app` |
| `DUELPION_DB_PATH` | `/data/duelpion.db` (volume `duelpion-volume` monté sur `/data`) |

### Vercel `duelpion-web` (production)

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://odfinex-api-production.up.railway.app` |
| `NEXT_PUBLIC_WEB_URL` | `https://odfinex-web.vercel.app` |
| `NEXT_PUBLIC_PLAY_URL` | `https://odfinex-play.vercel.app` |
| `NEXT_PUBLIC_ODFINEX_CLIENT_ID` | `duelpion.live` |
| `NEXT_PUBLIC_APP_URL` | `https://duelpion-web.vercel.app` |
| `NEXT_PUBLIC_DUELPION_API_URL` | `https://duelpion-production.up.railway.app` |

## Modèle 2 environnements par jeu

Chaque jeu expose **2 paires `clientId`/`client_secret`** : `{slug}.sandbox` et `{slug}.live`.

- `clientId = {slug}.{environment}`, ex. `duelpion.live`, `sandbox.sandbox`.
- Secrets sandbox = secret de test bien connu (`sandbox_test_secret_change_me`), visibles côté client.
- Secrets live = secrets serveur, à ne **jamais** exposer côté client.
- Wallet isolé par environnement (`wallet_account` PK `(user_id, environment)`).
- `grant` n'est autorisé que pour `environment='sandbox'` en production.
- Catalogue public (`/v1/games`) : jeux `isActive` + `environment='live'` + `hidden=false`.

## Packages npm

| Package | Version | Usage |
|---|---|---|
| `@odfinex/shared` | `0.1.x` | Types partagés (`User`, `WalletEnvironment`, …) |
| `@odfinex/games-sdk` | `0.1.x` | SDK client/serveur (auth, wallet S2S) |

- Publier (scope `odfinex`, 2FA email) : `npm publish --access public` dans `packages/shared` puis `packages/sdk`.
- `exports` du package : conditions `import`, `require` et `default` (nécessaire pour tsx / CJS).

## Notes opérationnelles

- **Launch / login** : le launch vit sur `odfinex-web` (`/launch/{clientId}`) car il lit le
  cookie de session Auth.js posé par `web`. `odfinex-play/launch/{clientId}` redirige vers
  `web/launch/{clientId}`. En production `*.vercel.app` est un **public suffix** : les cookies
  ne traversent pas les sous-domaines, donc `play` ne peut **jamais** lire la session de `web`
  (cause de la boucle ERR_TOO_MANY_REDIRECTS corrigée le 31/07). Le launch token passe par
  l'URL (`?token=`), pas par un cookie.
- **Login Google** : les callback URIs enregistrées côté Google (console) :
  - `https://odfinex-web.vercel.app/api/auth/callback/google`
  - `https://odfinex-admin.vercel.app/api/auth/callback/google`
- **Accès admin** : `UPDATE "user" SET is_admin = true WHERE email = '...'` (table `user`, colonne `is_admin`).
- **Serveur DUELPION** : déployé via le `Dockerfile` du repo (`node:22-slim`, `npm ci`, `tsx`),
  `CMD` = migrations SQLite puis serveur ; `better-sqlite3` compilé depuis source (build tools dans le stage `deps`).
- **DB prod (web/admin)** : les apps Vercel (`odfinex-web`, `odfinex-admin`) lisent `DATABASE_URL` directement,
  via l'URL **publique** du Postgres. Cette URL dépend du **TCP proxy du service Postgres** (`RAILWAY_TCP_PROXY_DOMAIN/PORT`).
  → **Ne pas supprimer ce proxy** : c'est le `DATABASE_PUBLIC_URL` référencé par les apps. Pour un accès psql ponctuel,
  créer un proxy temporaire séparé et le supprimer après usage.
- **Cache turbo** : `turbo.json` → `remoteCache.enabled` + secrets GitHub `TURBO_TOKEN`/`TURBO_TEAM`.
- Redéploiement Vercel sans commit : bouton *Redeploy* du dashboard, ou CLI depuis le dossier de l'app
  (`vercel --prod --force`). Attention au `rootDirectory` quand on lance depuis un sous-dossier.

## Suivi

Ce qui reste à faire : [`ROADMAP.md`](./ROADMAP.md).
