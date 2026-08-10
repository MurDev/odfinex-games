# Security — Phase 2 (Wallet)

Complète [`SECURITY-PHASE-1.md`](./SECURITY-PHASE-1.md). Périmètre : ledger + endpoints money.

## Menaces & mitigations

| Risque | Mitigation |
|---|---|
| Double-spend / race debit | Transaction SQL + `SELECT … FOR UPDATE` sur `wallet_account` |
| Replay / double crédit | UNIQUE `(client_id, reference_id)` ; même payload → replay OK ; payload différent → `IDEMPOTENCY_CONFLICT` |
| Jeu non autorisé à muter | `game_client.wallet_enabled` ; sinon `GAME_NOT_ALLOWED` |
| Solde négatif | CHECK / garde `INSUFFICIENT_FUNDS` avant debit |
| Grant abusif en prod | `POST /v1/wallet/grant` refusé si `NODE_ENV=production` |
| Token volé | Launch token opaque hashé (Phase 1) ; TTL 7j ; rotation = relancer |

## Auth money

| Endpoint | Qui |
|---|---|
| `GET /v1/wallet` | Launch Bearer **ou** cookie session |
| `POST …/debit` / `…/credit` | **Launch Bearer** + HMAC S2S (`client_secret`) + walletEnabled |
| `POST …/credit-user` | HMAC S2S seul (pas de launch token) — crédit offline par `platformUserId` |
| `GET …/transactions`, `POST …/grant` | Session plateforme uniquement |

## Limites assumées (Phase 2)

- Debit/credit exigent le `client_secret` du serveur jeu (HMAC) — un launch token seul ne suffit plus.
- Pas de rate-limit dédié wallet.
- Pas de freeze / risk / audit admin.

## Checklist ops

- [ ] Ne jamais activer `grant` en prod live
- [ ] N’activer `walletEnabled` que pour les jeux de confiance
- [ ] Surveiller collisions `referenceId` (bugs client)
- [x] S2S HMAC sur debit **et** credit
- [ ] Avant argent réel : MonCash dépôts/retraits configurés (`BAZIK_*`)
- [x] NatCash : config `payment_rail_config` + approve admin only (pas d’approve S2S jeu)
- [x] Retraits : hold + file pending ; reject = refund ; notify HMAC jeux (`ODFINEX_NOTIFY_SECRET`)
