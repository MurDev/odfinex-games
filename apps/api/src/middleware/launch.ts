import { createMiddleware } from "hono/factory";
import { and, eq, gt } from "drizzle-orm";
import { gameClients, launchTokens, users } from "@odfinex/db";
import type { User } from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";
import { toPublicUser } from "../lib/user.js";

export type LaunchAuthVariables = {
  user: User;
  clientId: string;
  walletEnabled: boolean;
  /** Raw request body (set by requireClientSignature for re-use in route handler) */
  rawBody?: string;
};

export const requireLaunchToken = createMiddleware<{
  Variables: LaunchAuthVariables;
}>(async (c, next) => {
  const auth = c.req.header("authorization");
  const [scheme, token] = auth?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing launch token (Bearer)");
  }

  const row = await db
    .select({
      user: users,
      clientId: launchTokens.clientId,
      walletEnabled: gameClients.walletEnabled,
    })
    .from(launchTokens)
    .innerJoin(users, eq(launchTokens.userId, users.id))
    .innerJoin(gameClients, eq(launchTokens.clientId, gameClients.clientId))
    .where(
      and(
        eq(launchTokens.tokenHash, hashToken(token)),
        gt(launchTokens.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return apiError(c, 401, "INVALID_TOKEN", "Launch token is invalid or expired");
  }

  c.set("user", toPublicUser(row.user));
  c.set("clientId", row.clientId);
  c.set("walletEnabled", row.walletEnabled);
  await next();
});
