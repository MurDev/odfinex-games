# Architecture — Odfinex Games

## Vue d’ensemble

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
        │
        ▼
Postgres (:55432)
  user, account, session, verification_token
  game_client, launch_token
```

## Principes

1. **Découplage** — aucun moteur de jeu de production dans ce monorepo (sandbox de test OK dans `play`).
2. **SDK v1** — identité (+ wallet en Phase 2) ; le jeu garde règles et matchmaking.
3. **Autorité argent** — ledger uniquement côté Platform API (Phase 2).
4. **Auth unique** — Google OAuth sur la plateforme ; les jeux ne gèrent pas le login.
5. **Launch tokens** — 7 jours, stockés hashés ; le SDK ne voit que le Bearer opaque.
6. **Allowlist** — `game_client.launchUrl` doit matcher une origine de `redirectUrls`.
7. **CORS jeux** — origines externes via `CORS_ORIGINS` (ex. `http://localhost:3002`).

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
| `@odfinex/shared` | Contrats Zod (User, launch, session, erreurs) |
| `@odfinex/db` | Schéma Drizzle, migrations, seed |
| `@odfinex/games-sdk` | Client jeux : `getUser`, `getSession`, `loginUrl`, erreurs |

## Apps

| App | Rôle Phase 1 |
|---|---|
| `web` | Catalogue, Google auth, `/me` |
| `play` | Launch + sandbox SDK |
| `api` | Identity / registry / tokens |
| `admin` | Scaffold uniquement |

## Phases

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Squelette monorepo | ✅ |
| 1 | Identity + SDK auth | ✅ terminée — [`PHASE-1.md`](./PHASE-1.md), [`SDK-INTEGRATION.md`](./SDK-INTEGRATION.md) |
| 2 | Wallet + SDK money | À venir |
| 3 | Catalogue web riche | À venir |
| 4+ | Jeux externes (LudoLakay, …) | En cours hors monorepo (DUELPION) |
