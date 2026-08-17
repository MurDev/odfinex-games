import { and, eq } from "drizzle-orm";
import { ledgerEntries, walletAccounts } from "@odfinex/db";

import { db } from "../db.js";
import type { WalletEnvironment } from "@odfinex/shared";

export async function ensureWallet(
  userId: string,
  environment: WalletEnvironment = "live",
) {
  await db
    .insert(walletAccounts)
    .values({ userId, environment, balanceCents: 0 })
    .onConflictDoNothing();
}

export async function getBalanceCents(
  userId: string,
  environment: WalletEnvironment = "live",
): Promise<{ balanceCents: number; bonusCents: number }> {
  await ensureWallet(userId, environment);
  const row = await db
    .select({
      balanceCents: walletAccounts.balanceCents,
      bonusCents: walletAccounts.bonusCents,
    })
    .from(walletAccounts)
    .where(
      and(
        eq(walletAccounts.userId, userId),
        eq(walletAccounts.environment, environment),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  return {
    balanceCents: row?.balanceCents ?? 0,
    bonusCents: row?.bonusCents ?? 0,
  };
}

type MutationInput = {
  userId: string;
  clientId: string;
  environment: WalletEnvironment;
  type: "debit" | "credit";
  amountCents: number;
  reason: string;
  referenceId: string;
  bonusCents?: number;
  actorId?: string | null;
};

export type MutationResult =
  | {
      ok: true;
      txId: string;
      balanceCents: number;
      bonusCents: number;
      replay: boolean;
    }
  | {
      ok: false;
      code: "INSUFFICIENT_FUNDS" | "IDEMPOTENCY_CONFLICT" | "BONUS_INSUFFICIENT";
      message: string;
    };

export type DebitOutcome =
  | {
      ok: true;
      nextBalance: number;
      nextBonus: number;
      entryBonusCents: number;
    }
  | {
      ok: false;
      code: "INSUFFICIENT_FUNDS";
      message: string;
    };

/**
 * Calcule l'etat du wallet apres un debit.
 *
 * Le solde total (balanceCents) diminue toujours du montant entier : le solde
 * affiche doit refleter la perte, meme si le joueur a du bonus.
 *
 * Le bonus est consomme en dernier : un retrait (du retirable = balance minus
 * bonus) ne doit jamais rendre le bonus retirable en l'erosant, et un joueur
 * qui perd une mise voit son solde total baisser quoi qu'il en soit.
 */
export function computeDebitOutcome(input: {
  currentBalance: number;
  currentBonus: number;
  amountCents: number;
}): DebitOutcome {
  const { currentBalance, currentBonus, amountCents } = input;

  if (currentBalance < amountCents) {
    return {
      ok: false as const,
      code: "INSUFFICIENT_FUNDS" as const,
      message: "Insufficient wallet balance",
    };
  }

  const withdrawable = Math.max(0, currentBalance - currentBonus);
  const bonusToConsume = Math.max(0, amountCents - withdrawable);
  return {
    ok: true as const,
    nextBalance: currentBalance - amountCents,
    nextBonus: currentBonus - bonusToConsume,
    entryBonusCents: bonusToConsume === 0 ? 0 : -bonusToConsume,
  };
}

export async function applyLedgerMutation(
  input: MutationInput,
): Promise<MutationResult> {
  const {
    userId,
    clientId,
    environment,
    type,
    amountCents,
    reason,
    referenceId,
    bonusCents = 0,
    actorId,
  } = input;

  return db.transaction(async (tx) => {
    await tx
      .insert(walletAccounts)
      .values({ userId, environment, balanceCents: 0 })
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
        bonusCents: existing.bonusCents,
        replay: true,
      };
    }

    const locked = await tx
      .select({
        balanceCents: walletAccounts.balanceCents,
        bonusCents: walletAccounts.bonusCents,
      })
      .from(walletAccounts)
      .where(
        and(
          eq(walletAccounts.userId, userId),
          eq(walletAccounts.environment, environment),
        ),
      )
      .for("update")
      .limit(1)
      .then((rows) => rows[0]);

    const currentBalance = locked?.balanceCents ?? 0;
    const currentBonus = locked?.bonusCents ?? 0;

    let nextBalance = currentBalance;
    let nextBonus = currentBonus;
    let entryBonusCents = 0;

    if (type === "debit") {
      const outcome = computeDebitOutcome({ currentBalance, currentBonus, amountCents });
      if (!outcome.ok) {
        return outcome;
      }
      nextBalance = outcome.nextBalance;
      nextBonus = outcome.nextBonus;
      entryBonusCents = outcome.entryBonusCents;
    } else {
      nextBalance = currentBalance + amountCents;
      const bonusDelta = Math.max(0, Math.min(bonusCents, amountCents));
      nextBonus = currentBonus + bonusDelta;

      if (nextBonus > nextBalance) {
        nextBonus = nextBalance;
      }

      entryBonusCents = nextBonus - currentBonus;
    }

    if (nextBonus < 0 || nextBonus > nextBalance) {
      return {
        ok: false as const,
        code: "BONUS_INSUFFICIENT" as const,
        message: "Internal bonus invariant violation",
      };
    }

    const inserted = await tx
      .insert(ledgerEntries)
      .values({
        userId,
        clientId,
        environment,
        type,
        amountCents,
        balanceAfterCents: nextBalance,
        bonusCents: entryBonusCents,
        category: reason,
        actorId: actorId ?? null,
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
      .set({
        balanceCents: nextBalance,
        bonusCents: nextBonus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletAccounts.userId, userId),
          eq(walletAccounts.environment, environment),
        ),
      );

    return {
      ok: true as const,
      txId: entry.id,
      balanceCents: nextBalance,
      bonusCents: nextBonus,
      replay: false,
    };
  });
}
