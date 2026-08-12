import { eq } from "drizzle-orm";
import { depositOrders } from "@odfinex/db";

import { db } from "../db.js";
import { applyLedgerMutation } from "../lib/wallet.js";
import { verifyPayment } from "./bazik.js";

export type FulfillResult =
  | {
      outcome: "credited";
      userId: string;
      amountCents: number;
      balanceCents: number;
      bonusCents: number;
    }
  | {
      outcome: "already_credited";
      balanceCents: number;
      bonusCents: number;
    }
  | { outcome: "pending"; status: string }
  | { outcome: "error"; message: string; retryable?: boolean };

export async function fulfillDeposit(
  orderId: string,
  source: "webhook" | "redirect" | "mock",
): Promise<FulfillResult> {
  const order = await db
    .select()
    .from(depositOrders)
    .where(eq(depositOrders.orderId, orderId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!order) {
    return { outcome: "error", message: "Unknown deposit order", retryable: false };
  }

  if (order.status === "successful") {
    return { outcome: "already_credited", balanceCents: 0, bonusCents: 0 };
  }

  let verified;
  try {
    verified = await verifyPayment(orderId);
  } catch (err) {
    return {
      outcome: "error",
      message: err instanceof Error ? err.message : "verify failed",
      retryable: true,
    };
  }

  if (verified.status !== "successful") {
    if (verified.status === "failed" || verified.status === "cancelled") {
      await db
        .update(depositOrders)
        .set({ status: verified.status })
        .where(eq(depositOrders.orderId, orderId));
    }
    return { outcome: "pending", status: verified.status };
  }

  const verifiedGdes = verified.gourdes ?? verified.amount ?? 0;
  // Mock verify returns gourdes: 0 — trust the pending order amount.
  const amountCents =
    verifiedGdes > 0 ? Math.round(verifiedGdes * 100) : order.amountCents;

  if (verifiedGdes > 0 && amountCents !== order.amountCents) {
    return {
      outcome: "error",
      message: "Payment amount does not match deposit order",
      retryable: false,
    };
  }

  const result = await applyLedgerMutation({
    userId: order.userId,
    clientId: "platform",
    environment: order.environment,
    type: "credit",
    amountCents,
    reason: "moncash_deposit",
    referenceId: `deposit_${order.orderId}`,
  });

  if (!result.ok) {
    if (result.code === "IDEMPOTENCY_CONFLICT") {
      return { outcome: "already_credited", balanceCents: 0, bonusCents: 0 };
    }
    return { outcome: "error", message: result.message, retryable: true };
  }

  await db
    .update(depositOrders)
    .set({
      status: "successful",
      completedAt: new Date(),
    })
    .where(eq(depositOrders.orderId, orderId));

  console.log(
    `[deposit] credited user=${order.userId} cents=${amountCents} via ${source} order=${orderId}`,
  );

  return {
    outcome: "credited",
    userId: order.userId,
    amountCents,
    balanceCents: result.balanceCents,
    bonusCents: result.bonusCents,
  };
}
