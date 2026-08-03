# SDK Integration — `@odfinex/games-sdk`

Guide pour brancher un jeu externe sur Odfinex Games (**Phase 1 identité + Phase 2 wallet**).

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
| `walletEnabled` | `true` pour autoriser `debit` / `credit` via le SDK |

Puis `pnpm db:seed`.

Le catalogue web (`apps/web`) liste les jeux actifs, sauf clients masqués (ex. `sandbox`).  
Le launch se fait sur `web` (`/launch/{clientId}`) car il lit le cookie de session Auth.js.
`play/launch/{clientId}` redirige vers `web/launch/{clientId}` (en prod `*.vercel.app`
est un public suffix : les cookies ne traversent pas les sous-domaines, donc `play`
ne peut pas lire la session de `web`).

## Flux d’entrée

### A — Depuis le catalogue

```text
odfinexgames (/) → /launch/{clientId} (même domaine web)
  → (si besoin) web/login Google → retour sur /launch/{clientId}
  → POST /v1/launch
  → redirect → {launchUrl}?token=…&clientId=…
  → jeu : SDK getUser() / getSession()
```

### B — Depuis le jeu (entrée directe)

1. Bouton Connexion / Jouer → `https://odfinex-web…/launch/{clientId}`  
   (ou `client.loginUrl({ returnTo: launchUrl })`, où `launchUrl = webUrl/launch/{clientId}`).
2. `web` détecte la session Odfinex (cookie) ou redirige vers Google (`/login`).
3. Retour jeu avec `?token=`.
4. Persister le token (ex. `localStorage`) et appeler `getSession()`.

Référence réelle : **DUELPION** (`../DUELPION`) — silent relaunch pour joueurs déjà connus, TTL token 7 jours.

### C — Sandbox local (test SDK)

`http://localhost:3000/launch/sandbox` → redirige vers `apps/play` `/sandbox?token=…`.

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
  clientSecret: process.env.ODFINEX_CLIENT_SECRET, // requis pour debit/credit (S2S)
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

// Rediriger vers le launch plateforme (auth + token en une étape)
const login = client.loginUrl({
  returnTo: "http://localhost:3000/launch/duelpion",
});
```

`getSession()` renvoie `{ user, clientId, expiresAt }` — utile pour stocker l’expiry.

## Wallet (Phase 2 + S2S)

Prérequis : `game_client.walletEnabled === true`, un launch token valide, et `clientSecret` configure dans le SDK (S2S).

```ts
const bal = await client.getBalance();
// { balanceCents: number, currency: "HTG" }

const history = await client.getTransactions({ limit: 50 });
// { items: LedgerEntry[], total }

await client.debit({
  amountCents: 100, // 1 HTG
  reason: "bet",
  referenceId: `match-${matchId}-bet`, // unique par jeu
});

await client.credit({
  amountCents: 200,
  reason: "win",
  referenceId: `match-${matchId}-win`,
});
```

- Montants en **centimes HTG** (entiers).
- Rejouer le même `referenceId` avec le même payload renvoie le même résultat (idempotent).
- Crédit de test joueur : page web `/wallet` → « Crédit test » (`POST /v1/wallet/grant`, non-prod).

Demo : `http://localhost:3000/launch/sandbox` (boutons Debit/Credit).

## Erreurs courantes

| Code / symptôme | Cause | Action |
|-----------------|-------|--------|
| `MISSING_TOKEN` | Pas de `?token=` ni `sessionToken` | Passer par `/launch/{clientId}` (web) |
| `INVALID_TOKEN` | Token expiré / inconnu | Relancer via `web/launch/{clientId}` |
| Fetch `TypeError` / CORS | Origine jeu absente de CORS | Ajouter à `CORS_ORIGINS`, redémarrer API |
| `GAME_NOT_FOUND` | `clientId` inconnu ou inactif | Seed / activer `game_client` |
| `LAUNCH_URL_NOT_ALLOWED` | Origine `launchUrl` hors allowlist | Étendre `redirectUrls` |
| `GAME_NOT_ALLOWED` | `walletEnabled` false | Activer sur `game_client` |
| `MISSING_CLIENT_SECRET` | Headers S2S manquants (`x-client-secret`, `x-timestamp`, `x-client-signature`) | Configurer `clientSecret` dans le SDK |
| `INVALID_CLIENT_SECRET` | Secret invalide ou secret non configure sur le jeu | Generer un secret dans l'admin UI |
| `INVALID_TIMESTAMP` | Horloge du serveur jeu dephasee > 5 min | Synchroniser NTP |
| `INVALID_SIGNATURE` | HMAC body+timestamp ne correspond pas | Verifier l'algo HMAC-SHA256 |
| `INSUFFICIENT_FUNDS` | Solde < debit | Grant test / crédit win |
| `IDEMPOTENCY_CONFLICT` | Même `referenceId`, autre payload | Nouveau `referenceId` |

## API utile

| Méthode | Route | Auth |
|---------|-------|------|
| `GET` | `/v1/session` | Bearer **launch** token |
| `POST` | `/v1/launch` | Session plateforme |
| `GET` | `/v1/games` | — |
| `GET` | `/v1/me` | Session plateforme |
| `GET` | `/v1/wallet` | Launch **ou** session |
| `POST` | `/v1/wallet/debit` | Launch + HMAC S2S (`clientSecret`) |
| `POST` | `/v1/wallet/credit` | Launch + HMAC S2S (`clientSecret`) |
| `POST` | `/v1/wallet/credit-user` | HMAC S2S seul (`X-Client-Id` + secret) — pas de launch token |
| `POST` | `/v1/wallet/deposit` | Launch **ou** session — crée paiement MonCash (body: amountHtg, successUrl, errorUrl) |
| `POST` | `/v1/wallet/deposit/:orderId/complete` | Launch **ou** session — confirme après retour MonCash |
| `POST` | `/v1/wallet/withdraw` | Launch **ou** session — débit + payout MonCash (body: amountHtg, phone) |
| `GET` | `/v1/wallet/transactions` | Launch **ou** session |
| `GET` | `/v1/client/transactions` | HMAC S2S seul — ledger filtré pour ce `clientId` (+ dépôts platform liés) |
| `POST` | `/v1/wallet/grant` | Session, non-prod live |
| `POST` | `/webhooks/bazik` | Signature Bazik |

SDK dépôt (jeu) :

```ts
const { redirectUrl, orderId } = await client.createDeposit({
  amountHtg: 100,
  successUrl: "https://mygame.com/wallet/deposit/complete",
  errorUrl: "https://mygame.com/wallet?deposit=error",
});
window.location.href = redirectUrl;
// après retour :
await client.completeDeposit(orderId);
```

## Hors scope (plus tard)

- Domaines production (`odfinexgames`, `play.odfinexgames`)
- Catalogue web riche (Phase 3)

Voir aussi : [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`PHASE-1.md`](./PHASE-1.md), [`PHASE-2.md`](./PHASE-2.md), [`SECURITY-PHASE-2.md`](./SECURITY-PHASE-2.md), [`S2S-AUTH.md`](./S2S-AUTH.md).
