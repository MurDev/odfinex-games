# Sécurité — Phase 1 (identité)

Revue documentée au moment de la clôture Phase 1.  
**Ce n’est pas un audit pentest** — état des contrôles implémentés et des risques acceptés.

## Contrôles en place

| Contrôle | Détail |
|----------|--------|
| Launch tokens | Opaque (`base64url`), stockés **hash SHA-256** en DB, jamais en clair |
| TTL | **7 jours** (`LAUNCH_TOKEN_TTL_MS`) — session jeu sans re-catalogue |
| Allowlist redirect | `POST /v1/launch` : origine de `launchUrl` ∈ `game_client.redirectUrls` |
| CORS API | `WEB_URL`, `PLAY_URL`, `http://localhost:5173`, + `CORS_ORIGINS` (jeux externes) |
| Auth plateforme | Google OAuth via Auth.js, **sessions database** (pas JWT cookie) |
| Cookie local | Sur `localhost`, le cookie de session est partagé entre ports (web ↔ play) |
| Erreurs auth | `401` + codes `MISSING_TOKEN` / `INVALID_TOKEN` pour le SDK |
| Secrets | `.env` / `.env.local` gitignored ; `AUTH_SECRET` requis |

## Surfaces d’attaque / limites acceptées (Phase 1)

| Sujet | Statut |
|-------|--------|
| Rate limiting API / launch | Non implémenté |
| Redis / invalidation sessions scale | Non |
| Rotation / révocation launch tokens | Expiry seulement |
| Publish npm + integrity supply-chain | SDK privé (`workspace` / `file:`) |
| Domaines HTTPS prod + cookies `Secure` / `SameSite` cross-site | Dev localhost only |
| Wallet / ledger (fraude monétaire) | Phase 2 |
| Admin ops / RBAC | Scaffold uniquement |
| Logging / alerting sécurité | Minimal (`[auth:error]`) |

## Checklist ops avant prod (hors Phase 1)

- [ ] Domaines réels + TLS
- [ ] `CORS_ORIGINS` / `redirectUrls` production stricts
- [ ] Secrets rotatés, pas de credentials dans le repo
- [ ] Rate limit sur `/v1/launch` et `/v1/session`
- [ ] Politique cookie cross-subdomain (web ↔ play)
- [ ] Monitoring 401 / abuse
- [ ] Audit externe recommandé avant argent réel (Phase 2+)

## Références code

- Tokens : `apps/api/src/lib/tokens.ts`
- Launch allowlist : `apps/api/src/routes/launch.ts`
- CORS : `apps/api/src/index.ts`
- Auth redirect : `apps/web/src/auth.ts`
