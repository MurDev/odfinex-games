import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { gameClients } from "@odfinex/db";
import type { WalletEnvironment } from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import {
  computeClientSignature,
  hashClientSecret,
  isValidTimestamp,
} from "../lib/signature.js";

export type S2SClientVariables = {
  clientId: string;
  environment: WalletEnvironment;
  walletEnabled: boolean;
  rawBody: string;
};

/**
 * Authenticate a game server without a player launch token.
 * Requires X-Client-Id + secret + timestamp + HMAC over the raw body.
 */
export async function requireS2SClientAuth(c: Context, next: Next) {
  const clientId = c.req.header("x-client-id");
  const rawSecret = c.req.header("x-client-secret");
  const timestamp = c.req.header("x-timestamp");
  const signature = c.req.header("x-client-signature");

  if (!clientId || !rawSecret || !timestamp || !signature) {
    return apiError(
      c,
      401,
      "MISSING_CLIENT_SECRET",
      "x-client-id, x-client-secret, x-timestamp, x-client-signature headers are required",
    );
  }

  if (!isValidTimestamp(timestamp)) {
    return apiError(c, 401, "INVALID_TIMESTAMP", "Timestamp is too far off or invalid");
  }

  const row = await db
    .select({
      clientSecretHash: gameClients.clientSecretHash,
      environment: gameClients.environment,
      walletEnabled: gameClients.walletEnabled,
      isActive: gameClients.isActive,
    })
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row || !row.isActive) {
    return apiError(c, 403, "GAME_NOT_ALLOWED", "Unknown or inactive game client");
  }

  if (!row.clientSecretHash) {
    return apiError(c, 403, "NO_CLIENT_SECRET", "No client secret configured for this game");
  }

  if (hashClientSecret(rawSecret) !== row.clientSecretHash) {
    return apiError(c, 403, "INVALID_CLIENT_SECRET", "Client secret does not match");
  }

  const body = await c.req.text().catch(() => "");
  const expectedSignature = computeClientSignature(body, timestamp, rawSecret);
  if (signature !== expectedSignature) {
    return apiError(c, 403, "INVALID_SIGNATURE", "HMAC signature does not match");
  }

  c.set("clientId", clientId);
  c.set("environment", row.environment);
  c.set("walletEnabled", row.walletEnabled);
  c.set("rawBody", body);
  await next();
}
