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
| 10 | Modèle 2 environnements par jeu | ✅ | Chaque jeu = 2 paires credentials (`{slug}.{env}`), wallet isolé par env, grant prod sandbox-only |
| 11 | Publication npm du SDK | ✅ | `@odfinex/shared@0.1.x` + `@odfinex/games-sdk@0.1.x` publics (scope `odfinex`) |
| 12 | Intégration SDK dans DUELPION | ✅ | Dépendances npm, clientId `duelpion.live` / `duelpion.sandbox`, S2S crédit sur victoire |
| 13 | Jeux créés en prod | ✅ | `sandbox` (hidden) + `duelpion` en sandbox **et** live, `walletEnabled=true` |
| 14 | Repo + CI DUELPION | ✅ | `MurDev/duelpion-web` (main = web app, `legacy-v1` = ancien), Dockerfile serveur |
| 15 | Déployer DUELPION | ✅ | Front Vercel en ligne (`duelpion-web.vercel.app`) ; serveur Railway sur volume persisté (`duelpion-production.up.railway.app`), lockfile npm 10 en sync |

## À faire

| Priorité | Élément | Statut | Détail |
|---|---|---|---|
| **P1** | **Vérifier le flux S2S complet en prod** | ✅ | Validé : launch → token → mutation wallet signée (non signée 401, mauvais secret 403, timestamp périmé 401), isolation sandbox/live OK |
| P2 | Domaine personnalisé | À faire | `odfinexgames` → web, `play.odfinexgames` → play (Vercel custom domain) |
| P3 | Paiements MonCash | À faire | Dépôts / retraits sur le wallet |
| P4 | Catalogue web riche (Phase 3) | À faire | Listes, détails jeu, profils joueurs |

## Décisions en attente

- **Wallet** : activer `walletEnabled` sur quels jeux, montant de crédit test, seuils.
- **Catalogue** : liste publique des jeux (actuellement `sandbox` masqué).

## Historique

- **31 juillet 2026** : deploiement production (Vercel + Railway + Postgres), CI vert, secrets turbo,
  URLs prod corrigées (`odfinex-web` au lieu de `odfinex-games`), login admin OK, `is_admin` activé.
- **31 juillet 2026** : modèle 2 environnements implémenté et déployé (migration `0004`, wallet isolé,
  grant sandbox-only en prod) ; packages npm `@odfinex/*` publiés ; jeu `duelpion.live` créé en prod ;
  front DUELPION déployé sur Vercel, serveur déployé sur Railway (volume persisté).
- **31 juillet 2026** : build Railway DUELPION réparé (lockfile régénéré avec npm 10, version de `node:22-slim`) ;
  flux S2S prod validé E2E : `/v1/session`, `/v1/wallet` (crédit/débit signés), refus 401/403 sans signature,
  isolation sandbox/live confirmée.
