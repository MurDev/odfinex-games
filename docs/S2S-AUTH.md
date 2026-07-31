# S2S Auth — client_secret + HMAC

> **Statut** : Implemente  
> **Contexte** : Les mutations wallet (`debit`/`credit`) utilisent actuellement uniquement le launch token (visible par le joueur dans l'URL). Pour la production, le **serveur du jeu** doit prouver qu'il autorise chaque transaction.

---

## Principe

Chaque `game_client` possede un `client_secret` (stocke hash en DB, comme les launch tokens). Le SDK, utilise **cote serveur jeu**, signe les requetes wallet avec ce secret :

```
POST /v1/wallet/debit
  Authorization: Bearer <launch-token>      → authentifie le joueur
  X-Client-Id: <clientId>                   → identifie le jeu
  X-Client-Signature: <HMAC-SHA256(body)>   → prouve que le serveur jeu approuve
  X-Timestamp: <unix-ms>                    → anti-replay
```

L'API verifie :
1. Launch token valide + non expire → joueur
2. `game_client.walletEnabled` → jeu autorise
3. HMAC signature valide avec `client_secret` du jeu → requete authentique
4. Timestamp < 5 min → anti-replay
5. `FOR UPDATE` + idempotence `referenceId` → integrite

---

## Changements par couche

### 1. DB (`@odfinex/db`)

- Ajouter `client_secret_hash text` sur `game_client` (nullable — optionnel pour jeux sans wallet)
- Migration `0003_client_secret`
- Generer le secret lors de la creation d'un jeu (admin API) : `crypto.randomBytes(32).toString("base64url")`

### 2. Shared (`@odfinex/shared`)

- Ajouter `ClientSecretResponseSchema` : `{ clientId, clientSecret }` — le secret en clair n'est renvoye qu'une fois a la creation
- Ajouter champ `hasClientSecret: boolean` a `AdminGameStats`

### 3. API (`apps/api`)

- **Middleware** `requireClientSignature` : verifie HMAC + timestamp
  - Lire `X-Client-Id`, `X-Client-Signature`, `X-Timestamp`
  - Verifier timestamp < 5 min
  - Hacher `body + timestamp` avec `client_secret` du jeu, comparer
  - Renvoyer 401 si invalide
- **Modifier** `POST /v1/wallet/debit` et `POST /v1/wallet/credit` :
  - Ajouter `requireClientSignature` APRES `requireLaunchToken`
  - Remplacer le check `walletEnabled` simple par la verification HMAC
- **Admin** : `POST /admin/games/:clientId/rotate-secret` → nouveau secret + hash
- **Admin** : Exposer `hasClientSecret` dans `GET /admin/games/*`

### 4. SDK (`@odfinex/games-sdk`)

- Ajouter `clientSecret` optionnel au constructeur
- Quand `clientSecret` est fourni, `debit()` et `credit()` ajoutent automatiquement :
  - `X-Client-Id`
  - `X-Timestamp` (timestamp actuel en ms)
  - `X-Client-Signature` : `HMAC-SHA256(body + "." + timestamp, clientSecret)`
- `getUser()` / `getSession()` / `getBalance()` restent inchangees (pas besoin du secret)

### 5. Admin UI (`apps/admin`)

- Dans la page de detail d'un jeu (`/games/[clientId]`) :
  - Afficher `hasClientSecret` (badge "Secret configure" / "Non configure")
  - Bouton "Generer un secret" → appelle `POST /admin/games/:clientId/rotate-secret`
  - Afficher le secret une fois dans un dialog (avec warning "copiez-le maintenant")

### 6. Seed

- Regenerer les secrets pour `sandbox` et `duelpion` dans le seed
- Les afficher dans la console au seed

---

## Flux complet S2S

```
1. Admin cree un jeu → API genere client_secret, stocke hash
   → Renvoie le secret en clair (une seule fois)
   → L'admin configure le secret sur le serveur du jeu (env var)

2. Joueur clique "Jouer" sur odfinexgames.com
   → /launch/[clientId] → redirect ?token=... vers le jeu

3. Le navigateur du joueur arrive sur le jeu avec ?token=
   → Le jeu extrait le token de l'URL

4. Le serveur du jeu appelle le SDK (cote serveur)
   → client.setSessionToken(token)
   → client.debit({ amountCents, reason, referenceId })
   → SDK envoie :
        Authorization: Bearer <token>
        X-Client-Id: <clientId>
        X-Timestamp: <now>
        X-Client-Signature: HMAC(body.timestamp, clientSecret)

5. API verify :
   - token → joueur valide
   - clientId + signature → serveur jeu authentique
   - timestamp → pas de replay attack
   - FOR UPDATE + idempotence → execution
```

---

## Securite

| Menace | Mitigation |
|---|---|
| Joueur extrait le token de l'URL et appelle debit/credit | Impossible sans le `client_secret` (serveur jeu) |
| Rejeu d'une requete interceptee | `X-Timestamp` + tolerance 5 min + `referenceId` idempotent |
| Vol du client_secret | Stocke hash en DB, jamais en clair apres creation |
| Serveur jeu compromis | Rotation du secret possible (admin), revocation du launch token possible |
| Attaque MitM | HTTPS obligatoire en prod |

---

## Ce qui ne change pas

- `getUser()`, `getSession()`, `getBalance()` : toujours accessibles avec le launch token seul (lecture seule)
- Login, launch, catalogue : inchange
- Pour les jeux sans wallet (`walletEnabled: false`) : pas besoin de `client_secret`

---

## Évolution : modèle 2 environnements (sandbox / live)

> **Statut** : décision, non implémenté. Suivi : [`ROADMAP.md`](./ROADMAP.md).

Pour suivre le modèle des grandes plateformes (Stripe, PayPal, …), chaque jeu exposera
**deux environnements**, chacun avec **sa propre paire `clientId` / `client_secret`** :

| Environnement | Usage | Credentials |
|---|---|---|
| `sandbox` | Développement / tests du jeu | paire 1 (`clientId_sandbox` + `client_secret_sandbox`) |
| `live` | Production (vrais joueurs, vrai argent) | paire 2 (`clientId_live` + `client_secret_live`) |

### Implications à prévoir

- **Schema `game_client`** : ajouter un champ `environment` (`sandbox` | `live`) ou restructurer en
  « un jeu = une fiche + 2 credentials ».
- **`clientId`** : préfixé par environnement (ex. `duelpion.sandbox`, `duelpion.live`) ou distinct
  par paire, l'essentiel étant que chaque paire de credentials est scellée à un environnement.
- **`launchUrl` / `redirectUrls`** : par environnement (`http://localhost:3002` pour sandbox,
  `https://duelpion.vercel.app` pour live).
- **Admin UI** : onglet ou section « Environnements » sur la fiche jeu, boutons
  « Générer un secret » par environnement.
- **SDK** : le développeur choisit la paire à embarquer selon son environnement de build
  (`ODFINEX_CLIENT_ID` + `ODFINEX_CLIENT_SECRET` par env).
- **Sandbox** : transactions marquées sans valeur réelle (déjà le cas via `POST /v1/wallet/grant`).
- **Sécurité** : le secret `live` ne doit jamais apparaître en sandbox ; rotation indépendante par paire.
