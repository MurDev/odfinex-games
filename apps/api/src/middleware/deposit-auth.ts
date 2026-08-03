import { createMiddleware } from "hono/factory";
import { and, eq, gt } from "drizzle-orm";
import { gameClients, launchTokens, sessions, users } from "@odfinex/db";
import type { User, WalletEnvironment } from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";
import { toPublicUser } from "../lib/user.js";

export type DepositAuthVariables = {
  user: User;
  environment: WalletEnvironment;
  /** Origins allowed for successUrl / errorUrl redirects */
  allowedOrigins: string[];
};

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function webFallbackOrigins(): string[] {
  const web = process.env.WEB_URL ?? "http://localhost:3000";
  const o = originOf(web);
  return o ? [o] : [];
}

/**
 * Auth for player-initiated deposits: launch token (games) OR platform session (web).
 */
export const requireDepositAuth = createMiddleware<{
  Variables: DepositAuthVariables;
}>(async (c, next) => {
  const auth = c.req.header("authorization");
  const [scheme, token] = auth?.split(" ") ?? [];
  const cookie = c.req.header("cookie");

  if (scheme?.toLowerCase() === "bearer" && token) {
    const launchRow = await db
      .select({
        user: users,
        environment: gameClients.environment,
        launchUrl: gameClients.launchUrl,
        redirectUrls: gameClients.redirectUrls,
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

    if (launchRow) {
      const origins = new Set<string>();
      const launchOrigin = originOf(launchRow.launchUrl);
      if (launchOrigin) origins.add(launchOrigin);
      for (const u of launchRow.redirectUrls ?? []) {
        const o = originOf(u);
        if (o) origins.add(o);
      }
      for (const o of webFallbackOrigins()) origins.add(o);

      c.set("user", toPublicUser(launchRow.user));
      c.set("environment", launchRow.environment);
      c.set("allowedOrigins", [...origins]);
      await next();
      return;
    }

    const sess = await db
      .select({ user: users, sessionToken: sessions.sessionToken })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (sess) {
      c.set("user", toPublicUser(sess.user));
      c.set("environment", "live");
      c.set("allowedOrigins", webFallbackOrigins());
      await next();
      return;
    }
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
        .select({ user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
          and(eq(sessions.sessionToken, sessionToken), gt(sessions.expires, new Date())),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (sess) {
        c.set("user", toPublicUser(sess.user));
        c.set("environment", "live");
        c.set("allowedOrigins", webFallbackOrigins());
        await next();
        return;
      }
    }
  }

  return apiError(c, 401, "UNAUTHORIZED", "Missing launch token or platform session");
});

export function isAllowedRedirectUrl(url: string, allowedOrigins: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}
