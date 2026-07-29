import { requireDatabaseUrl } from "./env.js";
import { createDb } from "./client.js";
import { gameClients } from "./schema.js";

const db = createDb(requireDatabaseUrl());

const sandbox = {
  clientId: "sandbox",
  name: "Sandbox",
  launchUrl: "http://localhost:3001/sandbox",
  redirectUrls: [
    "http://localhost:3001",
    "http://localhost:3001/",
    "http://localhost:3001/sandbox",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3001/sandbox",
  ],
};

const duelpion = {
  clientId: "duelpion",
  name: "DUELPION",
  launchUrl: "http://localhost:3002",
  redirectUrls: [
    "http://localhost:3002",
    "http://localhost:3002/",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3002/",
  ],
};

for (const game of [sandbox, duelpion]) {
  await db
    .insert(gameClients)
    .values(game)
    .onConflictDoUpdate({
      target: gameClients.clientId,
      set: {
        name: game.name,
        launchUrl: game.launchUrl,
        redirectUrls: game.redirectUrls,
        isActive: true,
      },
    });

  console.log(`[db] seeded game_client: ${game.clientId} →`, game.launchUrl);
}
