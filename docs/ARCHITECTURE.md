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
        │  catalogue → /launch/[clientId] (même domaine, cookie dispo)
        ▼
web /launch/[clientId]
        │  lit cookie session → POST /v1/launch
        ▼
  redirect → jeu?token=…&clientId=…
        │
        ▼
  jeu externe (ex. DUELPION) / sandbox (play :3001)
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

Le launch vit sur `web` car il lit le cookie de session Auth.js. `play` ne fait que la
surface de démo (sandbox) : il consomme `?token=` depuis l'URL, jamais le cookie.
En production `*.vercel.app` est un **public suffix** (cookies isolés par sous-domaine) :
un launch porté par `play` ne pourrait jamais lire la session de `web` → c'est ce qui
causait la boucle de redirection, corrigée en déplaçant le launch sur `web`.

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
| 2 | `web` | `/launch/{clientId}` avec cookie → `POST /v1/launch` |
| 3 | API | Crée `launch_token`, renvoie `launchUrl?token=` |
| 4 | Jeu / sandbox | SDK `getUser()` → `GET /v1/session` |
| 5 | API | Valide hash + expiry → profil public |

Entrée depuis un jeu : le jeu redirige vers `web/login?clientId=…&returnTo=/launch/{clientId}`
(ou directement `web/launch/{clientId}`), le cookie de session reste sur `web`
(même domaine) et le token voyage par l'URL (`?token=`). `play/launch/{clientId}`
ne fait que rediriger vers `web/launch/{clientId}` (anti-boucle en prod,
où les cookies ne traversent pas `*.vercel.app`).

## Packages

| Package | Rôle |
|---|---|
| `@odfinex/shared` | Contrats Zod (User, launch, session, wallet, erreurs) |
| `@odfinex/db` | Schéma Drizzle, migrations, seed |
| `@odfinex/games-sdk` | Client jeux : identité + `getBalance` / `debit` / `credit` |

## Apps

| App | Rôle |
|---|---|
| `web` | Catalogue, Google auth, `/me`, `/wallet`, `/launch/[clientId]` |
| `play` | Surface sandbox SDK (identité + money demo) |
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
