# Odfinex Games

Plateforme multi-jeux d’Odfinex : identité, catalogue et SDK pour les jeux externes (DUELPION, LudoLakay, …).

**Aucun moteur de jeu de production dans ce repo.** Les jeux consomment `@odfinex/games-sdk`.  
Un **sandbox local** vit dans `apps/play` pour valider le flux launch / SDK (masqué du catalogue public).

| Domaine | App | Rôle |
|---|---|---|
| `odfinexgames` | `apps/web` | Catalogue, login Google, profil |
| `play.odfinexgames` | `apps/play` | Launch session → jeu / sandbox |
| API | `apps/api` | Identity, launch tokens, game registry, wallet |
| Admin | `apps/admin` | Ops (scaffold) |

## Prérequis

- Node **22** (voir `.nvmrc`)
- **pnpm** 10+
- **Docker Desktop** (Postgres)

## Démarrage

```bash
pnpm install
cp .env.example .env
# Renseigner AUTH_GOOGLE_* dans apps/web/.env.local (voir docs/PHASE-1.md)

docker compose up -d
pnpm db:migrate
pnpm db:seed

pnpm --filter @odfinex/api dev    # :4000
pnpm --filter @odfinex/web dev    # :3000
pnpm --filter @odfinex/play dev   # :3001
```

> Postgres est exposé sur **`localhost:55432`** (évite le conflit avec un Postgres local sur `5432`).

| App | URL |
|---|---|
| web (catalogue) | http://localhost:3000 |
| play | http://localhost:3001 |
| play launch DUELPION | http://localhost:3001/launch/duelpion |
| play launch sandbox | http://localhost:3001/launch/sandbox |
| sandbox SDK | http://localhost:3001/sandbox |
| api health | http://localhost:4000/health |
| api games | http://localhost:4000/v1/games |
| wallet (web) | http://localhost:3000/wallet |

## Parcours de test

1. Ouvre http://localhost:3000 → **Continuer avec Google**
2. Sur le catalogue, clique **DUELPION** → launch → jeu sur `:3002` avec profil SDK
3. Ou test SDK seul : http://localhost:3001/launch/sandbox
4. Wallet : http://localhost:3000/wallet → **Crédit test** → sandbox Debit/Credit

Sans session : `/launch/{clientId}` → redirect login web.

## Intégrer un jeu

Voir **[`docs/SDK-INTEGRATION.md`](docs/SDK-INTEGRATION.md)**.

Consommateur de référence hors monorepo : **DUELPION** (`../DUELPION`).

## Structure

```text
apps/
  web/      # catalogue + Auth.js (Google)
  play/     # /launch/[clientId] + sandbox SDK
  api/      # Hono — identity + /v1/wallet*
  admin/    # scaffold
packages/
  shared/   # Zod contracts
  db/       # Drizzle + migrations + seed
  sdk/      # @odfinex/games-sdk
docs/
  PHASE-1.md
  PHASE-2.md
  SDK-INTEGRATION.md
  SECURITY-PHASE-1.md
  SECURITY-PHASE-2.md
  STACK.md
  ARCHITECTURE.md
```

## Phase actuelle

**Phase 1 — identity + SDK auth : terminée** (tag `phase-1`).  
Suivi : [`docs/PHASE-1.md`](docs/PHASE-1.md).  
Sécurité : [`docs/SECURITY-PHASE-1.md`](docs/SECURITY-PHASE-1.md).

**Phase 2 — wallet / SDK money : terminée**.  
Suivi : [`docs/PHASE-2.md`](docs/PHASE-2.md).  
Sécurité : [`docs/SECURITY-PHASE-2.md`](docs/SECURITY-PHASE-2.md).
