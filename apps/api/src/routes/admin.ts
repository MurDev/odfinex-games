import { Hono } from "hono";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  gameClients,
  ledgerEntries,
  sessions,
  users,
  walletAccounts,
} from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { toPublicUser } from "../lib/user.js";
import type { User, WalletEnvironment } from "@odfinex/shared";
import { requirePlatformSession, type AuthVariables } from "../middleware/auth.js";
import { generateClientSecret } from "../lib/signature.js";

type Env = { Variables: AuthVariables };

export const adminRoutes = new Hono<Env>();

/* ── Admin gate ── */

async function requireAdmin(c: Parameters<typeof requirePlatformSession>[0], next: () => Promise<void>) {
  const user = c.get("user");
  const dbUser = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!dbUser?.isAdmin) {
    return apiError(c, 403, "FORBIDDEN", "Admin access required");
  }
  await next();
}

/* ── Stats ── */

adminRoutes.get("/admin/stats", requirePlatformSession, requireAdmin, async (c) => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [gameCount] = await db
    .select({ count: sql<number>`count(distinct name)::int` })
    .from(gameClients);
  const [txCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerEntries);
  const [walletRow] = await db
    .select({ total: sql<number>`coalesce(sum(balance_cents),0)::int` })
    .from(walletAccounts)
    .where(eq(walletAccounts.environment, "live"));
  const [volumeRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(ledgerEntries);

  return c.json({
    totalUsers: userCount?.count ?? 0,
    totalGames: gameCount?.count ?? 0,
    totalTransactions: txCount?.count ?? 0,
    totalWalletBalance: walletRow?.total ?? 0,
    totalVolumeCents: volumeRow?.total ?? 0,
  });
});

/* ── Games ── */

adminRoutes.get("/admin/games", requirePlatformSession, requireAdmin, async (c) => {
  const allGames = await db.select().from(gameClients).orderBy(gameClients.createdAt);

  const gamesWithStats = await Promise.all(
    allGames.map(async (g) => {
      const [playerCount] = await db
        .select({ count: sql<number>`count(distinct user_id)::int` })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.clientId, g.clientId));

      const [debits] = await db
        .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.clientId, g.clientId), eq(ledgerEntries.type, "debit")));

      const [credits] = await db
        .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.clientId, g.clientId), eq(ledgerEntries.type, "credit")));

      return {
        clientId: g.clientId,
        name: g.name,
        environment: g.environment as WalletEnvironment,
        launchUrl: g.launchUrl,
        isActive: g.isActive,
        walletEnabled: g.walletEnabled,
        hasClientSecret: !!g.clientSecretHash,
        createdAt: g.createdAt.toISOString(),
        playerCount: playerCount?.count ?? 0,
        totalDebits: debits?.total ?? 0,
        totalCredits: credits?.total ?? 0,
        volumeCents: (debits?.total ?? 0) + (credits?.total ?? 0),
      };
    }),
  );

  return c.json({ games: gamesWithStats });
});

adminRoutes.get("/admin/games/:clientId", requirePlatformSession, requireAdmin, async (c) => {
  const clientId = c.req.param("clientId");
  const game = await db
    .select()
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!game) return apiError(c, 404, "NOT_FOUND", "Game not found");

  const [playerCount] = await db
    .select({ count: sql<number>`count(distinct user_id)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.clientId, clientId));

  const [debits] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.clientId, clientId), eq(ledgerEntries.type, "debit")));

  const [credits] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.clientId, clientId), eq(ledgerEntries.type, "credit")));

  return c.json({
    clientId: game.clientId,
    name: game.name,
    environment: game.environment as WalletEnvironment,
    launchUrl: game.launchUrl,
    redirectUrls: game.redirectUrls,
    isActive: game.isActive,
    walletEnabled: game.walletEnabled,
    hasClientSecret: !!game.clientSecretHash,
    createdAt: game.createdAt.toISOString(),
    playerCount: playerCount?.count ?? 0,
    totalDebits: debits?.total ?? 0,
    totalCredits: credits?.total ?? 0,
    volumeCents: (debits?.total ?? 0) + (credits?.total ?? 0),
  });
});

adminRoutes.patch("/admin/games/:clientId", requirePlatformSession, requireAdmin, async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError(c, 400, "INVALID_BODY", "Invalid request body");
  }

  const allowed = ["name", "launchUrl", "redirectUrls", "isActive", "walletEnabled", "hidden"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = (body as Record<string, unknown>)[key];
  }

  if (Object.keys(updates).length === 0) {
    return apiError(c, 400, "INVALID_BODY", "No valid fields to update");
  }

  const [updated] = await db
    .update(gameClients)
    .set(updates)
    .where(eq(gameClients.clientId, clientId))
    .returning();

  if (!updated) return apiError(c, 404, "NOT_FOUND", "Game not found");

  return c.json({ game: updated });
});

adminRoutes.post("/admin/games/:clientId/rotate-secret", requirePlatformSession, requireAdmin, async (c) => {
  const clientId = c.req.param("clientId");

  const existing = await db
    .select({ id: gameClients.id })
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) return apiError(c, 404, "NOT_FOUND", "Game not found");

  const { secret, hash } = generateClientSecret();

  await db
    .update(gameClients)
    .set({ clientSecretHash: hash })
    .where(eq(gameClients.clientId, clientId));

  return c.json({
    clientId,
    clientSecret: secret,
    warning: "Save this secret now. It will not be shown again.",
  });
});

adminRoutes.post("/admin/games", requirePlatformSession, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError(c, 400, "INVALID_BODY", "Invalid request body");
  }

  const {
    slug,
    clientId: providedId,
    name,
    launchUrl,
    redirectUrls,
    isActive,
    walletEnabled,
    environment,
  } = body as {
    slug?: string;
    clientId?: string;
    name?: string;
    launchUrl?: string;
    redirectUrls?: string[];
    isActive?: boolean;
    walletEnabled?: boolean;
    environment?: WalletEnvironment;
  };

  if (!name || !launchUrl) {
    return apiError(c, 400, "INVALID_BODY", "name and launchUrl are required");
  }

  const env: WalletEnvironment =
    environment === "sandbox" || environment === "live" ? environment : "live";

  let clientId: string;
  if (providedId) {
    clientId = providedId;
  } else if (slug) {
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(slug)) {
      return apiError(c, 400, "INVALID_BODY", "slug must match [a-z0-9_-]");
    }
    clientId = `${slug}.${env}`;
  } else {
    clientId = `game_${randomBytes(4).toString("hex")}.${env}`;
  }

  const existing = await db
    .select({ id: gameClients.id })
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    return apiError(c, 409, "CONFLICT", "A game with this clientId already exists");
  }

  const [created] = await db
    .insert(gameClients)
    .values({
      clientId,
      name,
      environment: env,
      launchUrl,
      redirectUrls: redirectUrls ?? [launchUrl],
      isActive: isActive ?? true,
      walletEnabled: walletEnabled ?? false,
    })
    .returning();

  return c.json({ game: created }, 201);
});

/* ── Players ── */

adminRoutes.get("/admin/players", requirePlatformSession, requireAdmin, async (c) => {
  const search = c.req.query("search")?.trim() ?? "";
  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 50);
  const offset = Number(c.req.query("offset") ?? 0) || 0;

  let conditions = undefined;
  if (search) {
    conditions = sql`(${users.email} ilike ${`%${search}%`} or ${users.name} ilike ${`%${search}%`})`;
  }

  const allUsers = await db
    .select()
    .from(users)
    .where(conditions)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(conditions);

  const playersWithWallet = await Promise.all(
    allUsers.map(async (u) => {
      const walletRows = await db
        .select({
          balance: walletAccounts.balanceCents,
          environment: walletAccounts.environment,
        })
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, u.id));

      const live =
        walletRows.find((r) => r.environment === "live")?.balance ?? 0;
      const sandbox =
        walletRows.find((r) => r.environment === "sandbox")?.balance ?? 0;

      const [txCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, u.id));

      return {
        id: u.id,
        displayName: u.name,
        email: u.email,
        avatarUrl: u.image,
        isAdmin: u.isAdmin ?? false,
        createdAt: u.createdAt.toISOString(),
        balanceCents: live,
        sandboxBalanceCents: sandbox,
        transactionCount: txCount?.count ?? 0,
      };
    }),
  );

  return c.json({ players: playersWithWallet, total: totalRow?.count ?? 0 });
});

adminRoutes.get("/admin/players/:id", requirePlatformSession, requireAdmin, async (c) => {
  const id = c.req.param("id");
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!user) return apiError(c, 404, "NOT_FOUND", "Player not found");

  const walletRows = await db
    .select({
      balanceCents: walletAccounts.balanceCents,
      environment: walletAccounts.environment,
    })
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, id));

  const live =
    walletRows.find((r) => r.environment === "live")?.balanceCents ?? 0;
  const sandbox =
    walletRows.find((r) => r.environment === "sandbox")?.balanceCents ?? 0;

  const [txCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, id));

  const txs = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(50);

  return c.json({
    player: {
      id: user.id,
      displayName: user.name,
      email: user.email,
      avatarUrl: user.image,
      isAdmin: user.isAdmin ?? false,
      createdAt: user.createdAt.toISOString(),
      balanceCents: live,
      sandboxBalanceCents: sandbox,
      transactionCount: txCount?.count ?? 0,
    },
    transactions: txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountCents: tx.amountCents,
      balanceAfterCents: tx.balanceAfterCents,
      reason: tx.reason,
      clientId: tx.clientId,
      environment: tx.environment as WalletEnvironment,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
    })),
  });
});

/* ── Transactions ── */

adminRoutes.get("/admin/transactions", requirePlatformSession, requireAdmin, async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 30) || 30, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const gameFilter = c.req.query("game");
  const typeFilter = c.req.query("type");
  const playerFilter = c.req.query("player");

  let conditions = undefined;
  if (gameFilter) conditions = and(conditions, eq(ledgerEntries.clientId, gameFilter));
  if (typeFilter && (typeFilter === "debit" || typeFilter === "credit")) {
    conditions = and(conditions, eq(ledgerEntries.type, typeFilter));
  }
  if (playerFilter) conditions = and(conditions, eq(ledgerEntries.userId, playerFilter));

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(conditions);

  const items = await db
    .select()
    .from(ledgerEntries)
    .where(conditions)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    items: items.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amountCents: tx.amountCents,
      balanceAfterCents: tx.balanceAfterCents,
      reason: tx.reason,
      clientId: tx.clientId,
      environment: tx.environment as WalletEnvironment,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
  });
});
