import { Hono } from "hono";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  like,
  notLike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  AdminNatcashSnapshotCreateSchema,
  AdminUserCreateSchema,
  AdminUserCreditSchema,
  AdminUserDebitSchema,
  AdminWithdrawalApproveRequestSchema,
} from "@odfinex/shared";
import {
  depositOrders,
  gameClients,
  ledgerEntries,
  manualDepositRequests,
  natcashBalanceSnapshots,
  paymentRailConfigs,
  rakeEvents,
  sessions,
  users,
  walletAccounts,
  withdrawalRequests,
} from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { toPublicUser } from "../lib/user.js";
import type { User, WalletEnvironment } from "@odfinex/shared";
import { applyLedgerMutation } from "../lib/wallet.js";
import { requirePlatformSession, type AuthVariables } from "../middleware/auth.js";
import { generateClientSecret } from "../lib/signature.js";
import { notifyGameWalletEvent } from "../lib/notify-game.js";
import { loadLedgerTransactionById, serializeLedgerDetail } from "../lib/ledger-detail.js";
import {
  BazikNetworkError,
  classifyWithdrawOutcome,
  getBalance as getBazikBalance,
  splitFullName,
  withdrawToMoncash,
} from "../payments/bazik.js";

type Env = { Variables: AuthVariables };

export const adminRoutes = new Hono<Env>();

/**
 * manual_deposit_request predates the dedicated deposit_order (Bazik/MonCash)
 * table: Ludolakay's own historical MonCash deposit history (from its own
 * local Bazik integration) was backfilled into this table, with ids formatted
 * "ludolakay-pd:BZK_production_...". Those rows are real MonCash deposits,
 * not NatCash — excluding them here (and counting them as MonCash below) is
 * the only way to get an accurate method split from this table.
 */
const MANUAL_DEPOSIT_BAZIK_BACKFILL_PATTERN = "%BZK%";

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

/** Block an admin from reviewing their own request unless allowSelfReview is enabled. */
async function assertNotSelf(c: Parameters<typeof requirePlatformSession>[0], targetUserId: string) {
  const admin = c.get("user");
  if (admin.id !== targetUserId) return null;
  const [dbUser] = await db
    .select({ allowSelfReview: users.allowSelfReview })
    .from(users)
    .where(eq(users.id, admin.id))
    .limit(1);
  if (!dbUser?.allowSelfReview) {
    return apiError(
      c,
      403,
      "SELF_ACTION",
      "You cannot review your own request. Ask another admin, or enable allow_self_review for your account.",
    );
  }
  return null;
}

/* ── Stats ── */

adminRoutes.get("/admin/stats", requirePlatformSession, requireAdmin, async (c) => {
  const [userCount] = await db
    .select({ count: sql<number>`count(*) filter (where not is_bot)::int` })
    .from(users);
  const [botCount] = await db
    .select({ count: sql<number>`count(*) filter (where is_bot)::int` })
    .from(users);
  const [accountCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
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
  const [pendingDeposits] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(manualDepositRequests)
    .where(eq(manualDepositRequests.status, "pending"));
  const [pendingWithdrawals] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.status, "pending"));
  const [rakeRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(rakeEvents)
    .where(eq(rakeEvents.environment, "live"));

  return c.json({
    totalAccounts: accountCount?.count ?? 0,
    totalUsers: userCount?.count ?? 0,
    totalBots: botCount?.count ?? 0,
    totalGames: gameCount?.count ?? 0,
    totalTransactions: txCount?.count ?? 0,
    totalWalletBalance: walletRow?.total ?? 0,
    totalVolumeCents: volumeRow?.total ?? 0,
    pendingDeposits: pendingDeposits?.count ?? 0,
    pendingWithdrawals: pendingWithdrawals?.count ?? 0,
    totalRakeCents: rakeRow?.total ?? 0,
  });
});

/* ── Finance dashboard ── */

adminRoutes.get("/admin/finance/rake", requirePlatformSession, requireAdmin, async (c) => {
  const [totalRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(rakeEvents)
    .where(eq(rakeEvents.environment, "live"));

  const rakeGameNameSub = db
    .select({ name: gameClients.name })
    .from(gameClients)
    .where(eq(gameClients.clientId, rakeEvents.clientId))
    .limit(1);
  const rakeGameName = sql<string | null>`${rakeGameNameSub}`;

  const byGame = await db
    .select({
      clientId: rakeEvents.clientId,
      gameName: rakeGameName,
      totalRakeCents: sql<number>`coalesce(sum(${rakeEvents.amountCents}),0)::int`,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(rakeEvents)
    .where(eq(rakeEvents.environment, "live"))
    .groupBy(rakeEvents.clientId)
    .orderBy(desc(sql`coalesce(sum(${rakeEvents.amountCents}),0)`));

  return c.json({
    totalRakeCents: totalRow?.total ?? 0,
    byGame,
  });
});

adminRoutes.get(
  "/admin/finance/bazik-balance",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    try {
      const balance = await getBazikBalance();
      return c.json(balance);
    } catch (err) {
      return apiError(
        c,
        502,
        "BAZIK_BALANCE_FAILED",
        err instanceof Error ? err.message : "Failed to fetch Bazik balance",
      );
    }
  },
);

adminRoutes.get(
  "/admin/finance/natcash-balance",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const [depositsRow] = await db
      .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
      .from(manualDepositRequests)
      .where(
        and(
          eq(manualDepositRequests.status, "approved"),
          eq(manualDepositRequests.environment, "live"),
          notLike(manualDepositRequests.id, MANUAL_DEPOSIT_BAZIK_BACKFILL_PATTERN),
        ),
      );

    const [withdrawalsRow] = await db
      .select({
        totalAmount: sql<number>`coalesce(sum(amount_cents),0)::int`,
        totalFees: sql<number>`coalesce(sum(fee_cents),0)::int`,
      })
      .from(withdrawalRequests)
      .where(
        and(
          eq(withdrawalRequests.method, "natcash"),
          eq(withdrawalRequests.status, "successful"),
          eq(withdrawalRequests.environment, "live"),
        ),
      );

    const totalDepositsCents = depositsRow?.total ?? 0;
    const totalWithdrawalsCents = withdrawalsRow?.totalAmount ?? 0;
    const totalFeesCents = withdrawalsRow?.totalFees ?? 0;
    const computedBalanceCents = totalDepositsCents - totalWithdrawalsCents - totalFeesCents;

    const [lastSnapshot] = await db
      .select()
      .from(natcashBalanceSnapshots)
      .orderBy(desc(natcashBalanceSnapshots.createdAt))
      .limit(1);

    return c.json({
      computedBalanceCents,
      totalDepositsCents,
      totalWithdrawalsCents,
      totalFeesCents,
      lastSnapshot: lastSnapshot
        ? {
            balanceCents: lastSnapshot.balanceCents,
            note: lastSnapshot.note,
            createdBy: lastSnapshot.createdBy,
            createdAt: lastSnapshot.createdAt.toISOString(),
          }
        : null,
      driftCents: lastSnapshot ? computedBalanceCents - lastSnapshot.balanceCents : null,
    });
  },
);

adminRoutes.post(
  "/admin/finance/natcash-balance/snapshot",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const body = await c.req.json().catch(() => null);
    const parsed = AdminNatcashSnapshotCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(c, 400, "INVALID_BODY", "Invalid snapshot request");
    }

    const [created] = await db
      .insert(natcashBalanceSnapshots)
      .values({
        balanceCents: parsed.data.balanceCents,
        note: parsed.data.note ?? null,
        createdBy: admin.id,
      })
      .returning();

    return c.json(
      {
        id: created!.id,
        balanceCents: created!.balanceCents,
        note: created!.note,
        createdBy: created!.createdBy,
        createdAt: created!.createdAt.toISOString(),
      },
      201,
    );
  },
);

/**
 * Bazik's stated fixed rates (confirmed by the operator): ~2.9% on MonCash
 * deposits, ~5% on MonCash withdrawals. Not a live per-transaction figure —
 * Bazik doesn't report the exact fee it kept on each transaction, so this is
 * an estimate applied to the gross totals actually processed.
 */
const BAZIK_DEPOSIT_FEE_RATE = 0.029;
const BAZIK_WITHDRAWAL_FEE_RATE = 0.05;

adminRoutes.get("/admin/finance/overview", requirePlatformSession, requireAdmin, async (c) => {
  const [moncashDepositsOrders] = await db
    .select({
      total: sql<number>`coalesce(sum(amount_cents),0)::int`,
      earliest: sql<string | null>`min(created_at)`,
    })
    .from(depositOrders)
    .where(and(eq(depositOrders.status, "successful"), eq(depositOrders.environment, "live")));

  // Ludolakay's pre-deposit_order MonCash history, backfilled into manual_deposit_request
  // (see MANUAL_DEPOSIT_BAZIK_BACKFILL_PATTERN) — real MonCash money, not NatCash.
  const [moncashDepositsBackfill] = await db
    .select({
      total: sql<number>`coalesce(sum(amount_cents),0)::int`,
      earliest: sql<string | null>`min(created_at)`,
    })
    .from(manualDepositRequests)
    .where(
      and(
        eq(manualDepositRequests.status, "approved"),
        eq(manualDepositRequests.environment, "live"),
        like(manualDepositRequests.id, MANUAL_DEPOSIT_BAZIK_BACKFILL_PATTERN),
      ),
    );

  const moncashDeposits = {
    total: (moncashDepositsOrders?.total ?? 0) + (moncashDepositsBackfill?.total ?? 0),
    earliest: [moncashDepositsOrders?.earliest, moncashDepositsBackfill?.earliest]
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null,
  };

  const [moncashWithdrawals] = await db
    .select({
      total: sql<number>`coalesce(sum(amount_cents),0)::int`,
      earliest: sql<string | null>`min(created_at)`,
    })
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.method, "moncash"),
        eq(withdrawalRequests.status, "successful"),
        eq(withdrawalRequests.environment, "live"),
      ),
    );

  const [natcashDeposits] = await db
    .select({
      total: sql<number>`coalesce(sum(amount_cents),0)::int`,
      earliest: sql<string | null>`min(created_at)`,
    })
    .from(manualDepositRequests)
    .where(
      and(
        eq(manualDepositRequests.status, "approved"),
        eq(manualDepositRequests.environment, "live"),
        notLike(manualDepositRequests.id, MANUAL_DEPOSIT_BAZIK_BACKFILL_PATTERN),
      ),
    );

  const [natcashWithdrawals] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(amount_cents),0)::int`,
      totalFees: sql<number>`coalesce(sum(fee_cents),0)::int`,
      earliest: sql<string | null>`min(created_at)`,
    })
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.method, "natcash"),
        eq(withdrawalRequests.status, "successful"),
        eq(withdrawalRequests.environment, "live"),
      ),
    );

  const [rakeRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(rakeEvents)
    .where(eq(rakeEvents.environment, "live"));

  // Referral commissions are a real cost (money paid out to referrers) that never
  // shows up as a debit anywhere else — each game credits it directly via S2S.
  const [referralRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.type, "credit"),
        eq(ledgerEntries.environment, "live"),
        ilike(ledgerEntries.category, "%referral%"),
      ),
    );

  const totalMoncashDepositsCents = moncashDeposits?.total ?? 0;
  const totalMoncashWithdrawalsCents = moncashWithdrawals?.total ?? 0;
  const totalNatcashDepositsCents = natcashDeposits?.total ?? 0;
  const totalNatcashWithdrawalsCents = natcashWithdrawals?.totalAmount ?? 0;
  const totalNatcashFeesCents = natcashWithdrawals?.totalFees ?? 0;
  const totalRakeCents = rakeRow?.total ?? 0;
  const totalReferralCommissionsCents = referralRow?.total ?? 0;

  const estimatedBazikDepositFeesCents = Math.round(totalMoncashDepositsCents * BAZIK_DEPOSIT_FEE_RATE);
  const estimatedBazikWithdrawalFeesCents = Math.round(
    totalMoncashWithdrawalsCents * BAZIK_WITHDRAWAL_FEE_RATE,
  );

  const netProfitCents =
    totalRakeCents -
    totalReferralCommissionsCents -
    estimatedBazikDepositFeesCents -
    estimatedBazikWithdrawalFeesCents -
    totalNatcashFeesCents;

  const toIso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);

  return c.json({
    totalMoncashDepositsCents,
    totalMoncashWithdrawalsCents,
    totalNatcashDepositsCents,
    totalNatcashWithdrawalsCents,
    totalNatcashFeesCents,
    estimatedBazikDepositFeesCents,
    estimatedBazikWithdrawalFeesCents,
    totalRakeCents,
    totalReferralCommissionsCents,
    netProfitCents,
    trackedSince: {
      moncashDeposits: toIso(moncashDeposits?.earliest),
      moncashWithdrawals: toIso(moncashWithdrawals?.earliest),
      natcashDeposits: toIso(natcashDeposits?.earliest),
      natcashWithdrawals: toIso(natcashWithdrawals?.earliest),
    },
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

      const [rake] = await db
        .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
        .from(rakeEvents)
        .where(eq(rakeEvents.clientId, g.clientId));

      return {
        clientId: g.clientId,
        name: g.name,
        environment: g.environment as WalletEnvironment,
        launchUrl: g.launchUrl,
        redirectUrls: g.redirectUrls,
        notifyUrl: g.notifyUrl,
        hidden: g.hidden,
        isActive: g.isActive,
        walletEnabled: g.walletEnabled,
        hasClientSecret: !!g.clientSecretHash,
        createdAt: g.createdAt.toISOString(),
        playerCount: playerCount?.count ?? 0,
        totalDebits: debits?.total ?? 0,
        totalCredits: credits?.total ?? 0,
        volumeCents: (debits?.total ?? 0) + (credits?.total ?? 0),
        totalRakeCents: rake?.total ?? 0,
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

  const [rake] = await db
    .select({ total: sql<number>`coalesce(sum(amount_cents),0)::int` })
    .from(rakeEvents)
    .where(eq(rakeEvents.clientId, clientId));

  return c.json({
    clientId: game.clientId,
    name: game.name,
    environment: game.environment as WalletEnvironment,
    launchUrl: game.launchUrl,
    redirectUrls: game.redirectUrls,
    isActive: game.isActive,
    walletEnabled: game.walletEnabled,
    hidden: game.hidden,
    notifyUrl: game.notifyUrl,
    hasClientSecret: !!game.clientSecretHash,
    createdAt: game.createdAt.toISOString(),
    playerCount: playerCount?.count ?? 0,
    totalDebits: debits?.total ?? 0,
    totalCredits: credits?.total ?? 0,
    volumeCents: (debits?.total ?? 0) + (credits?.total ?? 0),
    totalRakeCents: rake?.total ?? 0,
  });
});

adminRoutes.patch("/admin/games/:clientId", requirePlatformSession, requireAdmin, async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError(c, 400, "INVALID_BODY", "Invalid request body");
  }

  const allowed = ["name", "launchUrl", "redirectUrls", "isActive", "walletEnabled", "hidden", "notifyUrl"];
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
  const typeFilter = c.req.query("type"); // human | bot
  const roleFilter = c.req.query("role"); // admin | player
  const sort = c.req.query("sort") ?? "date_desc";
  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 50);
  const offset = Number(c.req.query("offset") ?? 0) || 0;

  let conditions = undefined;
  if (search) {
    conditions = or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`));
  }
  if (typeFilter === "bot") {
    conditions = and(conditions, eq(users.isBot, true));
  } else if (typeFilter === "human") {
    conditions = and(conditions, eq(users.isBot, false));
  }
  if (roleFilter === "admin") {
    conditions = and(conditions, eq(users.isAdmin, true));
  } else if (roleFilter === "player") {
    conditions = and(conditions, eq(users.isAdmin, false));
  }

  const liveBalanceCondition = and(
    eq(walletAccounts.userId, users.id),
    eq(walletAccounts.environment, "live"),
  );
  const balanceSub = db
    .select({ v: walletAccounts.balanceCents })
    .from(walletAccounts)
    .where(liveBalanceCondition)
    .limit(1);
  const bonusSub = db
    .select({ v: walletAccounts.bonusCents })
    .from(walletAccounts)
    .where(liveBalanceCondition)
    .limit(1);

  const balanceCents = sql<number>`coalesce(${balanceSub}, 0)`;
  const bonusCents = sql<number>`coalesce(${bonusSub}, 0)`;
  const transactionCount = db.$count(ledgerEntries, eq(ledgerEntries.userId, users.id));

  const orderBy: SQL =
    sort === "date_asc"
      ? asc(users.createdAt)
      : sort === "balance_desc"
        ? desc(balanceCents)
        : sort === "balance_asc"
          ? asc(balanceCents)
          : sort === "transactions_desc"
            ? desc(transactionCount)
            : sort === "transactions_asc"
              ? asc(transactionCount)
              : sort === "name_asc"
                ? asc(users.name)
                : sort === "name_desc"
                  ? desc(users.name)
                  : desc(users.createdAt);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      isAdmin: users.isAdmin,
      isBot: users.isBot,
      createdAt: users.createdAt,
      balanceCents,
      bonusCents,
      transactionCount,
    })
    .from(users)
    .where(conditions)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: count() })
    .from(users)
    .where(conditions);

  const players = rows.map((u) => ({
    id: u.id,
    displayName: u.name,
    email: u.email,
    avatarUrl: u.image,
    isAdmin: u.isAdmin,
    isBot: u.isBot,
    createdAt: u.createdAt.toISOString(),
    balanceCents: u.balanceCents ?? 0,
    bonusCents: u.bonusCents ?? 0,
    transactionCount: u.transactionCount ?? 0,
  }));

  return c.json({ players, total: totalRow?.count ?? 0 });
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

  const gameName = user.clientId
    ? await db
        .select({ name: gameClients.name })
        .from(gameClients)
        .where(eq(gameClients.clientId, user.clientId))
        .limit(1)
        .then((rows) => rows[0]?.name ?? null)
    : null;

  const walletRows = await db
    .select({
      balanceCents: walletAccounts.balanceCents,
      bonusCents: walletAccounts.bonusCents,
      environment: walletAccounts.environment,
    })
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, id));

  const live =
    walletRows.find((r) => r.environment === "live")?.balanceCents ?? 0;
  const liveBonus =
    walletRows.find((r) => r.environment === "live")?.bonusCents ?? 0;
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
      isBot: user.isBot ?? false,
      clientId: user.clientId,
      gameName,
      createdAt: user.createdAt.toISOString(),
      balanceCents: live,
      sandboxBalanceCents: sandbox,
      bonusCents: liveBonus,
      transactionCount: txCount?.count ?? 0,
    },
    transactions: txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountCents: tx.amountCents,
      balanceAfterCents: tx.balanceAfterCents,
      bonusCents: tx.bonusCents,
      category: tx.category,
      actorId: tx.actorId,
      reason: tx.reason,
      clientId: tx.clientId,
      environment: tx.environment as WalletEnvironment,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
    })),
  });
});

/* ── Users (admin provisioning: bots, operator accounts) ── */

adminRoutes.get("/admin/accounts", requirePlatformSession, requireAdmin, async (c) => {
  const search = c.req.query("search")?.trim() ?? "";
  const game = c.req.query("game");
  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 50);
  const offset = Number(c.req.query("offset") ?? 0) || 0;

  let conditions = or(eq(users.isBot, true), isNotNull(users.clientId));
  if (search) {
    conditions = and(conditions, or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)));
  }
  if (game) {
    conditions = and(conditions, eq(users.clientId, game));
  }

  const liveBalanceCondition = and(
    eq(walletAccounts.userId, users.id),
    eq(walletAccounts.environment, "live"),
  );
  const balanceSub = db
    .select({ v: walletAccounts.balanceCents })
    .from(walletAccounts)
    .where(liveBalanceCondition)
    .limit(1);
  const bonusSub = db
    .select({ v: walletAccounts.bonusCents })
    .from(walletAccounts)
    .where(liveBalanceCondition)
    .limit(1);
  const balanceCents = sql<number>`coalesce(${balanceSub}, 0)`;
  const bonusCents = sql<number>`coalesce(${bonusSub}, 0)`;
  const transactionCount = db.$count(ledgerEntries, eq(ledgerEntries.userId, users.id));
  const ownerGame = db
    .select({ name: gameClients.name })
    .from(gameClients)
    .where(eq(gameClients.clientId, users.clientId))
    .limit(1);
  const gameName = sql<string>`${ownerGame}`;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isBot: users.isBot,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      createdAt: users.createdAt,
      balanceCents,
      bonusCents,
      transactionCount,
      gameName,
    })
    .from(users)
    .where(conditions)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: count() })
    .from(users)
    .where(conditions);

  return c.json({
    accounts: rows.map((u) => ({
      id: u.id,
      displayName: u.name,
      email: u.email,
      isBot: u.isBot,
      isAdmin: u.isAdmin,
      clientId: u.clientId,
      gameName: u.gameName ?? null,
      balanceCents: u.balanceCents ?? 0,
      bonusCents: u.bonusCents ?? 0,
      transactionCount: u.transactionCount ?? 0,
      createdAt: u.createdAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
  });
});

adminRoutes.post("/admin/users", requirePlatformSession, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AdminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "name and a unique email are required");
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (parsed.data.isBot && !parsed.data.clientId) {
    return apiError(c, 400, "CLIENT_ID_REQUIRED", "clientId is required for bot accounts");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (existing) {
    return apiError(c, 409, "EMAIL_EXISTS", "A user with this email already exists");
  }

  if (parsed.data.clientId) {
    const owner = await db
      .select({ clientId: gameClients.clientId })
      .from(gameClients)
      .where(eq(gameClients.clientId, parsed.data.clientId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!owner) {
      return apiError(c, 404, "GAME_NOT_FOUND", `Unknown clientId: ${parsed.data.clientId}`);
    }
  }

  const [created] = await db
    .insert(users)
    .values({
      name: parsed.data.name.trim(),
      email,
      isBot: parsed.data.isBot,
      isAdmin: parsed.data.isAdmin,
      clientId: parsed.data.clientId ?? null,
    })
    .returning();

  if (!created) {
    return apiError(c, 500, "CREATE_FAILED", "Failed to create user");
  }

  return c.json(
    {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        isBot: created.isBot,
        isAdmin: created.isAdmin,
        createdAt: created.createdAt.toISOString(),
      },
    },
    201,
  );
});

/** Admin credit to any user's live wallet (e.g. fund bots). */
adminRoutes.post("/admin/users/:id/credit", requirePlatformSession, requireAdmin, async (c) => {
  const id = c.req.param("id");
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!target) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found");
  }

  const selfError = await assertNotSelf(c, id);
  if (selfError) return selfError;

  const body = await c.req.json().catch(() => null);
  const parsed = AdminUserCreditSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "amountCents (positive int) is required");
  }

  const category = parsed.data.category ?? "admin_investment";

  if (category === "depot_manual" && !parsed.data.referenceId?.trim()) {
    return apiError(
      c,
      400,
      "REFERENCE_REQUIRED",
      "A unique referenceId is required for a manual deposit (depot_manual)",
    );
  }

  const referenceId =
    parsed.data.referenceId ?? `admin_credit_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await applyLedgerMutation({
    userId: id,
    clientId: "platform",
    environment: "live",
    type: "credit",
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason ?? category,
    referenceId,
    bonusCents: category === "bonus" ? parsed.data.amountCents : 0,
    actorId: c.get("user").id,
  });

  if (!result.ok) {
    return apiError(c, 409, result.code, result.message);
  }

  return c.json({
    txId: result.txId,
    balanceCents: result.balanceCents,
    bonusCents: result.bonusCents,
    currency: "HTG" as const,
    replay: result.replay,
  });
});

adminRoutes.post("/admin/users/:id/debit", requirePlatformSession, requireAdmin, async (c) => {
  const id = c.req.param("id");
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!target) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found");
  }

  const selfError = await assertNotSelf(c, id);
  if (selfError) return selfError;

  const body = await c.req.json().catch(() => null);
  const parsed = AdminUserDebitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "amountCents (positive int) is required");
  }

  const referenceId =
    parsed.data.referenceId ?? `admin_debit_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const category = parsed.data.category ?? "admin_debit";
  const result = await applyLedgerMutation({
    userId: id,
    clientId: "platform",
    environment: "live",
    type: "debit",
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason ?? category,
    referenceId,
    actorId: c.get("user").id,
  });

  if (!result.ok) {
    return apiError(c, 409, result.code, result.message);
  }

  return c.json({
    txId: result.txId,
    balanceCents: result.balanceCents,
    bonusCents: result.bonusCents,
    currency: "HTG" as const,
    replay: result.replay,
  });
});

/* ── Transactions ── */

adminRoutes.get("/admin/transactions", requirePlatformSession, requireAdmin, async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 30) || 30, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const gameFilter = c.req.query("game");
  const typeFilter = c.req.query("type");
  const playerFilter = c.req.query("player");
  const search = c.req.query("search")?.trim() ?? "";

  let conditions: SQL | undefined;
  if (gameFilter) conditions = and(conditions, eq(ledgerEntries.clientId, gameFilter));
  if (typeFilter && (typeFilter === "debit" || typeFilter === "credit")) {
    conditions = and(conditions, eq(ledgerEntries.type, typeFilter));
  }
  if (playerFilter) conditions = and(conditions, eq(ledgerEntries.userId, playerFilter));

  if (search) {
    const matched = await db
      .select({ id: users.id })
      .from(users)
      .where(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)))
      .limit(50);
    const ids = matched.map((u) => u.id);
    conditions = and(conditions, inArray(ledgerEntries.userId, ids.length ? ids : ["__none__"]));
  }

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

  const userIds = [...new Set(items.map((tx) => tx.userId))];
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  return c.json({
    items: items.map((tx) => {
      const player = userById.get(tx.userId);
      return {
        id: tx.id,
        userId: tx.userId,
        type: tx.type,
        amountCents: tx.amountCents,
        balanceAfterCents: tx.balanceAfterCents,
        bonusCents: tx.bonusCents,
        category: tx.category,
        actorId: tx.actorId,
        reason: tx.reason,
        clientId: tx.clientId,
        environment: tx.environment as WalletEnvironment,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt.toISOString(),
        displayName: player?.name ?? null,
        email: player?.email ?? null,
      };
    }),
    total: totalRow?.count ?? 0,
  });
});

adminRoutes.get("/admin/transactions/:id", requirePlatformSession, requireAdmin, async (c) => {
  const id = c.req.param("id");
  if (!id) return apiError(c, 400, "BAD_REQUEST", "id required");
  const tx = await loadLedgerTransactionById(id);
  if (!tx) return apiError(c, 404, "NOT_FOUND", "Transaction not found");
  return c.json(serializeLedgerDetail(tx));
});

/* ── Payment rails (per-method enable/config, e.g. NatCash, MonCash) ── */

adminRoutes.get("/admin/payment-rails", requirePlatformSession, requireAdmin, async (c) => {
  const environment = (c.req.query("environment") === "sandbox" ? "sandbox" : "live") as WalletEnvironment;
  const rows = await db
    .select()
    .from(paymentRailConfigs)
    .where(eq(paymentRailConfigs.environment, environment));

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      method: r.method,
      enabled: r.enabled,
      withdrawalEnabled: r.withdrawalEnabled,
      accountName: r.accountName,
      accountNumber: r.accountNumber,
      depositMinAmountCents: r.depositMinAmountCents,
      depositMaxAmountCents: r.depositMaxAmountCents,
      withdrawalMinAmountCents: r.withdrawalMinAmountCents,
      withdrawalMaxAmountCents: r.withdrawalMaxAmountCents,
      instructions: r.instructions,
      environment: r.environment,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

adminRoutes.patch("/admin/payment-rails/:id", requirePlatformSession, requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const existing = await db
    .select()
    .from(paymentRailConfigs)
    .where(eq(paymentRailConfigs.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!existing) return apiError(c, 404, "NOT_FOUND", "Payment rail not found");

  const enabled =
    typeof body.enabled === "boolean" ? body.enabled : existing.enabled;
  const withdrawalEnabled =
    typeof body.withdrawalEnabled === "boolean" ? body.withdrawalEnabled : existing.withdrawalEnabled;
  const accountName =
    typeof body.accountName === "string" ? body.accountName.trim() : existing.accountName;
  const accountNumber =
    typeof body.accountNumber === "string"
      ? body.accountNumber.trim()
      : existing.accountNumber;
  const depositMinAmountCents =
    typeof body.depositMinAmountCents === "number"
      ? body.depositMinAmountCents
      : typeof body.depositMinAmountHtg === "number"
        ? Math.round(body.depositMinAmountHtg * 100)
        : existing.depositMinAmountCents;
  const depositMaxAmountCents =
    typeof body.depositMaxAmountCents === "number"
      ? body.depositMaxAmountCents
      : typeof body.depositMaxAmountHtg === "number"
        ? Math.round(body.depositMaxAmountHtg * 100)
        : existing.depositMaxAmountCents;
  const withdrawalMinAmountCents =
    typeof body.withdrawalMinAmountCents === "number"
      ? body.withdrawalMinAmountCents
      : typeof body.withdrawalMinAmountHtg === "number"
        ? Math.round(body.withdrawalMinAmountHtg * 100)
        : existing.withdrawalMinAmountCents;
  const withdrawalMaxAmountCents =
    typeof body.withdrawalMaxAmountCents === "number"
      ? body.withdrawalMaxAmountCents
      : typeof body.withdrawalMaxAmountHtg === "number"
        ? Math.round(body.withdrawalMaxAmountHtg * 100)
        : existing.withdrawalMaxAmountCents;
  const instructions =
    typeof body.instructions === "string" ? body.instructions : existing.instructions;

  // Only manual/proof-based rails (NatCash) need a fixed destination account —
  // MonCash is the automated Bazik rail, no admin-configured account involved.
  if (existing.method === "natcash" && enabled && (!accountName || !accountNumber)) {
    return apiError(
      c,
      400,
      "INVALID_CONFIG",
      "Cannot enable NatCash without account name and number",
    );
  }

  const [updated] = await db
    .update(paymentRailConfigs)
    .set({
      enabled,
      withdrawalEnabled,
      accountName,
      accountNumber,
      depositMinAmountCents,
      depositMaxAmountCents,
      withdrawalMinAmountCents,
      withdrawalMaxAmountCents,
      instructions,
      updatedAt: new Date(),
    })
    .where(eq(paymentRailConfigs.id, id))
    .returning();

  return c.json({ item: updated });
});

/* ── Manual deposit requests ── */

adminRoutes.get("/admin/deposit-requests", requirePlatformSession, requireAdmin, async (c) => {
  const admin = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const status = c.req.query("status");

  let whereClause = undefined;
  if (status) whereClause = eq(manualDepositRequests.status, status);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(manualDepositRequests)
    .where(whereClause);

  const reviewerNameListSub = db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, manualDepositRequests.reviewedBy))
    .limit(1);
  const reviewedByNameList = sql<string | null>`${reviewerNameListSub}`;

  const gameNameListSub = db
    .select({ name: gameClients.name })
    .from(gameClients)
    .where(eq(gameClients.clientId, manualDepositRequests.clientId))
    .limit(1);
  const gameNameList = sql<string | null>`${gameNameListSub}`;

  const items = await db
    .select({
      id: manualDepositRequests.id,
      userId: manualDepositRequests.userId,
      amountCents: manualDepositRequests.amountCents,
      status: manualDepositRequests.status,
      paymentProofUrl: manualDepositRequests.paymentProofUrl,
      reference: manualDepositRequests.reference,
      adminComment: manualDepositRequests.adminComment,
      clientId: manualDepositRequests.clientId,
      environment: manualDepositRequests.environment,
      reviewedBy: manualDepositRequests.reviewedBy,
      reviewedAt: manualDepositRequests.reviewedAt,
      createdAt: manualDepositRequests.createdAt,
      updatedAt: manualDepositRequests.updatedAt,
      displayName: users.name,
      email: users.email,
      gameName: gameNameList,
      reviewedByName: reviewedByNameList,
    })
    .from(manualDepositRequests)
    .leftJoin(users, eq(manualDepositRequests.userId, users.id))
    .where(whereClause)
    .orderBy(desc(manualDepositRequests.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    items: items.map((r) => ({
      ...r,
      isSelf: r.userId === admin.id,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
  });
});

adminRoutes.get(
  "/admin/deposit-requests/:id",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const id = c.req.param("id");

    const reviewerNameSub = db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, manualDepositRequests.reviewedBy))
      .limit(1);
    const reviewedByName = sql<string | null>`${reviewerNameSub}`;

    const gameNameSub = db
      .select({ name: gameClients.name })
      .from(gameClients)
      .where(eq(gameClients.clientId, manualDepositRequests.clientId))
      .limit(1);
    const gameName = sql<string | null>`${gameNameSub}`;

    const row = await db
      .select({
        id: manualDepositRequests.id,
        userId: manualDepositRequests.userId,
        amountCents: manualDepositRequests.amountCents,
        status: manualDepositRequests.status,
        paymentProofUrl: manualDepositRequests.paymentProofUrl,
        reference: manualDepositRequests.reference,
        adminComment: manualDepositRequests.adminComment,
        clientId: manualDepositRequests.clientId,
        environment: manualDepositRequests.environment,
        reviewedBy: manualDepositRequests.reviewedBy,
        reviewedAt: manualDepositRequests.reviewedAt,
        createdAt: manualDepositRequests.createdAt,
        updatedAt: manualDepositRequests.updatedAt,
        displayName: users.name,
        email: users.email,
        gameName,
        reviewedByName,
      })
      .from(manualDepositRequests)
      .leftJoin(users, eq(manualDepositRequests.userId, users.id))
      .where(eq(manualDepositRequests.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return apiError(c, 404, "NOT_FOUND", "Deposit request not found");

    const ledgerEntry = await db
      .select({
        id: ledgerEntries.id,
        amountCents: ledgerEntries.amountCents,
        balanceAfterCents: ledgerEntries.balanceAfterCents,
        referenceId: ledgerEntries.referenceId,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.referenceId, `mdep_${row.id}`))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return c.json({
      request: {
        ...row,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        isSelf: row.userId === admin.id,
      },
      ledgerEntry: ledgerEntry
        ? { ...ledgerEntry, createdAt: ledgerEntry.createdAt.toISOString() }
        : null,
    });
  },
);

adminRoutes.post(
  "/admin/deposit-requests/:id/approve",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const id = c.req.param("id");
    const row = await db
      .select()
      .from(manualDepositRequests)
      .where(eq(manualDepositRequests.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return apiError(c, 404, "NOT_FOUND", "Deposit request not found");
    if (row.status !== "pending") {
      return apiError(c, 409, "NOT_PENDING", "Request is not pending");
    }

    const selfError = await assertNotSelf(c, row.userId);
    if (selfError) return selfError;

    const credit = await applyLedgerMutation({
      userId: row.userId,
      clientId: "platform",
      environment: row.environment as WalletEnvironment,
      type: "credit",
      amountCents: row.amountCents,
      reason: "natcash_deposit",
      referenceId: `mdep_${row.id}`,
    });
    if (!credit.ok) {
      return apiError(c, 409, credit.code, credit.message);
    }

    await db
      .update(manualDepositRequests)
      .set({
        status: "approved",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualDepositRequests.id, id));

    await notifyGameWalletEvent(row.clientId, {
      type: "deposit_request",
      requestId: row.id,
      userId: row.userId,
      status: "approved",
      amountCents: row.amountCents,
      method: "natcash",
    });

    return c.json({ id, status: "approved", balanceCents: credit.balanceCents });
  },
);

adminRoutes.post(
  "/admin/deposit-requests/:id/reject",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const comment =
      typeof body.comment === "string" ? body.comment.trim() : "";

    const row = await db
      .select()
      .from(manualDepositRequests)
      .where(eq(manualDepositRequests.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return apiError(c, 404, "NOT_FOUND", "Deposit request not found");
    if (row.status !== "pending") {
      return apiError(c, 409, "NOT_PENDING", "Request is not pending");
    }

    const selfError = await assertNotSelf(c, row.userId);
    if (selfError) return selfError;

    await db
      .update(manualDepositRequests)
      .set({
        status: "rejected",
        adminComment: comment || null,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualDepositRequests.id, id));

    await notifyGameWalletEvent(row.clientId, {
      type: "deposit_request",
      requestId: row.id,
      userId: row.userId,
      status: "rejected",
      amountCents: row.amountCents,
      method: "natcash",
    });

    return c.json({ id, status: "rejected" });
  },
);

/* ── Withdrawal requests ── */

adminRoutes.get("/admin/withdrawal-requests", requirePlatformSession, requireAdmin, async (c) => {
  const admin = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const status = c.req.query("status");

  let whereClause = undefined;
  if (status) whereClause = eq(withdrawalRequests.status, status);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalRequests)
    .where(whereClause);

  const reviewerNameListSub = db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, withdrawalRequests.reviewedBy))
    .limit(1);
  const reviewedByNameList = sql<string | null>`${reviewerNameListSub}`;

  const gameNameListSub = db
    .select({ name: gameClients.name })
    .from(gameClients)
    .where(eq(gameClients.clientId, withdrawalRequests.clientId))
    .limit(1);
  const gameNameList = sql<string | null>`${gameNameListSub}`;

  const items = await db
    .select({
      id: withdrawalRequests.id,
      userId: withdrawalRequests.userId,
      amountCents: withdrawalRequests.amountCents,
      method: withdrawalRequests.method,
      account: withdrawalRequests.account,
      accountName: withdrawalRequests.accountName,
      phone: withdrawalRequests.phone,
      status: withdrawalRequests.status,
      adminComment: withdrawalRequests.adminComment,
      clientId: withdrawalRequests.clientId,
      environment: withdrawalRequests.environment,
      referenceId: withdrawalRequests.referenceId,
      providerTxId: withdrawalRequests.providerTxId,
      feeCents: withdrawalRequests.feeCents,
      reviewedBy: withdrawalRequests.reviewedBy,
      reviewedAt: withdrawalRequests.reviewedAt,
      createdAt: withdrawalRequests.createdAt,
      completedAt: withdrawalRequests.completedAt,
      displayName: users.name,
      email: users.email,
      gameName: gameNameList,
      reviewedByName: reviewedByNameList,
    })
    .from(withdrawalRequests)
    .leftJoin(users, eq(withdrawalRequests.userId, users.id))
    .where(whereClause)
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    items: items.map((r) => ({
      ...r,
      isSelf: r.userId === admin.id,
      account: r.account || r.phone,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
    total: totalRow?.count ?? 0,
  });
});

adminRoutes.get(
  "/admin/withdrawal-requests/:id",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const id = c.req.param("id");

    const reviewerNameSub = db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, withdrawalRequests.reviewedBy))
      .limit(1);
    const reviewedByName = sql<string | null>`${reviewerNameSub}`;

    const gameNameSub = db
      .select({ name: gameClients.name })
      .from(gameClients)
      .where(eq(gameClients.clientId, withdrawalRequests.clientId))
      .limit(1);
    const gameName = sql<string | null>`${gameNameSub}`;

    const row = await db
      .select({
        id: withdrawalRequests.id,
        userId: withdrawalRequests.userId,
        amountCents: withdrawalRequests.amountCents,
        method: withdrawalRequests.method,
        account: withdrawalRequests.account,
        accountName: withdrawalRequests.accountName,
        phone: withdrawalRequests.phone,
        status: withdrawalRequests.status,
        adminComment: withdrawalRequests.adminComment,
        clientId: withdrawalRequests.clientId,
        environment: withdrawalRequests.environment,
        referenceId: withdrawalRequests.referenceId,
        providerTxId: withdrawalRequests.providerTxId,
        feeCents: withdrawalRequests.feeCents,
        reviewedBy: withdrawalRequests.reviewedBy,
        reviewedAt: withdrawalRequests.reviewedAt,
        createdAt: withdrawalRequests.createdAt,
        completedAt: withdrawalRequests.completedAt,
        displayName: users.name,
        email: users.email,
        gameName,
        reviewedByName,
      })
      .from(withdrawalRequests)
      .leftJoin(users, eq(withdrawalRequests.userId, users.id))
      .where(or(eq(withdrawalRequests.id, id), eq(withdrawalRequests.referenceId, id)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return apiError(c, 404, "NOT_FOUND", "Withdrawal request not found");

    const ledgerRows = await db
      .select({
        id: ledgerEntries.id,
        type: ledgerEntries.type,
        amountCents: ledgerEntries.amountCents,
        balanceAfterCents: ledgerEntries.balanceAfterCents,
        reason: ledgerEntries.reason,
        referenceId: ledgerEntries.referenceId,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(
        inArray(ledgerEntries.referenceId, [
          row.referenceId,
          `refund_${row.referenceId}`,
          `reject_${row.referenceId}`,
        ]),
      )
      .orderBy(asc(ledgerEntries.createdAt));

    return c.json({
      request: {
        ...row,
        account: row.account || row.phone,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        isSelf: row.userId === admin.id,
      },
      ledgerEntries: ledgerRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  },
);

adminRoutes.post(
  "/admin/withdrawal-requests/:id/approve",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const id = c.req.param("id");
    const row = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return apiError(c, 404, "NOT_FOUND", "Withdrawal request not found");
    if (row.status !== "pending") {
      return apiError(c, 409, "NOT_PENDING", "Request is not pending");
    }

    const selfError = await assertNotSelf(c, row.userId);
    if (selfError) return selfError;

    const account = row.account || row.phone;
    const method = row.method || "moncash";

    if (method === "natcash") {
      const body = await c.req.json().catch(() => null);
      const parsed = AdminWithdrawalApproveRequestSchema.safeParse(body ?? {});
      if (!parsed.success || parsed.data.feeCents == null) {
        return apiError(
          c,
          400,
          "FEE_REQUIRED",
          "feeCents is required to approve a natcash withdrawal (the real NatCash P2P transfer fee you paid)",
        );
      }

      await db
        .update(withdrawalRequests)
        .set({
          status: "successful",
          feeCents: parsed.data.feeCents,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, id));

      await notifyGameWalletEvent(row.clientId, {
        type: "withdrawal_request",
        requestId: row.id,
        userId: row.userId,
        status: "successful",
        amountCents: row.amountCents,
        method,
      });

      return c.json({ id, status: "successful", manual: true });
    }

    // MonCash via Bazik
    await db
      .update(withdrawalRequests)
      .set({ status: "processing", reviewedBy: admin.id, reviewedAt: new Date() })
      .where(eq(withdrawalRequests.id, id));

    const userRow = await db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const names = splitFullName(userRow?.name ?? userRow?.email ?? "Player");

    try {
      const payout = await withdrawToMoncash({
        gdes: row.amountCents / 100,
        wallet: account,
        ...names,
        referenceId: row.referenceId,
        description: "Odfinex Games withdrawal",
        customerEmail: userRow?.email ?? undefined,
      });

      const outcome = classifyWithdrawOutcome(payout.status, payout.transactionId);
      if (outcome === "failed") {
        await applyLedgerMutation({
          userId: row.userId,
          clientId: "platform",
          environment: row.environment as WalletEnvironment,
          type: "credit",
          amountCents: row.amountCents,
          reason: "moncash_withdraw_refund",
          referenceId: `refund_${row.referenceId}`,
        });
        await db
          .update(withdrawalRequests)
          .set({
            status: "failed",
            completedAt: new Date(),
            providerTxId: payout.transactionId,
            adminComment: "Provider payout failed",
          })
          .where(eq(withdrawalRequests.id, id));

        await notifyGameWalletEvent(row.clientId, {
          type: "withdrawal_request",
          requestId: row.id,
          userId: row.userId,
          status: "failed",
          amountCents: row.amountCents,
          method,
        });

        return apiError(c, 502, "WITHDRAW_FAILED", "MonCash payout failed; balance refunded");
      }

      if (outcome === "ambiguous") {
        await db
          .update(withdrawalRequests)
          .set({ status: "processing", providerTxId: payout.transactionId })
          .where(eq(withdrawalRequests.id, id));
        return c.json({
          id,
          status: "processing",
          warning: "Provider response ambiguous — verify before retrying",
          providerTxId: payout.transactionId,
        });
      }

      await db
        .update(withdrawalRequests)
        .set({
          status: "successful",
          completedAt: new Date(),
          providerTxId: payout.transactionId,
        })
        .where(eq(withdrawalRequests.id, id));

      await notifyGameWalletEvent(row.clientId, {
        type: "withdrawal_request",
        requestId: row.id,
        userId: row.userId,
        status: "successful",
        amountCents: row.amountCents,
        method,
      });

      return c.json({
        id,
        status: "successful",
        providerTxId: payout.transactionId,
        dryRun: payout.dryRun ?? false,
      });
    } catch (err) {
      console.error("[admin withdraw approve] provider error", err);

      if (err instanceof BazikNetworkError) {
        // We never got a response — Bazik may have processed the payout anyway.
        // Do NOT auto-refund: that would risk paying the player twice (MonCash
        // payout + wallet refund). Leave it "processing" for manual reconciliation,
        // same as a classified "ambiguous" outcome.
        await db
          .update(withdrawalRequests)
          .set({
            status: "processing",
            adminComment: `Network/timeout error contacting Bazik, outcome unknown: ${err.message}`,
          })
          .where(eq(withdrawalRequests.id, id));

        await notifyGameWalletEvent(row.clientId, {
          type: "withdrawal_request",
          requestId: row.id,
          userId: row.userId,
          status: "processing",
          amountCents: row.amountCents,
          method,
        });

        return apiError(
          c,
          502,
          "WITHDRAW_AMBIGUOUS",
          "Could not confirm the payout with Bazik (network error or timeout). Balance was NOT refunded automatically — verify with Bazik support before retrying or refunding manually.",
        );
      }

      // Bazik gave us a definite HTTP-level rejection (or another non-network
      // error) — safe to treat as a real failure and refund.
      await applyLedgerMutation({
        userId: row.userId,
        clientId: "platform",
        environment: row.environment as WalletEnvironment,
        type: "credit",
        amountCents: row.amountCents,
        reason: "moncash_withdraw_refund",
        referenceId: `refund_${row.referenceId}`,
      });
      await db
        .update(withdrawalRequests)
        .set({ status: "failed", completedAt: new Date(), adminComment: "Provider error" })
        .where(eq(withdrawalRequests.id, id));
      return apiError(
        c,
        502,
        "PAYMENT_PROVIDER_ERROR",
        err instanceof Error ? err.message : "Withdraw failed",
      );
    }
  },
);

adminRoutes.post(
  "/admin/withdrawal-requests/:id/reject",
  requirePlatformSession,
  requireAdmin,
  async (c) => {
    const admin = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const comment =
      typeof body.comment === "string" && body.comment.trim()
        ? body.comment.trim()
        : null;
    if (!comment) {
      return apiError(c, 400, "COMMENT_REQUIRED", "Rejection reason is required");
    }

    const row = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!row) return apiError(c, 404, "NOT_FOUND", "Withdrawal request not found");
    if (row.status !== "pending") {
      return apiError(c, 409, "NOT_PENDING", "Request is not pending");
    }

    const selfError = await assertNotSelf(c, row.userId);
    if (selfError) return selfError;

    await applyLedgerMutation({
      userId: row.userId,
      clientId: "platform",
      environment: row.environment as WalletEnvironment,
      type: "credit",
      amountCents: row.amountCents,
      reason: `${row.method}_withdraw_reject_refund`,
      referenceId: `reject_${row.referenceId}`,
    });

    await db
      .update(withdrawalRequests)
      .set({
        status: "failed",
        adminComment: comment,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, id));

    await notifyGameWalletEvent(row.clientId, {
      type: "withdrawal_request",
      requestId: row.id,
      userId: row.userId,
      status: "failed",
      amountCents: row.amountCents,
      method: row.method,
    });

    return c.json({ id, status: "failed" });
  },
);