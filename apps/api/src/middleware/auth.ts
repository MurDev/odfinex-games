import { createMiddleware } from "hono/factory";
import { and, eq, gt } from "drizzle-orm";
import { sessions, users } from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { toPublicUser } from "../lib/user.js";
import type { User } from "@odfinex/shared";

export type AuthVariables = {
  user: User;
  sessionToken: string;
};

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/** Auth.js v5 database session cookie names */
function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const names = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ];
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName && names.includes(rawName)) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export const requirePlatformSession = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const token =
    extractBearer(c.req.header("authorization")) ??
    extractSessionCookie(c.req.header("cookie"));

  if (!token) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing platform session");
  }

  const row = await db
    .select({
      user: users,
      expires: sessions.expires,
      sessionToken: sessions.sessionToken,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return apiError(c, 401, "UNAUTHORIZED", "Invalid or expired platform session");
  }

  c.set("user", toPublicUser(row.user));
  c.set("sessionToken", row.sessionToken);
  await next();
});
