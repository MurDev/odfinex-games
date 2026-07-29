import { Hono } from "hono";
import { and, eq, gt } from "drizzle-orm";
import { launchTokens, users } from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";
import { toPublicUser } from "../lib/user.js";

export const sessionRoutes = new Hono();

sessionRoutes.get("/session", async (c) => {
  const auth = c.req.header("authorization");
  const [scheme, token] = auth?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing launch token (Bearer)");
  }

  const row = await db
    .select({
      user: users,
      clientId: launchTokens.clientId,
      expiresAt: launchTokens.expiresAt,
    })
    .from(launchTokens)
    .innerJoin(users, eq(launchTokens.userId, users.id))
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

  return c.json({
    user: toPublicUser(row.user),
    clientId: row.clientId,
    expiresAt: row.expiresAt.toISOString(),
  });
});
