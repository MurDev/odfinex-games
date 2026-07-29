# SDK Integration — `@odfinex/games-sdk`

Guide pour brancher un jeu externe sur Odfinex Games (**Phase 1 — identité uniquement**).  
Wallet / `getBalance` / debit / credit = **Phase 2** (pas encore disponibles).

## Prérequis

1. Stack plateforme locale :

```bash
cd ODFINEX_GAMES
docker compose up -d
pnpm db:migrate && pnpm db:seed
pnpm --filter @odfinex/api dev    # :4000
pnpm --filter @odfinex/web dev    # :3000
pnpm --filter @odfinex/play dev   # :3001
```

2. Google OAuth configuré dans `apps/web/.env.local` (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).

3. Package SDK (privé, pas encore sur npm) :

```json
{
  "dependencies": {
    "@odfinex/games-sdk": "file:../ODFINEX_GAMES/packages/sdk",
    "@odfinex/shared": "file:../ODFINEX_GAMES/packages/shared",
    "zod": "^3.25.67"
  }
}
```

Ajoute l’origine du jeu à `CORS_ORIGINS` dans `ODFINEX_GAMES/.env` (ex. `http://localhost:3002`).

## Enregistrer un jeu (`game_client`)

Upsert via seed ([`packages/db/src/seed.ts`](../packages/db/src/seed.ts)) ou insert SQL/Drizzle :

| Champ | Rôle |
|-------|------|
| `clientId` | Slug unique (`duelpion`, `sandbox`, …) |
| `name` | Nom catalogue |
| `launchUrl` | URL de redirection après launch (ex. `http://localhost:3002`) |
| `redirectUrls` | Allowlist d’origines ; **doit** inclure l’origine de `launchUrl` |
| `isActive` | `true` pour apparaître dans `GET /v1/games` |

Puis `pnpm db:seed`.

Le catalogue web (`apps/web`) liste les jeux actifs, sauf clients masqués (ex. `sandbox`).  
Launch direct reste possible : `http://localhost:3001/launch/<clientId>`.

## Flux d’entrée

### A — Depuis le catalogue

```text
odfinexgames (/) → play/launch/{clientId}
  → (si besoin) web/login Google
  → POST /v1/launch
  → redirect → {launchUrl}?token=…&clientId=…
  → jeu : SDK getUser() / getSession()
```

### B — Depuis le jeu (entrée directe)

1. Bouton Connexion / Jouer → `http://localhost:3001/launch/{clientId}`  
   (ou `client.loginUrl({ returnTo: playLaunchUrl })`).
2. Play détecte la session Odfinex (cookie) ou redirige vers Google.
3. Retour jeu avec `?token=`.
4. Persister le token (ex. `localStorage`) et appeler `getSession()`.

Référence réelle : **DUELPION** (`../DUELPION`) — silent relaunch pour joueurs déjà connus, TTL token 7 jours.

### C — Sandbox local (test SDK)

`http://localhost:3001/launch/sandbox` → `apps/play` `/sandbox`.

## Exemple minimal

```ts
import {
  OdfinexGamesClient,
  OdfinexGamesError,
  type User,
} from "@odfinex/games-sdk";

const client = new OdfinexGamesClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  clientId: "duelpion",
  webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
  // sessionToken optionnel : sinon lit ?token= dans l’URL (browser)
});

try {
  const user: User = await client.getUser();
  // { id, displayName, email, avatarUrl, createdAt }
  console.log(user.displayName);
} catch (err) {
  if (err instanceof OdfinexGamesError) {
    console.error(err.code, err.message); // MISSING_TOKEN, INVALID_TOKEN, …
  }
  throw err;
}

// Rediriger vers login plateforme (si tu n’utilises pas /launch directement)
const login = client.loginUrl({
  returnTo: "http://localhost:3001/launch/duelpion",
});
```

`getSession()` renvoie `{ user, clientId, expiresAt }` — utile pour stocker l’expiry.

## Erreurs courantes

| Code / symptôme | Cause | Action |
|-----------------|-------|--------|
| `MISSING_TOKEN` | Pas de `?token=` ni `sessionToken` | Passer par `/launch/{clientId}` |
| `INVALID_TOKEN` | Token expiré / inconnu | Relancer via Play launch |
| Fetch `TypeError` / CORS | Origine jeu absente de CORS | Ajouter à `CORS_ORIGINS`, redémarrer API |
| `GAME_NOT_FOUND` | `clientId` inconnu ou inactif | Seed / activer `game_client` |
| `LAUNCH_URL_NOT_ALLOWED` | Origine `launchUrl` hors allowlist | Étendre `redirectUrls` |

## API utile (Phase 1)

| Méthode | Route | Auth |
|---------|-------|------|
| `GET` | `/v1/session` | Bearer **launch** token |
| `POST` | `/v1/launch` | Session plateforme |
| `GET` | `/v1/games` | — |
| `GET` | `/v1/me` | Session plateforme |

## Hors scope Phase 1

- `getBalance()`, debit, credit, ledger
- Publication npm du SDK
- Domaines production (`odfinexgames`, `play.odfinexgames`)

Voir aussi : [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`PHASE-1.md`](./PHASE-1.md), [`SECURITY-PHASE-1.md`](./SECURITY-PHASE-1.md).
