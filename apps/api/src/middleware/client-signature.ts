import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { gameClients } from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import {
  computeClientSignature,
  hashClientSecret,
  isValidTimestamp,
} from "../lib/signature.js";

/**
 * Game-client signature verification.
 *
 * Requires `requireLaunchToken` to have run first (sets `clientId` on context).
 *
 * Game server must send:
 *   X-Client-Secret: <raw-secret>
 *   X-Timestamp:     <unix-ms>
 *   X-Client-Signature: HMAC-SHA256(body + "." + timestamp, secret)
 */
export async function requireClientSignature(c: Context, next: Next) {
  const clientId = c.get("clientId") as string | undefined;
  if (!clientId) {
    return apiError(c, 401, "MISSING_CLIENT", "Launch token did not provide clientId");
  }

  const rawSecret = c.req.header("x-client-secret");
  const timestamp = c.req.header("x-timestamp");
  const signature = c.req.header("x-client-signature");

  if (!rawSecret || !timestamp || !signature) {
    return apiError(c, 401, "MISSING_CLIENT_SECRET", "x-client-secret, x-timestamp, x-client-signature headers are required");
  }

  if (!isValidTimestamp(timestamp)) {
    return apiError(c, 401, "INVALID_TIMESTAMP", "Timestamp is too far off or invalid");
  }

  const row = await db
    .select({ clientSecretHash: gameClients.clientSecretHash })
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row?.clientSecretHash) {
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

  await next();
}
