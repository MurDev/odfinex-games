import { and, eq } from "drizzle-orm";
import { ledgerEntries, walletAccounts } from "@odfinex/db";

import { db } from "../db.js";

export async function ensureWallet(userId: string) {
  await db
    .insert(walletAccounts)
    .values({ userId, balanceCents: 0 })
    .onConflictDoNothing();
}

export async function getBalanceCents(userId: string): Promise<number> {
  await ensureWallet(userId);
  const row = await db
    .select({ balanceCents: walletAccounts.balanceCents })
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1)
    .then((rows) => rows[0]);
  return row?.balanceCents ?? 0;
}

type MutationInput = {
  userId: string;
  clientId: string;
  type: "debit" | "credit";
  amountCents: number;
  reason: string;
  referenceId: string;
};

export type MutationResult =
  | { ok: true; txId: string; balanceCents: number; replay: boolean }
  | {
      ok: false;
      code: "INSUFFICIENT_FUNDS" | "IDEMPOTENCY_CONFLICT";
      message: string;
    };

export async function applyLedgerMutation(
  input: MutationInput,
): Promise<MutationResult> {
  const { userId, clientId, type, amountCents, reason, referenceId } = input;

  return db.transaction(async (tx) => {
    await tx
      .insert(walletAccounts)
      .values({ userId, balanceCents: 0 })
      .onConflictDoNothing();

    const existing = await tx
      .select()
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.clientId, clientId),
          eq(ledgerEntries.referenceId, referenceId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      if (
        existing.type !== type ||
        existing.amountCents !== amountCents ||
        existing.userId !== userId
      ) {
        return {
          ok: false as const,
          code: "IDEMPOTENCY_CONFLICT" as const,
          message: "referenceId already used with a different payload",
        };
      }
      return {
        ok: true as const,
        txId: existing.id,
        balanceCents: existing.balanceAfterCents,
        replay: true,
      };
    }

    const locked = await tx
      .select({ balanceCents: walletAccounts.balanceCents })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .for("update")
      .limit(1)
      .then((rows) => rows[0]);

    const current = locked?.balanceCents ?? 0;

    let next = current;
    if (type === "debit") {
      if (current < amountCents) {
        return {
          ok: false as const,
          code: "INSUFFICIENT_FUNDS" as const,
          message: "Insufficient wallet balance",
        };
      }
      next = current - amountCents;
    } else {
      next = current + amountCents;
    }

    const inserted = await tx
      .insert(ledgerEntries)
      .values({
        userId,
        clientId,
        type,
        amountCents,
        balanceAfterCents: next,
        reason,
        referenceId,
      })
      .returning();

    const entry = inserted[0];
    if (!entry) {
      throw new Error("ledger insert returned no row");
    }

    await tx
      .update(walletAccounts)
      .set({ balanceCents: next, updatedAt: new Date() })
      .where(eq(walletAccounts.userId, userId));

    return {
      ok: true as const,
      txId: entry.id,
      balanceCents: next,
      replay: false,
    };
  });
}
