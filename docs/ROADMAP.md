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
| 16 | Wallet : débit comptable correct | ✅ | `applyLedgerMutation` corrigé : `balanceCents` toujours décrémenté du montant entier, bonus consommé **en dernier** (fix du "solde inchangé après défaite" chez LUDOLAKAY) ; tests `wallet.test.ts` |

## À faire

| Priorité | Élément | Statut | Détail |
|---|---|---|---|
| **P1** | **Vérifier le flux S2S complet en prod** | ✅ | Validé : launch → token → mutation wallet signée (non signée 401, mauvais secret 403, timestamp périmé 401), isolation sandbox/live OK |
| P2 | Domaine personnalisé (plateforme Odfinex) | À faire | `odfinexgames` → web, `play.odfinexgames` → play (Vercel custom domain) |
| P2a | Domaines personnalisés par jeu | ✅ | `duelpion.com` + `dominotactics.com` achetés (Hostinger) et connectés aux projets Vercel `duelpion-web`/`dominotactics-web` ; DNS propagé, SSL actif, les deux répondent en 200 (16 août 2026) |
| P3 | Paiements MonCash | ✅ | Dépôts / retraits Bazik + UI `/wallet` + webhook `/webhooks/bazik` ; mock local sans credentials |
| P3b | Credit S2S offline | ✅ | `POST /v1/wallet/credit-user` + SDK `creditToUser` (parrainage) |
| P3c | Credit HMAC obligatoire | ✅ | `requireClientSignature` sur debit **et** credit |
| P3d | NatCash manuel + file retraits | ✅ | PR [#1](https://github.com/MurDev/odfinex-games/pull/1) (3 août 2026) : `payment_rail_config`, `manual_deposit_request`, withdraw queue MonCash/NatCash, admin approve, S2S list, `notifyUrl` → jeux ; SDK `@odfinex/games-sdk@0.1.6` |
| P4 | Catalogue web riche (Phase 3) | À faire | Listes, détails jeu, profils joueurs |

## Décisions en attente

- **Wallet** : activer `walletEnabled` sur quels jeux, montant de crédit test, seuils.
- **Catalogue** : liste publique des jeux (actuellement `sandbox` masqué).

## Historique

- **17 août 2026** : correctif comptable wallet — `applyLedgerMutation` débitait le bonus en premier et ne
  réduisait `balanceCents` que de `montant - bonus` (un joueur avec du bonus perdait sans voir son solde bouger,
  et le bonus devenait retirable). `computeDebitOutcome` extrait : le solde total diminue toujours du montant
  entier, le bonus est consommé en dernier. Tests + tsc/vitest verts, PR [#19](https://github.com/MurDev/odfinex-games/pull/19)
  mergée, déployé Railway. Côté LUDOLAKAY : crédit gagnant `win_{roomId}`, notif de solde à tous les joueurs,
  script `reconcile-wallet.ts`, remédiation des 2 comptes affectés (`f4eeaba2`, `061c1237`), affichage admin
  des entrées de réconciliation comme "Mise".
- **16 août 2026** : domaines personnalisés `duelpion.com` et `dominotactics.com` achetés sur
  Hostinger et connectés (+ `www`) aux projets Vercel `duelpion-web`/`dominotactics-web` ;
  `NEXT_PUBLIC_APP_URL`/`APP_URL`/`CORS_ORIGINS` mis à jour (Vercel + Railway, anciennes URLs
  `*.vercel.app` conservées en fallback) ; `game_client.{duelpion,dominotactics}.live` reseedés en
  prod avec les nouveaux `launchUrl`/`redirectUrls` ; nameservers Hostinger des deux domaines
  pointés vers `ns1/ns2.vercel-dns.com`. Propagation DNS confirmée, SSL Vercel actif (les deux
  domaines répondent en 200).
- **3 août 2026** : NatCash manuel + files dépôt/retrait dual-admin (migration `0006`, admin
  payment-rails / deposit-requests / withdrawal-requests, webhook notify jeux, SDK `0.1.6`).
  Deploy API : préférer `railway up` depuis `main` si `redeploy --from-source` laisse les routes en 404.
- **31 juillet 2026** : deploiement production (Vercel + Railway + Postgres), CI vert, secrets turbo,
  URLs prod corrigées (`odfinex-web` au lieu de `odfinex-games`), login admin OK, `is_admin` activé.
- **31 juillet 2026** : modèle 2 environnements implémenté et déployé (migration `0004`, wallet isolé,
  grant sandbox-only en prod) ; packages npm `@odfinex/*` publiés ; jeu `duelpion.live` créé en prod ;
  front DUELPION déployé sur Vercel, serveur déployé sur Railway (volume persisté).
- **31 juillet 2026** : build Railway DUELPION réparé (lockfile régénéré avec npm 10, version de `node:22-slim`) ;
  flux S2S prod validé E2E : `/v1/session`, `/v1/wallet` (crédit/débit signés), refus 401/403 sans signature,
  isolation sandbox/live confirmée.
