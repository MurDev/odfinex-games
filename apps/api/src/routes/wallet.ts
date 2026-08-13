import { Hono } from "hono";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  depositOrders,
  gameClients,
  launchTokens,
  ledgerEntries,
  manualDepositRequests,
  paymentRailConfigs,
  sessions,
  users,
  walletAccounts,
  withdrawalRequests,
} from "@odfinex/db";
import type { WalletEnvironment } from "@odfinex/shared";
import {
  ClientBalancesRequestSchema,
  ClientBotCreateRequestSchema,
  ManualDepositRequestCreateSchema,
  WalletCreditUserRequestSchema,
  WalletDepositRequestSchema,
  WalletGrantRequestSchema,
  WalletMutationRequestSchema,
  WalletWithdrawRequestSchema,
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
import {
  requireS2SClientAuth,
  type S2SClientVariables,
} from "../middleware/s2s-client.js";
import {
  isAllowedRedirectUrl,
  requireDepositAuth,
  type DepositAuthVariables,
} from "../middleware/deposit-auth.js";
import {
  createPayment,
  isBazikMock,
} from "../payments/bazik.js";
import { fulfillDeposit } from "../payments/fulfill-deposit.js";

type LaunchEnv = { Variables: LaunchAuthVariables };
type PlatformEnv = { Variables: AuthVariables };
type S2SEnv = { Variables: S2SClientVariables };
type DepositEnv = { Variables: DepositAuthVariables };

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-]/g, "");
}

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
  const { balanceCents, bonusCents } = await getBalanceCents(ctx.userId, ctx.environment);
  return c.json({
    balanceCents,
    bonusCents,
    currency: "HTG" as const,
    environment: ctx.environment,
  });
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

money.post("/wallet/credit", requireLaunchToken, requireClientSignature, async (c) => {
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

/** S2S credit to offline user (no launch token) */
const s2s = new Hono<S2SEnv>();

/**
 * A game client may only mutate wallets of users that are linked to it:
 * an active launch token for this client, existing ledger activity for this
 * client, or a provisioned account (bot/operator) owned by this client.
 */
async function isUserLinkedToClient(
  userId: string,
  clientId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(
      launchTokens,
      and(
        eq(launchTokens.userId, users.id),
        eq(launchTokens.clientId, clientId),
        gt(launchTokens.expiresAt, new Date()),
      ),
    )
    .where(
      or(
        eq(users.clientId, clientId),
        sql`EXISTS (
          SELECT 1 FROM ledger_entry le
          WHERE le.user_id = ${userId} AND le.client_id = ${clientId}
        )`,
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (row) return true;

  const launched = await db
    .select({ id: launchTokens.id })
    .from(launchTokens)
    .where(
      and(
        eq(launchTokens.userId, userId),
        eq(launchTokens.clientId, clientId),
        gt(launchTokens.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return Boolean(launched);
}

s2s.post("/wallet/credit-user", requireS2SClientAuth, async (c) => {
  const clientId = c.get("clientId");
  const environment = c.get("environment");
  const walletEnabled = c.get("walletEnabled");
  const rawBody = c.get("rawBody");

  if (!walletEnabled) {
    return apiError(c, 403, "GAME_NOT_ALLOWED", "Wallet is disabled for this game");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError(c, 400, "INVALID_BODY", "Invalid JSON body");
  }

  const parsed = WalletCreditUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid credit-user request");
  }

  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, parsed.data.platformUserId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!target) {
    return apiError(c, 404, "USER_NOT_FOUND", "platformUserId does not exist");
  }

  if (!(await isUserLinkedToClient(target.id, clientId))) {
    return apiError(
      c,
      403,
      "USER_NOT_LINKED_TO_CLIENT",
      "Target user has no relationship with this game client",
    );
  }

  const result = await applyLedgerMutation({
    userId: target.id,
    clientId,
    environment,
    type: "credit",
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason,
    referenceId: parsed.data.referenceId,
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

/** S2S debit to offline user (no launch token) — e.g. game bots, operator accounts. */
s2s.post("/wallet/debit-user", requireS2SClientAuth, async (c) => {
  const clientId = c.get("clientId");
  const environment = c.get("environment");
  const walletEnabled = c.get("walletEnabled");
  const rawBody = c.get("rawBody");

  if (!walletEnabled) {
    return apiError(c, 403, "GAME_NOT_ALLOWED", "Wallet is disabled for this game");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError(c, 400, "INVALID_BODY", "Invalid JSON body");
  }

  const parsed = WalletCreditUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid debit-user request");
  }

  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, parsed.data.platformUserId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!target) {
    return apiError(c, 404, "USER_NOT_FOUND", "platformUserId does not exist");
  }

  if (!(await isUserLinkedToClient(target.id, clientId))) {
    return apiError(
      c,
      403,
      "USER_NOT_LINKED_TO_CLIENT",
      "Target user has no relationship with this game client",
    );
  }

  const result = await applyLedgerMutation({
    userId: target.id,
    clientId,
    environment,
    type: "debit",
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason,
    referenceId: parsed.data.referenceId,
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

/** S2S read-only balance for a platform user. */
s2s.get("/client/balance", requireS2SClientAuth, async (c) => {
  const environment = c.get("environment");
  const userId = c.req.query("userId");

  if (!userId) {
    return apiError(c, 400, "MISSING_USER_ID", "userId query parameter is required");
  }

  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!target) {
    return apiError(c, 404, "USER_NOT_FOUND", "userId does not exist");
  }

  const { balanceCents, bonusCents } = await getBalanceCents(userId, environment);
  return c.json({ userId, balanceCents, bonusCents, currency: "HTG" as const });
});

/** S2S bulk read-only balances (e.g. game bots eligibility). */
s2s.post("/client/balances", requireS2SClientAuth, async (c) => {
  const environment = c.get("environment");
  const rawBody = c.get("rawBody");

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError(c, 400, "INVALID_BODY", "Invalid JSON body");
  }

  const parsed = ClientBalancesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid balances request");
  }

  const rows = await db
    .select({
      userId: walletAccounts.userId,
      balanceCents: walletAccounts.balanceCents,
      bonusCents: walletAccounts.bonusCents,
    })
    .from(walletAccounts)
    .where(
      and(
        eq(walletAccounts.environment, environment),
        inArray(walletAccounts.userId, parsed.data.userIds),
      ),
    );

  const byId = new Map(rows.map((r) => [r.userId, r]));
  return c.json({
    items: parsed.data.userIds.map((userId) => {
      const row = byId.get(userId);
      return {
        userId,
        balanceCents: row?.balanceCents ?? 0,
        bonusCents: row?.bonusCents ?? 0,
        currency: "HTG" as const,
      };
    }),
  });
});

/** S2S provisioning of a game-owned bot account (is_bot user owned by this client). */
s2s.post("/client/bots", requireS2SClientAuth, async (c) => {
  const clientId = c.get("clientId");
  const environment = c.get("environment");
  const walletEnabled = c.get("walletEnabled");
  const rawBody = c.get("rawBody");

  if (!walletEnabled) {
    return apiError(c, 403, "GAME_NOT_ALLOWED", "Wallet is disabled for this game");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError(c, 400, "INVALID_BODY", "Invalid JSON body");
  }

  const parsed = ClientBotCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid bot create request");
  }

  const slug =
    parsed.data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bot";
  const email = (parsed.data.email ?? `${slug}@${clientId}.bots`).trim().toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (existing) {
    return apiError(c, 409, "EMAIL_EXISTS", "A user with this email already exists");
  }

  const [created] = await db
    .insert(users)
    .values({
      name: parsed.data.name.trim(),
      email,
      isBot: true,
      clientId,
    })
    .returning();

  if (!created) {
    return apiError(c, 500, "CREATE_FAILED", "Failed to create bot user");
  }

  let balanceCents = 0;
  if (parsed.data.initialBalanceCents != null && parsed.data.initialBalanceCents > 0) {
    const result = await applyLedgerMutation({
      userId: created.id,
      clientId,
      environment,
      type: "credit",
      amountCents: parsed.data.initialBalanceCents,
      reason: "admin_investment",
      referenceId: `bot_seed_${created.id}`,
    });
    if (!result.ok) {
      return apiError(c, 409, result.code, result.message);
    }
    balanceCents = result.balanceCents;
  }

  return c.json(
    {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        isBot: created.isBot,
        createdAt: created.createdAt.toISOString(),
      },
      balanceCents,
    },
    201,
  );
});

/**
 * Game-admin ledger (S2S): rows for this clientId, plus platform
 * deposits/withdrawals for users who already interacted with this client.
 */
s2s.get("/client/transactions", requireS2SClientAuth, async (c) => {
  const clientId = c.get("clientId");
  const limit = Math.min(Number(c.req.query("limit") ?? 30) || 30, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const typeFilter = c.req.query("type");
  const playerFilter = c.req.query("player");

  let whereClause = and(
    sql`(
      ${ledgerEntries.clientId} = ${clientId}
      OR (
        ${ledgerEntries.clientId} = 'platform'
        AND ${ledgerEntries.userId} IN (
          SELECT user_id FROM ledger_entry WHERE client_id = ${clientId}
          UNION
          SELECT user_id FROM launch_token WHERE client_id = ${clientId}
        )
      )
    )`,
  );

  if (typeFilter === "debit" || typeFilter === "credit") {
    whereClause = and(whereClause, eq(ledgerEntries.type, typeFilter));
  }
  if (playerFilter) {
    whereClause = and(whereClause, eq(ledgerEntries.userId, playerFilter));
  }

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(whereClause);

  const items = await db
    .select({
      id: ledgerEntries.id,
      userId: ledgerEntries.userId,
      type: ledgerEntries.type,
      amountCents: ledgerEntries.amountCents,
      balanceAfterCents: ledgerEntries.balanceAfterCents,
      reason: ledgerEntries.reason,
      clientId: ledgerEntries.clientId,
      environment: ledgerEntries.environment,
      referenceId: ledgerEntries.referenceId,
      createdAt: ledgerEntries.createdAt,
      displayName: users.name,
      email: users.email,
    })
    .from(ledgerEntries)
    .leftJoin(users, eq(ledgerEntries.userId, users.id))
    .where(whereClause)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    items: items.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      displayName: tx.displayName,
      email: tx.email,
      type: tx.type as "debit" | "credit",
      amountCents: tx.amountCents,
      balanceAfterCents: tx.balanceAfterCents,
      reason: tx.reason,
      clientId: tx.clientId,
      environment: tx.environment as WalletEnvironment,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
    limit,
    offset,
  });
});

/** S2S read-only: manual NatCash deposit requests for this game's players */
s2s.get("/client/deposit-requests", requireS2SClientAuth, async (c) => {
  const clientId = c.get("clientId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const status = c.req.query("status");

  let whereClause = and(
    sql`(
      ${manualDepositRequests.clientId} = ${clientId}
      OR ${manualDepositRequests.userId} IN (
        SELECT user_id FROM ledger_entry WHERE client_id = ${clientId}
        UNION
        SELECT user_id FROM launch_token WHERE client_id = ${clientId}
        UNION
        SELECT user_id FROM manual_deposit_request WHERE client_id = ${clientId}
      )
    )`,
  );
  if (status) {
    whereClause = and(whereClause, eq(manualDepositRequests.status, status));
  }

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(manualDepositRequests)
    .where(whereClause);

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
      createdAt: manualDepositRequests.createdAt,
      updatedAt: manualDepositRequests.updatedAt,
      displayName: users.name,
      email: users.email,
    })
    .from(manualDepositRequests)
    .leftJoin(users, eq(manualDepositRequests.userId, users.id))
    .where(whereClause)
    .orderBy(desc(manualDepositRequests.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    items: items.map((r) => ({
      id: r.id,
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      amountCents: r.amountCents,
      status: r.status,
      paymentProofUrl: r.paymentProofUrl,
      reference: r.reference,
      adminComment: r.adminComment,
      clientId: r.clientId,
      environment: r.environment,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
    limit,
    offset,
  });
});

/** S2S read-only: withdrawal requests for this game's players */
s2s.get("/client/withdrawal-requests", requireS2SClientAuth, async (c) => {
  const clientId = c.get("clientId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;
  const status = c.req.query("status");

  let whereClause = and(
    sql`(
      ${withdrawalRequests.clientId} = ${clientId}
      OR ${withdrawalRequests.userId} IN (
        SELECT user_id FROM ledger_entry WHERE client_id = ${clientId}
        UNION
        SELECT user_id FROM launch_token WHERE client_id = ${clientId}
        UNION
        SELECT user_id FROM withdrawal_request WHERE client_id = ${clientId}
      )
    )`,
  );
  if (status) {
    whereClause = and(whereClause, eq(withdrawalRequests.status, status));
  }

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalRequests)
    .where(whereClause);

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
      createdAt: withdrawalRequests.createdAt,
      completedAt: withdrawalRequests.completedAt,
      displayName: users.name,
      email: users.email,
    })
    .from(withdrawalRequests)
    .leftJoin(users, eq(withdrawalRequests.userId, users.id))
    .where(whereClause)
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    items: items.map((r) => ({
      id: r.id,
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      amountCents: r.amountCents,
      method: r.method,
      account: r.account || r.phone,
      accountName: r.accountName,
      status: r.status,
      adminComment: r.adminComment,
      clientId: r.clientId,
      environment: r.environment,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
    total: totalRow?.count ?? 0,
    limit,
    offset,
  });
});

/** S2S read-only: full rail catalog for this game's environment, including disabled rails. */
s2s.get("/client/payment-rails", requireS2SClientAuth, async (c) => {
  const environment = c.get("environment");
  const rails = await db
    .select()
    .from(paymentRailConfigs)
    .where(eq(paymentRailConfigs.environment, environment));

  return c.json({
    items: rails.map((r) => ({
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
    })),
  });
});

walletRoutes.route("/", s2s);

const player = new Hono<PlatformEnv>();

/** Player ledger — launch token (game) OR platform session (web). */
walletRoutes.get("/wallet/transactions", async (c) => {
  const ctx = await resolveWalletContext(c);
  if (!ctx) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing session or launch token");
  }

  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 100);
  const offset = Number(c.req.query("offset") ?? 0) || 0;

  await ensureWallet(ctx.userId, ctx.environment);

  const whereClause = and(
    eq(ledgerEntries.userId, ctx.userId),
    eq(ledgerEntries.environment, ctx.environment),
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
      bonusCents: row.bonusCents,
      category: row.category,
      actorId: row.actorId,
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

/** Deposits — launch token (games SDK) OR platform session (odfinex-web) */
const deposit = new Hono<DepositEnv>();

deposit.post("/wallet/deposit", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const allowedOrigins = c.get("allowedOrigins");
  const body = await c.req.json().catch(() => null);
  const parsed = WalletDepositRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "INVALID_BODY",
      "Invalid deposit (amount must be a positive integer HTG, method moncash)",
    );
  }

  if (parsed.data.method !== "moncash") {
    return apiError(c, 400, "METHOD_NOT_SUPPORTED", "Only moncash deposits are supported");
  }

  const webUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const defaultSuccess = `${webUrl}/wallet/deposit/complete`;
  const defaultError = `${webUrl}/wallet?deposit=error`;
  const successUrl = parsed.data.successUrl ?? defaultSuccess;
  const errorUrl = parsed.data.errorUrl ?? defaultError;

  if (!isAllowedRedirectUrl(successUrl, allowedOrigins)) {
    return apiError(c, 400, "INVALID_SUCCESS_URL", "successUrl origin is not allowlisted for this client");
  }
  if (!isAllowedRedirectUrl(errorUrl, allowedOrigins)) {
    return apiError(c, 400, "INVALID_ERROR_URL", "errorUrl origin is not allowlisted for this client");
  }

  const amountHtg = parsed.data.amountHtg;
  const amountCents = amountHtg * 100;

  const depositRail = await db
    .select()
    .from(paymentRailConfigs)
    .where(
      and(
        eq(paymentRailConfigs.method, "moncash"),
        eq(paymentRailConfigs.environment, environment),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (
    depositRail &&
    (amountCents < depositRail.depositMinAmountCents || amountCents > depositRail.depositMaxAmountCents)
  ) {
    return apiError(
      c,
      400,
      "AMOUNT_OUT_OF_RANGE",
      `Amount must be between ${depositRail.depositMinAmountCents / 100} and ${depositRail.depositMaxAmountCents / 100} HTG`,
    );
  }

  const referenceId = `dep_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const apiPublic =
    process.env.API_URL ??
    process.env.PUBLIC_API_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null) ??
    "http://localhost:4000";
  const apiUrl = apiPublic.replace(/\/$/, "");

  let payment;
  try {
    payment = await createPayment({
      gdes: amountHtg,
      description: "Odfinex Games deposit",
      referenceId,
      successUrl,
      errorUrl,
      webhookUrl: `${apiUrl}/webhooks/bazik`,
      metadata: { userId: user.id },
    });
  } catch (err) {
    console.error("[deposit] createPayment failed", err);
    return apiError(
      c,
      502,
      "PAYMENT_PROVIDER_ERROR",
      err instanceof Error ? err.message : "Failed to create MonCash payment",
    );
  }

  await db.insert(depositOrders).values({
    userId: user.id,
    orderId: payment.orderId,
    amountCents,
    status: "pending",
    referenceId,
    redirectUrl: payment.redirectUrl,
    environment,
  });

  return c.json({
    orderId: payment.orderId,
    amountCents,
    redirectUrl: payment.redirectUrl,
    status: payment.status,
    mock: isBazikMock(),
  });
});

deposit.post("/wallet/deposit/:orderId/complete", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const orderId = c.req.param("orderId");

  const order = await db
    .select()
    .from(depositOrders)
    .where(eq(depositOrders.orderId, orderId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!order || order.userId !== user.id) {
    return apiError(c, 404, "NOT_FOUND", "Deposit order not found");
  }

  const result = await fulfillDeposit(orderId, orderId.startsWith("mock_") ? "mock" : "redirect");
  if (result.outcome === "error") {
    return apiError(c, result.retryable ? 502 : 400, "DEPOSIT_FULFILL_FAILED", result.message);
  }
  if (result.outcome === "pending") {
    return c.json({ status: "pending", providerStatus: result.status });
  }

  const depositWalletBalance = await getBalanceCents(user.id, environment);
  return c.json({
    status: "successful",
    balanceCents: depositWalletBalance.balanceCents,
    bonusCents: depositWalletBalance.bonusCents,
    outcome: result.outcome,
  });
});

walletRoutes.route("/", deposit);

const withdraw = new Hono<DepositEnv>();

/**
 * Create a withdrawal request (hold funds). Odfinex admin approves later.
 * MonCash + NatCash.
 */
withdraw.post("/wallet/withdraw", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const clientId = c.get("clientId");
  const body = await c.req.json().catch(() => null);
  const parsed = WalletWithdrawRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "INVALID_BODY",
      "Invalid withdraw (amount must be a positive integer HTG, method + account required)",
    );
  }

  const method = parsed.data.method ?? "moncash";
  const rawAccount = (parsed.data.account ?? parsed.data.phone ?? "").trim();
  if (!rawAccount) {
    return apiError(c, 400, "INVALID_ACCOUNT", "account (or phone) is required");
  }

  let account = rawAccount;
  let accountName = parsed.data.accountName?.trim() || null;

  if (method === "moncash") {
    account = normalizePhone(account);
    if (!/^3\d{7}$/.test(account) && !/^4\d{7}$/.test(account)) {
      return apiError(c, 400, "INVALID_PHONE", "MonCash phone must be 8 digits starting with 3 or 4");
    }
  } else if (method === "natcash") {
    if (!accountName) {
      return apiError(c, 400, "INVALID_ACCOUNT_NAME", "accountName is required for NatCash withdrawals");
    }
    if (account.length < 3) {
      return apiError(c, 400, "INVALID_ACCOUNT", "NatCash account number is too short");
    }
  } else {
    return apiError(c, 400, "METHOD_NOT_SUPPORTED", "Unsupported withdraw method");
  }

  const withdrawRail = await db
    .select()
    .from(paymentRailConfigs)
    .where(
      and(
        eq(paymentRailConfigs.method, method),
        eq(paymentRailConfigs.environment, environment),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!withdrawRail?.withdrawalEnabled) {
    return apiError(c, 400, "METHOD_DISABLED", `${method} withdrawals are not enabled`);
  }

  const amountHtg = parsed.data.amountHtg;
  const amountCents = amountHtg * 100;

  if (
    amountCents < withdrawRail.withdrawalMinAmountCents ||
    amountCents > withdrawRail.withdrawalMaxAmountCents
  ) {
    return apiError(
      c,
      400,
      "AMOUNT_OUT_OF_RANGE",
      `Amount must be between ${withdrawRail.withdrawalMinAmountCents / 100} and ${withdrawRail.withdrawalMaxAmountCents / 100} HTG`,
    );
  }

  const withdrawWalletBalance = await getBalanceCents(user.id, environment);
  const withdrawable = withdrawWalletBalance.balanceCents - withdrawWalletBalance.bonusCents;
  if (withdrawable < amountCents) {
    return apiError(c, 402, "INSUFFICIENT_FUNDS", "Insufficient withdrawable balance");
  }

  const referenceId = `wd_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const debit = await applyLedgerMutation({
    userId: user.id,
    clientId: "platform",
    environment,
    type: "debit",
    amountCents,
    reason: `${method}_withdraw_hold`,
    referenceId,
  });

  if (!debit.ok) {
    const status = debit.code === "INSUFFICIENT_FUNDS" ? 402 : 409;
    return apiError(c, status, debit.code, debit.message);
  }

  const [inserted] = await db
    .insert(withdrawalRequests)
    .values({
      userId: user.id,
      amountCents,
      phone: method === "moncash" ? account : "",
      method,
      account,
      accountName,
      clientId,
      status: "pending",
      referenceId,
      environment,
    })
    .returning();

  const createdWalletBalance = await getBalanceCents(user.id, environment);
  return c.json({
    id: inserted!.id,
    status: "pending",
    amountCents,
    method,
    balanceCents: createdWalletBalance.balanceCents,
    bonusCents: createdWalletBalance.bonusCents,
  });
});

withdraw.get("/wallet/withdraw-requests", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 50);

  const items = await db
    .select()
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.userId, user.id),
        eq(withdrawalRequests.environment, environment),
      ),
    )
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(limit);

  return c.json({
    items: items.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      method: r.method,
      account: r.account || r.phone,
      accountName: r.accountName,
      status: r.status,
      adminComment: r.adminComment,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  });
});

withdraw.post("/wallet/withdraw-requests/:id/cancel", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row || row.userId !== user.id) {
    return apiError(c, 404, "NOT_FOUND", "Withdrawal request not found");
  }
  if (row.status !== "pending") {
    return apiError(c, 409, "NOT_PENDING", "Only pending withdrawals can be cancelled");
  }

  await applyLedgerMutation({
    userId: user.id,
    clientId: "platform",
    environment,
    type: "credit",
    amountCents: row.amountCents,
    reason: `${row.method}_withdraw_cancel_refund`,
    referenceId: `cancel_${row.referenceId}`,
  });

  await db
    .update(withdrawalRequests)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(withdrawalRequests.id, id));

  const { balanceCents, bonusCents } = await getBalanceCents(user.id, environment);
  return c.json({ id, status: "cancelled", balanceCents, bonusCents });
});

/** Public payment-rail catalog for deposit UI — every configured method, not just NatCash. */
withdraw.get("/wallet/payment-rails", requireDepositAuth, async (c) => {
  const environment = c.get("environment");
  const rails = await db
    .select()
    .from(paymentRailConfigs)
    .where(eq(paymentRailConfigs.environment, environment));

  return c.json({
    items: rails
      .filter((r) => r.enabled)
      .map((r) => ({
        method: r.method,
        enabled: r.enabled,
        accountName: r.accountName,
        accountNumber: r.accountNumber,
        minAmountCents: r.depositMinAmountCents,
        maxAmountCents: r.depositMaxAmountCents,
        instructions: r.instructions,
      })),
  });
});

withdraw.post("/wallet/deposit-requests", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const clientId = c.get("clientId");
  const body = await c.req.json().catch(() => null);
  const parsed = ManualDepositRequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(c, 400, "INVALID_BODY", "Invalid deposit request");
  }

  const reference = parsed.data.reference?.trim() || null;
  const paymentProofUrl = parsed.data.paymentProofUrl?.trim() || null;
  if (!reference && !paymentProofUrl) {
    return apiError(
      c,
      400,
      "PROOF_OR_REFERENCE_REQUIRED",
      "Provide a payment reference (≥3 chars) or a proof URL",
    );
  }

  const rail = await db
    .select()
    .from(paymentRailConfigs)
    .where(
      and(
        eq(paymentRailConfigs.method, "natcash"),
        eq(paymentRailConfigs.environment, environment),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!rail?.enabled) {
    return apiError(c, 400, "METHOD_DISABLED", "NatCash deposits are not enabled");
  }
  if (!rail.accountName.trim() || !rail.accountNumber.trim()) {
    return apiError(c, 503, "RAIL_MISCONFIGURED", "NatCash destination is not configured");
  }

  const amountCents = parsed.data.amountHtg * 100;
  if (amountCents < rail.depositMinAmountCents || amountCents > rail.depositMaxAmountCents) {
    return apiError(
      c,
      400,
      "AMOUNT_OUT_OF_RANGE",
      `Amount must be between ${rail.depositMinAmountCents / 100} and ${rail.depositMaxAmountCents / 100} HTG`,
    );
  }

  const [inserted] = await db
    .insert(manualDepositRequests)
    .values({
      userId: user.id,
      clientId,
      amountCents,
      status: "pending",
      paymentProofUrl,
      reference,
      environment,
    })
    .returning();

  return c.json({
    id: inserted!.id,
    amountCents,
    status: "pending",
    createdAt: inserted!.createdAt.toISOString(),
  });
});

withdraw.get("/wallet/deposit-requests", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const environment = c.get("environment");
  const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 50);

  const items = await db
    .select()
    .from(manualDepositRequests)
    .where(
      and(
        eq(manualDepositRequests.userId, user.id),
        eq(manualDepositRequests.environment, environment),
      ),
    )
    .orderBy(desc(manualDepositRequests.createdAt))
    .limit(limit);

  return c.json({
    items: items.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      status: r.status,
      paymentProofUrl: r.paymentProofUrl,
      reference: r.reference,
      adminComment: r.adminComment,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

withdraw.post("/wallet/deposit-requests/:id/cancel", requireDepositAuth, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(manualDepositRequests)
    .where(eq(manualDepositRequests.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row || row.userId !== user.id) {
    return apiError(c, 404, "NOT_FOUND", "Deposit request not found");
  }
  if (row.status !== "pending") {
    return apiError(c, 409, "NOT_PENDING", "Only pending requests can be cancelled");
  }

  await db
    .update(manualDepositRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(manualDepositRequests.id, id));

  return c.json({ id, status: "cancelled" });
});

walletRoutes.route("/", withdraw);
