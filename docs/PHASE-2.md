# Phase 2 — Wallet + SDK money

> **Document de suivi** — dernière mise à jour : **2026-07-28** — statut : **terminé** (implémentation locale)

## Objectif

Ledger plateforme (autorité argent) + SDK `getBalance` / `debit` / `credit` + UI wallet minimale.  
**Pas** de rails MonCash / NatCash dans cette phase.

## Décisions figées

| Sujet | Décision |
|---|---|
| Devise | HTG en **centimes entiers** (`amountCents`) |
| Autorité | Platform API uniquement (pas de DB côté jeu) |
| Idempotence | UNIQUE `(clientId, referenceId)` |
| Auth jeu | Bearer **launch token** + `game_client.walletEnabled` |
| Auth web | Cookie session Auth.js |
| Crédit test | `POST /v1/wallet/grant` (désactivé si `NODE_ENV=production`) |

## Hors scope

- Dépôts / retraits MonCash–NatCash
- Webhooks / WebSocket `wallet.updated`
- Migration LudoLakay vers ce ledger
- Mises in-game DUELPION

## Livré

### DB (`@odfinex/db`)

- `wallet_account` — solde par user
- `ledger_entry` — écritures + UNIQUE `(client_id, reference_id)`
- `game_client.wallet_enabled`
- Migration `0001_wallet_ledger.sql`
- Seed : `sandbox` + `duelpion` avec `walletEnabled: true`

### API (`apps/api`)

| Méthode | Route | Auth |
|---------|-------|------|
| `GET` | `/v1/wallet` | launch **ou** session |
| `POST` | `/v1/wallet/debit` | launch + walletEnabled |
| `POST` | `/v1/wallet/credit` | launch + walletEnabled |
| `GET` | `/v1/wallet/transactions` | session |
| `POST` | `/v1/wallet/grant` | session, non-prod |

Mutation : `SELECT … FOR UPDATE` → insert ledger → update balance.

Erreurs : `INSUFFICIENT_FUNDS`, `IDEMPOTENCY_CONFLICT`, `GAME_NOT_ALLOWED`, `UNAUTHORIZED`, `INVALID_BODY`.

### SDK

```ts
await client.getBalance(); // { balanceCents, currency: "HTG" }
await client.debit({ amountCents, reason, referenceId });
await client.credit({ amountCents, reason, referenceId });
```

### UI

- `apps/web` `/wallet` — solde, historique, bouton « Crédit test (+100 HTG) »
- Header — pastille solde
- `apps/play` `/sandbox` — demo Debit/Credit 1 HTG

## Critères de done

- [x] Migration + seed wallet
- [x] Routes API + Zod shared
- [x] SDK methods + Vitest
- [x] UI `/wallet` + header + sandbox money
- [x] Docs PHASE-2 + SDK-INTEGRATION / ARCHITECTURE

## Vérif locale

```bash
pnpm db:migrate && pnpm db:seed
pnpm --filter @odfinex/api dev
pnpm --filter @odfinex/web dev
pnpm --filter @odfinex/play dev

# 1. Login Google → http://localhost:3000/wallet → Crédit test
# 2. http://localhost:3000/launch/sandbox → Debit / Credit
```

## Suite (Phase 2.1+)

MonCash dépôts/retraits, webhooks, hardening S2S, consommation DUELPION.

Voir aussi : [`SDK-INTEGRATION.md`](./SDK-INTEGRATION.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`SECURITY-PHASE-2.md`](./SECURITY-PHASE-2.md).
