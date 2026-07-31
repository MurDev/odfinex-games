import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { gameClients } from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";

export const gamesRoutes = new Hono();

gamesRoutes.get("/games", async (c) => {
  try {
    const rows = await db
      .select({
        clientId: gameClients.clientId,
        name: gameClients.name,
        launchUrl: gameClients.launchUrl,
        isActive: gameClients.isActive,
      })
      .from(gameClients)
      .where(
        and(
          eq(gameClients.isActive, true),
          eq(gameClients.environment, "live"),
          eq(gameClients.hidden, false),
        ),
      );

    return c.json({ games: rows });
  } catch (err) {
    console.error("[api] GET /v1/games failed:", err);
    return apiError(
      c,
      503,
      "DB_UNAVAILABLE",
      "Database unreachable. Run: docker compose up -d",
    );
  }
});
