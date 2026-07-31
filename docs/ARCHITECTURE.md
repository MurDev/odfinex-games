# Architecture — Odfinex Games

## Vue d’ensemble

### Production

```text
Vercel                           Railway
├── odfinex-web.vercel.app       ├── odfinex-api-production.up.railway.app  (/health)
├── odfinex-admin.vercel.app     │     Hono : identity, launch, game registry, wallet
└── odfinex-play.vercel.app      └── Postgres 16 (volume persisté)
        │
        │  API_URL / NEXT_PUBLIC_API_URL
        ▼
   Platform API
```

### Local

```text
odfinexgames (web :3000)
  Auth.js Google → session DB (cookie authjs.session-token)
        │
        │  catalogue → DUELPION (sandbox masqué)
        ▼
play.odfinexgames (play :3001)
  /launch/[clientId]
        │  lit cookie session → POST /v1/launch
        ▼
  redirect → jeu?token=…&clientId=…
        │
        ▼
  jeu externe (ex. DUELPION) / sandbox
        │  @odfinex/games-sdk.getUser()
        ▼
Platform API (:4000)
  GET  /v1/me
  POST /v1/launch
  GET  /v1/session
  GET  /v1/games
  GET/POST /v1/wallet*   (ledger)
        │
        ▼
Postgres (:55432)
  user, account, session, verification_token
  game_client, launch_token
  wallet_account, ledger_entry
```

## Principes

1. **Découplage** — aucun moteur de jeu de production dans ce monorepo (sandbox de test OK dans `play`).
2. **SDK** — identité + money ; le jeu garde règles et matchmaking.
3. **Autorité argent** — ledger uniquement côté Platform API (`FOR UPDATE` + idempotence `referenceId`).
4. **Auth unique** — Google OAuth sur la plateforme ; les jeux ne gèrent pas le login.
5. **Launch tokens** — 7 jours, stockés hashés ; le SDK ne voit que le Bearer opaque.
6. **Allowlist** — `game_client.launchUrl` doit matcher une origine de `redirectUrls`.
7. **CORS jeux** — origines externes via `CORS_ORIGINS` (ex. `http://localhost:3002`).
8. **Wallet par jeu** — `game_client.walletEnabled` gate les mutations money.

## Flux identité (Phase 1)

| Étape | Qui | Quoi |
|---|---|---|
| 1 | `web` | Login Google → ligne `session` + cookie |
| 2 | `play` | `/launch/{clientId}` avec cookie → `POST /v1/launch` |
| 3 | API | Crée `launch_token`, renvoie `launchUrl?token=` |
| 4 | Jeu / sandbox | SDK `getUser()` → `GET /v1/session` |
| 5 | API | Valide hash + expiry → profil public |

Login alternatif depuis un jeu : `web/login?returnTo=…&clientId=…` (redirect Auth.js autorise `WEB_URL` et `PLAY_URL`), ou entrée directe `play/launch/{clientId}`.

## Packages

| Package | Rôle |
|---|---|
| `@odfinex/shared` | Contrats Zod (User, launch, session, wallet, erreurs) |
| `@odfinex/db` | Schéma Drizzle, migrations, seed |
| `@odfinex/games-sdk` | Client jeux : identité + `getBalance` / `debit` / `credit` |

## Apps

| App | Rôle |
|---|---|
| `web` | Catalogue, Google auth, `/me`, `/wallet` |
| `play` | Launch + sandbox SDK (identité + money demo) |
| `api` | Identity / registry / tokens / ledger |
| `admin` | Ops (jeux, joueurs, transactions) |

## Déploiement

Voir [`DEPLOYMENT.md`](./DEPLOYMENT.md) : Vercel (web/admin/play), Railway (`odfinex-api` + Postgres),
git flow `developement → main`, CI GitHub Actions, env vars par environnement.

## Phases

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Squelette monorepo | ✅ |
| 1 | Identity + SDK auth | ✅ — [`PHASE-1.md`](./PHASE-1.md) |
| 2 | Wallet + SDK money | ✅ — [`PHASE-2.md`](./PHASE-2.md) |
| 3 | Catalogue web riche | À venir |
| 4+ | Jeux externes (DUELPION, …) | Intégration SDK en cours (hors monorepo) |

Suivi global : [`ROADMAP.md`](./ROADMAP.md).
