import { Hono } from "hono";
import { and, eq, gt, ne } from "drizzle-orm";
import { launchTokens, sessions, users } from "@odfinex/db";
import { UpdateUsernameRequestSchema } from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";
import { requirePlatformSession, type AuthVariables } from "../middleware/auth.js";

export const meRoutes = new Hono<{ Variables: AuthVariables }>();

meRoutes.get("/me", requirePlatformSession, (c) => {
  return c.json({ user: c.get("user") });
});

/** Resolve the acting user from a launch token (game) OR a platform session (web). */
async function resolveUserId(c: {
  req: {
    header: (name: string) => string | undefined;
  };
}): Promise<string | null> {
  const auth = c.req.header("authorization");
  const [scheme, token] = auth?.split(" ") ?? [];
  const cookie = c.req.header("cookie");

  if (scheme?.toLowerCase() === "bearer" && token) {
    const launchRow = await db
      .select({ userId: launchTokens.userId })
      .from(launchTokens)
      .where(
        and(
          eq(launchTokens.tokenHash, hashToken(token)),
          gt(launchTokens.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (launchRow) return launchRow.userId;

    const sess = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (sess) return sess.userId;
  }

  if (cookie) {
    const names = [
      "authjs.session-token",
      "__Secure-authjs.session-token",
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ];
    let sessionToken: string | null = null;
    for (const part of cookie.split(";")) {
      const [rawName, ...rest] = part.trim().split("=");
      if (rawName && names.includes(rawName)) {
        sessionToken = decodeURIComponent(rest.join("="));
        break;
      }
    }
    if (sessionToken) {
      const sess = await db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(
          and(
            eq(sessions.sessionToken, sessionToken),
            gt(sessions.expires, new Date()),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (sess) return sess.userId;
    }
  }

  return null;
}

/** PATCH /v1/me/username — launch token (any game) OR platform session (web). */
meRoutes.patch("/me/username", async (c) => {
  const userId = await resolveUserId(c);
  if (!userId) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing session or launch token");
  }

  const body = await c.req.json().catch(() => null);
  const parsed = UpdateUsernameRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "INVALID_USERNAME",
      parsed.error.issues[0]?.message ?? "Invalid username",
    );
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, parsed.data.username), ne(users.id, userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (taken) {
    return apiError(c, 409, "USERNAME_TAKEN", "This username is already taken");
  }

  const [updated] = await db
    .update(users)
    .set({ username: parsed.data.username })
    .where(eq(users.id, userId))
    .returning({ username: users.username });

  if (!updated) {
    return apiError(c, 404, "NOT_FOUND", "User not found");
  }

  return c.json({ username: updated.username });
});
