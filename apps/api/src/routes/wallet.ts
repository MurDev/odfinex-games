import { Hono } from "hono";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  depositOrders,
  gameClients,
  launchTokens,
  ledgerEntries,
  sessions,
  users,
  withdrawalRequests,
} from "@odfinex/db";
import type { WalletEnvironment } from "@odfinex/shared";
import {
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
  classifyWithdrawOutcome,
  isBazikMock,
  splitFullName,
  withdrawToMoncash,
} from "../payments/bazik.js";
import { fulfillDeposit } from "../payments/fulfill-deposit.js";

type LaunchEnv = { Variables: LaunchAuthVariables };
type PlatformEnv = { Variables: AuthVariables };
type S2SEnv = { Variables: S2SClientVariables };
type DepositEnv = { Variables: DepositAuthVariables };

const MIN_HTG = 10;
const MAX_HTG = 75_000;

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

walletRoutes.route("/", s2s);

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
      `Invalid deposit (amount ${MIN_HTG}–${MAX_HTG} HTG, method moncash)`,
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

  const balanceCents = await getBalanceCents(user.id, environment);
  return c.json({
    status: "successful",
    balanceCents,
    outcome: result.outcome,
  });
});

walletRoutes.route("/", deposit);

const withdraw = new Hono<PlatformEnv>();

withdraw.post("/wallet/withdraw", requirePlatformSession, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = WalletWithdrawRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "INVALID_BODY",
      `Invalid withdraw (amount ${MIN_HTG}–${MAX_HTG} HTG, phone required)`,
    );
  }

  const amountHtg = parsed.data.amountHtg;
  const amountCents = amountHtg * 100;
  const phone = normalizePhone(parsed.data.phone);
  if (!/^3\d{7}$/.test(phone) && !/^4\d{7}$/.test(phone)) {
    return apiError(c, 400, "INVALID_PHONE", "MonCash phone must be 8 digits starting with 3 or 4");
  }

  const balance = await getBalanceCents(user.id, "live");
  if (balance < amountCents) {
    return apiError(c, 402, "INSUFFICIENT_FUNDS", "Insufficient wallet balance");
  }

  const referenceId = `wd_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const debit = await applyLedgerMutation({
    userId: user.id,
    clientId: "platform",
    environment: "live",
    type: "debit",
    amountCents,
    reason: "moncash_withdraw",
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
      phone,
      status: "processing",
      referenceId,
      environment: "live",
    })
    .returning();

  const names = splitFullName(user.displayName ?? user.email ?? "Player");

  try {
    const payout = await withdrawToMoncash({
      gdes: amountHtg,
      wallet: phone,
      ...names,
      referenceId,
      description: "Odfinex Games withdrawal",
      customerEmail: user.email ?? undefined,
    });

    const outcome = classifyWithdrawOutcome(payout.status, payout.transactionId);
    if (outcome === "failed") {
      await applyLedgerMutation({
        userId: user.id,
        clientId: "platform",
        environment: "live",
        type: "credit",
        amountCents,
        reason: "moncash_withdraw_refund",
        referenceId: `refund_${referenceId}`,
      });
      await db
        .update(withdrawalRequests)
        .set({ status: "failed", completedAt: new Date(), providerTxId: payout.transactionId })
        .where(eq(withdrawalRequests.id, inserted!.id));
      return apiError(c, 502, "WITHDRAW_FAILED", "MonCash payout failed; balance refunded");
    }

    if (outcome === "ambiguous") {
      await db
        .update(withdrawalRequests)
        .set({ status: "processing", providerTxId: payout.transactionId })
        .where(eq(withdrawalRequests.id, inserted!.id));
      return c.json({
        id: inserted!.id,
        status: "processing",
        amountCents,
        providerTxId: payout.transactionId,
        warning: "Provider response ambiguous — verify before retrying",
      });
    }

    await db
      .update(withdrawalRequests)
      .set({
        status: "successful",
        completedAt: new Date(),
        providerTxId: payout.transactionId,
      })
      .where(eq(withdrawalRequests.id, inserted!.id));

    return c.json({
      id: inserted!.id,
      status: "successful",
      amountCents,
      providerTxId: payout.transactionId,
      dryRun: payout.dryRun ?? false,
    });
  } catch (err) {
    console.error("[withdraw] provider error", err);
    await applyLedgerMutation({
      userId: user.id,
      clientId: "platform",
      environment: "live",
      type: "credit",
      amountCents,
      reason: "moncash_withdraw_refund",
      referenceId: `refund_${referenceId}`,
    });
    await db
      .update(withdrawalRequests)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(withdrawalRequests.id, inserted!.id));
    return apiError(
      c,
      502,
      "PAYMENT_PROVIDER_ERROR",
      err instanceof Error ? err.message : "Withdraw failed",
    );
  }
});

walletRoutes.route("/", withdraw);
