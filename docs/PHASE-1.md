# Phase 1 — Identity + SDK auth

> **Document de suivi** — mis à jour à chaque étape livrée.  
> Dernière mise à jour : **2026-07-28** — statut global : **terminé** (tag `phase-1`)

## Objectif

Mettre en place l’**identité joueur** sur la plateforme Odfinex Games et exposer l’**auth au SDK**, pour que les jeux externes puissent récupérer « qui joue » sans gérer leur propre login.

## Décisions figées (cadrage produit)

| Sujet | Décision |
|---|---|
| IdP (autorité auth) | **Plateforme Odfinex** — pas de comptes locaux par jeu |
| Auth par défaut | **Google OAuth** (Auth.js) — pas d’email/mot de passe en Phase 1 |
| Session plateforme | **Database sessions** Auth.js (table `session`) |
| Compte joueur | **Unique** — créé au 1er login Google |
| Entrée principale | Catalogue `web` → `web/launch/[clientId]` → jeu (+ `?token=`) |
| Entrée alternative | Login depuis un jeu → `web/launch/{clientId}` |
| Launch token | Opaque, **7 jours**, hash SHA-256 en DB (`launch_token`) |
| Périmètre SDK v1 | **Identité uniquement** — pas de wallet (Phase 2) |
| Jeux | **Hors monorepo** (sauf sandbox local de test dans `apps/play`) |

## Hors scope Phase 1

- Wallet / ledger / debit / credit
- Catalogue complet et UX polish
- Intégration LudoLakay en prod
- Admin ops avancé
- Redis / scale sessions

## Architecture livrée (Phase 1)

```text
Joueur
  │
  ├─► web (:3000)  Auth.js Google ──► cookie session (localhost)
  │         │
  │         └─► web /launch/[clientId]   (même domaine, cookie dispo)
  │                      │  POST /v1/launch (Bearer session)
  │                      ▼
  │                 redirect → jeu?token=…
  │
  └─► jeu / sandbox ──► @odfinex/games-sdk.getUser()
                              │
                              ▼
                        GET /v1/session (Bearer launch token)
                              │
                              ▼
                        Platform API (:4000) + Postgres (:55432)
```

### Flux auth (implémenté)

1. Login Google sur `web` → session DB Auth.js.
2. Cookie `authjs.session-token` sur `web` (et sur `localhost` tous ports en dev).
3. `web/launch/{clientId}` lit le cookie → `POST /v1/launch`.
4. Redirect vers `launchUrl` avec `?token=` + `?clientId=`.
5. SDK `getUser()` → `GET /v1/session` → profil public.

### Flux « login depuis un jeu »

1. Jeu → `web/launch/{clientId}` (recommandé) ou `web/login?returnTo=…&clientId=…`.
2. Auth Google si besoin.
3. Callback `redirect` Auth.js autorise `WEB_URL` et `PLAY_URL`.

> Note prod : le launch vit sur `web` car il lit le cookie de session. En production
> `*.vercel.app` est un **public suffix** (cookies isolés par sous-domaine) : `play`
> ne peut pas lire la session de `web` (causait la boucle ERR_TOO_MANY_REDIRECTS).
> `play/launch/{clientId}` ne fait que rediriger vers `web/launch/{clientId}`.

## Livrables par zone

| Zone | Statut | Contenu |
|---|---|---|
| `@odfinex/shared` | ✅ | `User`, launch/session schemas, `ApiError` |
| `@odfinex/db` | ✅ | Auth.js tables + `game_client` + `launch_token`, migrate/seed (`sandbox` + `duelpion`) |
| `apps/api` | ✅ | `/v1/me`, `/launch`, `/session`, `/games`, middleware, allowlist, `CORS_ORIGINS` |
| `apps/web` | ✅ | Google login, `/me`, catalogue → DUELPION, `/launch/[clientId]`, header |
| `apps/play` | ✅ | redirect `/launch/[clientId]` → web, sandbox `/sandbox` |
| `@odfinex/games-sdk` | ✅ | `getUser`, `getSession`, `loginUrl`, `OdfinexGamesError` |
| Tests | ✅ | Vitest shared + api tokens + sdk (mocks) |
| Docs intégrateur | ✅ | [`SDK-INTEGRATION.md`](./SDK-INTEGRATION.md) |
| Sécurité | ✅ | [`SECURITY-PHASE-1.md`](./SECURITY-PHASE-1.md) (revue documentée) |

## Plan détaillé

Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait · `[-]` annulé / reporté

---

### Étape 1 — Fondations données & config

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 1.1 | Postgres local + `.env.example` | `[x]` | Port hôte **55432** |
| 1.2 | Drizzle schéma Auth.js + game/launch | `[x]` | `@odfinex/db` |
| 1.3 | Migrations + seed | `[x]` | `sandbox` + `duelpion` |
| 1.4 | Connexion DB `apps/api` | `[x]` | `GET /health` |

---

### Étape 2 — Auth plateforme (web)

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 2.1 | Auth.js + adapter Drizzle | `[x]` | Sessions **database** |
| 2.2 | Google OAuth (défaut) | `[x]` | `AUTH_GOOGLE_ID` / `SECRET` |
| 2.3 | `/login`, `/register`→login, logout | `[x]` | |
| 2.4 | `/me` + header | `[x]` | |
| 2.5 | `returnTo` + `clientId` + redirect play | `[x]` | Callback `redirect` Auth.js |

---

### Étape 3 — API identity & sessions

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 3.1 | `GET /v1/me` | `[x]` | Cookie ou Bearer session |
| 3.2 | `POST /v1/launch` | `[x]` | TTL 7 jours |
| 3.3 | `GET /v1/session` | `[x]` | Bearer launch token |
| 3.4 | `GET /v1/games` | `[x]` | |
| 3.5 | Erreurs Zod / `apiError` | `[x]` | |
| 3.6 | Tests Vitest | `[x]` | |

---

### Étape 4 — Play (launch)

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 4.1 | `/launch/[clientId]` | `[x]` | Initialement sur play |
| 4.2 | API launch + redirect | `[x]` | |
| 4.3 | Allowlist `redirectUrls` | `[x]` | |
| 4.4 | Non connecté → login web | `[x]` | |
| 4.5 | Launch déplacé sur `web` (anti-boucle prod) | `[x]` | `31/07` — cookies isolés sur `*.vercel.app` ; play redirige vers web |

---

### Étape 5 — SDK

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 5.1 | `sessionToken` / `?token=` | `[x]` | |
| 5.2 | `getUser()` / `getSession()` | `[x]` | |
| 5.3 | `loginUrl()` | `[x]` | |
| 5.4 | Erreurs 401 | `[x]` | `OdfinexGamesError` |
| 5.5 | Tests SDK | `[x]` | |

---

### Étape 6 — Sandbox & documentation

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 6.1 | Jeu sandbox minimal | `[x]` | `apps/play/src/app/sandbox` (local) |
| 6.2 | `docs/SDK-INTEGRATION.md` | `[x]` | |
| 6.3 | Exemple code intégrateur | `[x]` | Sandbox + guide + DUELPION |
| 6.4 | Checklist E2E documentée | `[x]` | Validée (auto + DUELPION manuel) |

---

### Étape 7 — Finition Phase 1

| # | Tâche | Statut | Notes |
|---|---|---|---|
| 7.1 | Revue sécurité | `[x]` | [`SECURITY-PHASE-1.md`](./SECURITY-PHASE-1.md) |
| 7.2 | README + ARCHITECTURE à jour | `[x]` | Clôture 2026-07-28 |
| 7.3 | Premier commit / tag `phase-1` | `[x]` | Commit initial + tag local |

---

## Critères de done (Phase 1)

- [x] Un joueur peut **se connecter** sur `web` (Google)
- [x] Un joueur connecté peut lancer un jeu via `play` et recevoir un token (sandbox + **DUELPION**)
- [x] Le SDK `getUser()` retourne le **bon profil** (validé via DUELPION + sandbox)
- [x] Un token **invalide** renvoie une erreur claire (tests SDK + API)
- [x] Login / launch avec `returnTo` / entrée jeu fonctionne E2E (DUELPION)
- [x] Tests auto **shared**, **api**, **sdk**
- [x] Guide SDK + notes sécurité

## Checklist E2E

```text
[x] docker compose up -d && pnpm db:seed
[x] Login Google sur http://localhost:3000/login
[x] Logout / re-login (parcours validé en session DUELPION)
[x] Accès /launch/{clientId} sans login → redirect login
[x] Catalogue → DUELPION → jeu avec profil SDK
[x] /launch/sandbox → /sandbox avec profil SDK (test direct)
[x] curl /v1/session sans token → 401
[x] curl /v1/games inclut duelpion
[x] CORS localhost:3002 autorisé pour getSession depuis le jeu
```

## Contrats API (livrés)

| Méthode | Route | Auth | Réponse |
|---|---|---|---|
| `GET` | `/health` | — | `{ ok, service, version, db }` |
| `GET` | `/v1/me` | Session plateforme | `{ user }` |
| `POST` | `/v1/launch` | Session + `{ clientId }` | `{ token, expiresAt, clientId, launchUrl }` |
| `GET` | `/v1/session` | Bearer launch token | `{ user, clientId, expiresAt }` |
| `GET` | `/v1/games` | — | `{ games: [...] }` |

Profil public `user` :

```ts
{ id, displayName, email, avatarUrl, createdAt }
```

## Variables d’environnement

| Variable | App | Description |
|---|---|---|
| `DATABASE_URL` | api, web, db | Postgres (`localhost:55432`) |
| `AUTH_SECRET` | web | Auth.js |
| `AUTH_URL` | web | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | web | `true` en local |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | web | OAuth Google |
| `API_URL` | play, api | `http://localhost:4000` |
| `WEB_URL` / `PLAY_URL` | web, play, api | Origines trusted redirect |
| `CORS_ORIGINS` | api | Origines jeux (ex. `http://localhost:3002`) |
| `NEXT_PUBLIC_API_URL` | play, jeux | Base URL SDK |
| `NEXT_PUBLIC_PLAY_URL` | web | Lien catalogue → launch |
| `NEXT_PUBLIC_WEB_URL` | jeux | Login / catalogue |

## Comment tester (récap)

```bash
docker compose up -d
pnpm db:migrate   # si DB neuve
pnpm db:seed
pnpm --filter @odfinex/api dev
pnpm --filter @odfinex/web dev
pnpm --filter @odfinex/play dev
# + DUELPION : npm run dev (:3002)
```

1. http://localhost:3000 → Google → **DUELPION**
2. Ou http://localhost:3000/launch/sandbox (test SDK)

## Journal de progression

| Date | Étape | Fait | Reste / blocage |
|---|---|---|---|
| 2026-07-27 | Plan | Document Phase 1 créé | — |
| 2026-07-27 | 1 | DB, docker (55432), migrate, seed | — |
| 2026-07-27 | 2 | Google OAuth, sessions DB, `/me` | — |
| 2026-07-27 | 3 + 5 | API identity + SDK `getUser` | — |
| 2026-07-27 | 4 + 6.1 | Play launch + sandbox local | — |
| 2026-07-27 | Docs | README / ARCHITECTURE / STACK / PHASE-1 alignés | guide SDK, E2E, commit |
| 2026-07-28 | DUELPION | Premier consommateur réel + CORS + catalogue | — |
| 2026-07-28 | Clôture | SDK-INTEGRATION, SECURITY, E2E, tag `phase-1` | Phase 2 wallet |
| 2026-07-31 | Fix prod | Launch déplacé sur `web` (boucle `play`↔login sur `*.vercel.app`) ; docs à jour | — |

---

## Mode d’emploi (mise à jour du doc)

À **chaque session de travail** :

1. Choisir la prochaine tâche `[ ]`.
2. Implémenter + tester.
3. Mettre à jour ce fichier (statuts, journal, critères de done).
4. Ne pas reporter une tâche sans noter pourquoi.

**Statuts globaux :** `non démarré` · `en cours` · `bloqué` · `terminé`
