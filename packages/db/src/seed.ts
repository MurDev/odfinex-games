import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireDatabaseUrl } from "./env.js";
import { createDb } from "./client.js";
import { gameClients } from "./schema.js";

const db = createDb(requireDatabaseUrl());
const sql = db.$client;

/** Well-known test secret for the platform's own sandbox demo (play /sandbox). */
export const SANDBOX_SECRET = "sandbox_test_secret_change_me";

const sandboxGame = {
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

const duelpionGame = {
  slug: "duelpion",
  name: "DUELPION",
  hidden: false,
  launchUrl: "http://localhost:3005",
  redirectUrls: [
    "http://localhost:3005",
    "http://localhost:3005/",
    "http://localhost:3002",
    "http://localhost:3002/",
    "http://127.0.0.1:3005",
    "http://127.0.0.1:3002",
    "https://duelpion-web.vercel.app",
    "https://duelpion-web.vercel.app/",
  ],
  walletEnabled: true,
};

function hash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

for (const game of [sandboxGame, duelpionGame]) {
  for (const environment of ["sandbox", "live"] as const) {
    const clientId = `${game.slug}.${environment}`;
    const clientSecretHash =
      environment === "sandbox" ? hash(SANDBOX_SECRET) : undefined;

    await db
      .insert(gameClients)
      .values({
        clientId,
        name: game.name,
        environment,
        hidden: game.hidden,
        launchUrl: game.launchUrl,
        redirectUrls: game.redirectUrls,
        walletEnabled: game.walletEnabled,
        clientSecretHash,
      })
      .onConflictDoUpdate({
        target: gameClients.clientId,
        set: {
          name: game.name,
          environment,
          hidden: game.hidden,
          launchUrl: game.launchUrl,
          redirectUrls: game.redirectUrls,
          isActive: true,
          walletEnabled: game.walletEnabled,
        },
      });

    console.log(
      `[db] seeded game_client: ${clientId} →`,
      game.launchUrl,
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
