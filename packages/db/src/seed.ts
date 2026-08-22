import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireDatabaseUrl } from "./env.js";
import { createDb } from "./client.js";
import { gameClients } from "./schema.js";

const db = createDb(requireDatabaseUrl());
const sql = db.$client;

/** Well-known test secret for sandbox game clients (shared across games in sandbox). */
export const SANDBOX_SECRET = "sandbox_test_secret_change_me";

type SeedGame = {
  slug: string;
  name: string;
  hidden: boolean;
  launchUrl: string;
  /** Overrides `launchUrl` for the `live` environment only; falls back to `launchUrl` if unset. */
  liveLaunchUrl?: string;
  redirectUrls: string[];
  walletEnabled: boolean;
  notifyUrl?: string;
  /** If set, hashed for both sandbox and live (local S2S). Otherwise only sandbox gets SANDBOX_SECRET. */
  clientSecret?: string;
};

const sandboxGame: SeedGame = {
  slug: "sandbox",
  name: "Sandbox",
  hidden: true,
  launchUrl: "http://localhost:3001/sandbox",
  redirectUrls: [
    "http://localhost:3001",
    "http://localhost:3001/",
    "http://localhost:3001/sandbox",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3001/sandbox",
    "https://odfinex-play.vercel.app/sandbox",
  ],
  walletEnabled: true,
};

const duelpionGame: SeedGame = {
  slug: "duelpion",
  name: "DUELPION",
  hidden: false,
  launchUrl: "http://localhost:3005",
  liveLaunchUrl: "https://duelpion.com",
  redirectUrls: [
    "http://localhost:3005",
    "http://localhost:3005/",
    "http://localhost:3002",
    "http://localhost:3002/",
    "http://127.0.0.1:3005",
    "http://127.0.0.1:3002",
    "https://duelpion.com",
    "https://duelpion.com/",
    "https://www.duelpion.com",
    "https://www.duelpion.com/",
    "https://duelpion-web.vercel.app",
    "https://duelpion-web.vercel.app/",
  ],
  walletEnabled: true,
  notifyUrl: "https://duelpion-production.up.railway.app/webhooks/odfinex/wallet-events",
};

const dominotacticsGame: SeedGame = {
  slug: "dominotactics",
  name: "Domino Tactics",
  hidden: false,
  launchUrl: "http://localhost:3015",
  liveLaunchUrl: "https://dominotactics.com",
  redirectUrls: [
    "http://localhost:3015",
    "http://localhost:3015/",
    "http://127.0.0.1:3015",
    "https://dominotactics.com",
    "https://dominotactics.com/",
    "https://www.dominotactics.com",
    "https://www.dominotactics.com/",
    "https://dominotactics-web.vercel.app",
    "https://dominotactics-web.vercel.app/",
  ],
  walletEnabled: true,
  notifyUrl:
    "https://dominotactics-server-production.up.railway.app/webhooks/odfinex/wallet-events",
};

/** Local Ludo stack: hub on :3000 (Google OAuth), game on :3100, game server on :3001. */
const ludolakayGame: SeedGame = {
  slug: "ludolakay",
  name: "Ludo Lakay",
  hidden: false,
  launchUrl: "http://localhost:3100",
  liveLaunchUrl: "http://localhost:3100",
  redirectUrls: [
    "http://localhost:3100",
    "http://localhost:3100/",
    "http://127.0.0.1:3100",
    "http://127.0.0.1:3100/",
  ],
  walletEnabled: true,
  notifyUrl: "http://localhost:3001/webhooks/odfinex/wallet-events",
  clientSecret: SANDBOX_SECRET,
};

function hash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

for (const game of [sandboxGame, duelpionGame, dominotacticsGame, ludolakayGame]) {
  for (const environment of ["sandbox", "live"] as const) {
    const clientId = `${game.slug}.${environment}`;
    const clientSecretHash = game.clientSecret
      ? hash(game.clientSecret)
      : environment === "sandbox"
        ? hash(SANDBOX_SECRET)
        : undefined;
    const launchUrl =
      environment === "live" && game.liveLaunchUrl
        ? game.liveLaunchUrl
        : game.launchUrl;

    await db
      .insert(gameClients)
      .values({
        clientId,
        name: game.name,
        environment,
        hidden: game.hidden,
        launchUrl,
        redirectUrls: game.redirectUrls,
        walletEnabled: game.walletEnabled,
        clientSecretHash,
        notifyUrl: game.notifyUrl,
      })
      .onConflictDoUpdate({
        target: gameClients.clientId,
        set: {
          name: game.name,
          environment,
          hidden: game.hidden,
          launchUrl,
          redirectUrls: game.redirectUrls,
          isActive: true,
          walletEnabled: game.walletEnabled,
          notifyUrl: game.notifyUrl,
          ...(clientSecretHash ? { clientSecretHash } : {}),
        },
      });

    console.log(
      `[db] seeded game_client: ${clientId} →`,
      launchUrl,
      `(wallet=${game.walletEnabled}, env=${environment})`,
    );
  }
}

const legacyClientIds = ["sandbox", "duelpion"];
for (const clientId of legacyClientIds) {
  await db.delete(gameClients).where(eq(gameClients.clientId, clientId));
  console.log(`[db] removed legacy game_client: ${clientId}`);
}

await sql.end();
