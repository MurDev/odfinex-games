import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { gameClients, launchTokens } from "@odfinex/db";
import { CreateLaunchRequestSchema } from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import {
  generateLaunchToken,
  hashToken,
  launchExpiresAt,
} from "../lib/tokens.js";
import { requirePlatformSession, type AuthVariables } from "../middleware/auth.js";

export const launchRoutes = new Hono<{ Variables: AuthVariables }>();

launchRoutes.post("/launch", requirePlatformSession, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CreateLaunchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "clientId is required");
  }

  const { clientId } = parsed.data;
  const user = c.get("user");

  const game = await db
    .select()
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!game || !game.isActive) {
    return apiError(c, 404, "GAME_NOT_FOUND", `Unknown or inactive clientId: ${clientId}`);
  }

  let launchUrl: URL;
  try {
    launchUrl = new URL(game.launchUrl);
  } catch {
    return apiError(c, 500, "INVALID_LAUNCH_URL", "Game launchUrl is invalid");
  }

  const allowed = game.redirectUrls.some((entry) => {
    try {
      return new URL(entry).origin === launchUrl.origin;
    } catch {
      return false;
    }
  });

  if (!allowed) {
    return apiError(
      c,
      400,
      "LAUNCH_URL_NOT_ALLOWED",
      "Game launchUrl origin is not in redirectUrls allowlist",
    );
  }

  const token = generateLaunchToken();
  const expiresAt = launchExpiresAt();

  await db.insert(launchTokens).values({
    tokenHash: hashToken(token),
    userId: user.id,
    clientId: game.clientId,
    expiresAt,
  });

  launchUrl.searchParams.set("token", token);
  launchUrl.searchParams.set("clientId", game.clientId);

  return c.json({
    token,
    expiresAt: expiresAt.toISOString(),
    clientId: game.clientId,
    launchUrl: launchUrl.toString(),
  });
});
