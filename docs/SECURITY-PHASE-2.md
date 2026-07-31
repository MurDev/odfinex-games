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
| `POST …/debit` / `…/credit` | **Launch Bearer** uniquement + walletEnabled |
| `GET …/transactions`, `POST …/grant` | Session plateforme uniquement |

## Limites assumées (Phase 2)

- Debit/credit depuis le client jeu (Bearer launch) — acceptable first-party / local ; **pas** de preuve serveur jeu (`client_secret`) encore.
- Pas de rate-limit dédié wallet.
- Pas de freeze / risk / audit admin.

## Checklist ops

- [ ] Ne jamais activer `grant` en prod
- [ ] N’activer `walletEnabled` que pour les jeux de confiance
- [ ] Surveiller collisions `referenceId` (bugs client)
- [ ] Avant paiement réel : Phase 2.1 (MonCash) + revue S2S
