import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { depositOrders, users, webhookEvents } from "@odfinex/db";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { fulfillDeposit } from "../payments/fulfill-deposit.js";
import { verifyWebhookSignatureWithReason } from "../payments/bazik.js";

export const webhookRoutes = new Hono();

webhookRoutes.post("/bazik", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-bazik-signature") ?? "";
  const timestamp = c.req.header("x-bazik-timestamp") ?? "";
  const eventId = c.req.header("x-bazik-event-id") ?? "";

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return apiError(c, 400, "INVALID_BODY", "Invalid JSON");
  }

  const sigCheck = verifyWebhookSignatureWithReason(rawBody, signature, timestamp, eventId);
  if (!sigCheck.valid) {
    console.warn("[webhook/bazik] signature fail", sigCheck.reason);
    return apiError(c, 401, "INVALID_SIGNATURE", sigCheck.reason ?? "Invalid signature");
  }

  const idempotencyKey =
    (typeof payload.transactionId === "string" && payload.transactionId) || eventId || null;

  if (idempotencyKey) {
    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, idempotencyKey))
      .limit(1)
      .then((rows) => rows[0]);
    if (existing) {
      return c.json({ ok: true, duplicate: true });
    }
  }

  if (payload.type === "payment.failed") {
    const failedOrderId =
      typeof payload.orderId === "string"
        ? payload.orderId
        : typeof (payload.data as { orderId?: string } | undefined)?.orderId === "string"
          ? (payload.data as { orderId: string }).orderId
          : null;
    if (failedOrderId) {
      await db
        .update(depositOrders)
        .set({ status: "failed" })
        .where(eq(depositOrders.orderId, failedOrderId));
    }
    if (idempotencyKey) {
      await db.insert(webhookEvents).values({ id: idempotencyKey }).onConflictDoNothing();
    }
    return c.json({ ok: true });
  }

  const orderId =
    typeof payload.orderId === "string"
      ? payload.orderId
      : typeof (payload.data as { orderId?: string } | undefined)?.orderId === "string"
        ? (payload.data as { orderId: string }).orderId
        : null;

  if (!orderId) {
    return apiError(c, 400, "INVALID_BODY", "Missing orderId");
  }

  const result = await fulfillDeposit(orderId, "webhook");

  if (idempotencyKey && (result.outcome === "credited" || result.outcome === "already_credited" || result.outcome === "pending")) {
    await db.insert(webhookEvents).values({ id: idempotencyKey }).onConflictDoNothing();
  }

  if (result.outcome === "error") {
    return apiError(
      c,
      result.retryable ? 500 : 400,
      "DEPOSIT_FULFILL_FAILED",
      result.message,
    );
  }

  return c.json({ ok: true, outcome: result.outcome });
});

/** Dev/mock complete — no Bazik signature; only accepts mock_ order ids. */
webhookRoutes.post("/bazik/mock-complete", async (c) => {
  if (process.env.NODE_ENV === "production" && process.env.BAZIK_MOCK !== "true") {
    return apiError(c, 403, "FORBIDDEN", "Mock complete disabled in production");
  }

  const body = await c.req.json().catch(() => null);
  const orderId =
    body && typeof body === "object" && typeof (body as { orderId?: unknown }).orderId === "string"
      ? (body as { orderId: string }).orderId
      : null;

  if (!orderId || !orderId.startsWith("mock_")) {
    return apiError(c, 400, "INVALID_BODY", "orderId must be a mock_ id");
  }

  // Ensure order exists and belongs to a real user (extra safety)
  const order = await db
    .select({ userId: depositOrders.userId })
    .from(depositOrders)
    .innerJoin(users, eq(depositOrders.userId, users.id))
    .where(eq(depositOrders.orderId, orderId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!order) {
    return apiError(c, 404, "NOT_FOUND", "Unknown mock order");
  }

  const result = await fulfillDeposit(orderId, "mock");
  if (result.outcome === "error") {
    return apiError(c, 400, "DEPOSIT_FULFILL_FAILED", result.message);
  }
  return c.json({ ok: true, outcome: result.outcome, balanceCents: "balanceCents" in result ? result.balanceCents : undefined });
});
