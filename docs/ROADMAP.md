# Roadmap — Odfinex Games

> Suivi de ce qui est implémenté / déployé et de ce qui reste à faire.
> Déploiement : [`DEPLOYMENT.md`](./DEPLOYMENT.md) · Architecture : [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Fait

| # | Élément | Statut | Détail |
|---|---|---|---|
| 1 | Identity + SDK auth (Phase 1) | ✅ | Google OAuth, sessions DB, launch tokens, `/v1/session` |
| 2 | Wallet + SDK money (Phase 2) | ✅ | `/v1/wallet*`, ledger idempotent, `debit`/`credit` |
| 3 | S2S auth (client_secret + HMAC) | ✅ | `rotate-secret` admin, `X-Client-Signature` |
| 4 | Admin ops | ✅ | Jeux (create/detail/settings/secret), joueurs, transactions |
| 5 | API + DB en production | ✅ | Railway `odfinex-api` + Postgres hébergé, `/health` OK |
| 6 | Fronts en production | ✅ | web / admin / play sur Vercel, login Google OK |
| 7 | CI/CD | ✅ | GitHub Actions (lint/typecheck/test/build) vert ; deploys auto Vercel ; cache turbo partagé |
| 8 | Google OAuth prod | ✅ | Callback URIs enregistrées (web + admin) |
| 9 | Accès admin | ✅ | `is_admin = true` pour l'email admin |

## À faire

| Priorité | Élément | Statut | Détail |
|---|---|---|---|
| **P1** | **Intégration SDK dans DUELPION** | À faire | On regarde **d'abord** l'intégration du SDK dans DUELPION (hors monorepo) : `baseUrl` prod, `clientId`/`clientSecret` côté serveur, `getSession`/`getBalance`, mutations wallet. Voir [`SDK-INTEGRATION.md`](./SDK-INTEGRATION.md). |
| **P1** | **Modèle 2 environnements par jeu (admin)** | À faire | Chaque jeu expose **deux environnements** : `sandbox` et `live` (prod), soit **2 paires `clientId`/`client_secret`** par jeu, comme les grandes plateformes (PayPal, Stripe, …). Impact : schema `game_client` (env), admin UI, seed, docs intégrateur. |
| P2 | Créer les jeux dans l'admin prod | À faire | `sandbox` + `duelpion` avec `launchUrl` prod → `odfinex-play` / DUELPION, `walletEnabled` selon le besoin |
| P2 | Déployer DUELPION | À faire | Vercel (Next.js) + env vars prod (API_URL, clientId, client_secret) |
| P2 | Vérifier le flux S2S complet en prod | À faire | launch → token → mutation wallet signée (et non signée refusée en 401) |
| P3 | Domaine personnalisé | À faire | `odfinexgames` → web, `play.odfinexgames` → play (Vercel custom domain) |
| P3 | Publication npm du SDK | À faire | `@odfinex/games-sdk` sur npm (privé ou public) |
| P3 | Paiements MonCash | À faire | Dépôts / retraits sur le wallet |
| P4 | Catalogue web riche (Phase 3) | À faire | Listes, détails jeu, profils joueurs |

## Décisions en attente

- **Modèle des environnements jeu** (sandbox/live) : à préciser avant l'implémentation admin
  (2 jeux séparés `sandbox`/`live` vs un jeu avec champ `environment` et 2 paires de credentials).
  Voir [`S2S-AUTH.md`](./S2S-AUTH.md#evolution-modele-2-environnements) pour la proposition retenue.
- **Wallet** : activer `walletEnabled` sur quels jeux, montant de crédit test, seuils.
- **Catalogue** : liste publique des jeux (actuellement `sandbox` masqué).

## Historique

- **31 juillet 2026** : deploiement production (Vercel + Railway + Postgres), CI vert, secrets turbo,
  URLs prod corrigées (`odfinex-web` au lieu de `odfinex-games`), login admin OK, `is_admin` activé.
