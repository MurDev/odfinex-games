import { Hono } from "hono";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { gameClients, launchTokens, ledgerEntries, sessions } from "@odfinex/db";
import type { WalletEnvironment } from "@odfinex/shared";
import {
  WalletGrantRequestSchema,
  WalletMutationRequestSchema,
} from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";
import {
  applyLedgerMutation,
  ensureWallet,
  getBalanceCents,
} from "../lib/wallet.js";
import {
  requirePlatformSession,
  type AuthVariables,
} from "../middleware/auth.js";
import {
  requireLaunchToken,
  type LaunchAuthVariables,
} from "../middleware/launch.js";
import { requireClientSignature } from "../middleware/client-signature.js";

type LaunchEnv = { Variables: LaunchAuthVariables };
type PlatformEnv = { Variables: AuthVariables };

export const walletRoutes = new Hono();

async function resolveWalletContext(c: {
  req: {
    header: (name: string) => string | undefined;
  };
}): Promise<{ userId: string; environment: WalletEnvironment } | null> {
  const auth = c.req.header("authorization");
  const [scheme, token] = auth?.split(" ") ?? [];
  const cookie = c.req.header("cookie");

  if (scheme?.toLowerCase() === "bearer" && token) {
    const launchRow = await db
      .select({ userId: launchTokens.userId, environment: gameClients.environment })
      .from(launchTokens)
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
      return { userId: launchRow.userId, environment: launchRow.environment };
    }

    const sess = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (sess) return { userId: sess.userId, environment: "live" };
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
      if (sess) return { userId: sess.userId, environment: "live" };
    }
  }

  return null;
}

/** GET /v1/wallet — launch token OR platform session */
walletRoutes.get("/wallet", async (c) => {
  const ctx = await resolveWalletContext(c);
  if (!ctx) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing session or launch token");
  }
  const balanceCents = await getBalanceCents(ctx.userId, ctx.environment);
  return c.json({ balanceCents, currency: "HTG" as const, environment: ctx.environment });
});

const money = new Hono<LaunchEnv>();

money.post("/wallet/debit", requireLaunchToken, requireClientSignature, async (c) => {
  const user = c.get("user");
  const clientId = c.get("clientId");
  const environment = c.get("environment");
  const walletEnabled = c.get("walletEnabled");

  if (!walletEnabled) {
    return apiError(c, 403, "GAME_NOT_ALLOWED", "Wallet is disabled for this game");
  }

  const body = await c.req.json().catch(() => null);
  const parsed = WalletMutationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid debit request");
  }

  const result = await applyLedgerMutation({
    userId: user.id,
    clientId,
    environment,
    type: "debit",
    ...parsed.data,
  });

  if (!result.ok) {
    const status = result.code === "INSUFFICIENT_FUNDS" ? 402 : 409;
    return apiError(c, status, result.code, result.message);
  }

  return c.json({
    txId: result.txId,
    balanceCents: result.balanceCents,
    currency: "HTG" as const,
  });
});

money.post("/wallet/credit", requireLaunchToken, async (c) => {
  const user = c.get("user");
  const clientId = c.get("clientId");
  const environment = c.get("environment");
  const walletEnabled = c.get("walletEnabled");

  if (!walletEnabled) {
    return apiError(c, 403, "GAME_NOT_ALLOWED", "Wallet is disabled for this game");
  }

  const body = await c.req.json().catch(() => null);
  const parsed = WalletMutationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid credit request");
  }

  const result = await applyLedgerMutation({
    userId: user.id,
    clientId,
    environment,
    type: "credit",
    ...parsed.data,
  });

  if (!result.ok) {
    return apiError(c, 409, result.code, result.message);
  }

  return c.json({
    txId: result.txId,
    balanceCents: result.balanceCents,
    currency: "HTG" as const,
  });
});

walletRoutes.route("/", money);

const player = new Hono<PlatformEnv>();

player.get("/wallet/transactions", requirePlatformSession, async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 50);
  const offset = Number(c.req.query("offset") ?? 0) || 0;

  await ensureWallet(user.id, "live");

  const whereClause = and(
    eq(ledgerEntries.userId, user.id),
    eq(ledgerEntries.environment, "live"),
  );

  const items = await db
    .select()
    .from(ledgerEntries)
    .where(whereClause)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit)
    .offset(offset);

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(whereClause)
    .then((rows) => rows[0]);

  return c.json({
    items: items.map((row) => ({
      id: row.id,
      type: row.type as "debit" | "credit",
      amountCents: row.amountCents,
      balanceAfterCents: row.balanceAfterCents,
      reason: row.reason,
      clientId: row.clientId,
      environment: row.environment as WalletEnvironment,
      referenceId: row.referenceId,
      createdAt: row.createdAt.toISOString(),
    })),
    total: countRow?.count ?? 0,
  });
});

player.post("/wallet/grant", requirePlatformSession, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = WalletGrantRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid grant request");
  }

  const environment = parsed.data.environment;

  if (process.env.NODE_ENV === "production" && environment !== "sandbox") {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "grant is disabled in production for live wallets. Use environment: 'sandbox' for test funds.",
    );
  }

  const referenceId = `grant_${user.id}_${environment}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const result = await applyLedgerMutation({
    userId: user.id,
    clientId: "platform",
    environment,
    type: "credit",
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason,
    referenceId,
  });

  if (!result.ok) {
    return apiError(c, 409, result.code, result.message);
  }

  return c.json({
    txId: result.txId,
    balanceCents: result.balanceCents,
    currency: "HTG" as const,
    environment,
  });
});

walletRoutes.route("/", player);
