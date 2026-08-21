import { and, eq, sql } from "drizzle-orm";
import { launchTokens, ledgerEntries, users } from "@odfinex/db";
import type { WalletEnvironment } from "@odfinex/shared";

import { db } from "../db.js";

export const ledgerWithdrawalStatusSql = sql<string | null>`
  (
    select wr.status
    from withdrawal_request wr
    where wr.reference_id = ${ledgerEntries.referenceId}
       or wr.reference_id = regexp_replace(${ledgerEntries.referenceId}, '^(refund_|reject_|cancel_)', '')
    limit 1
  )
`;

export function relatedRequestIds(referenceId: string | null | undefined): {
  relatedDepositRequestId: string | null;
  relatedWithdrawalRequestId: string | null;
} {
  const ref = referenceId ?? "";
  let relatedDepositRequestId: string | null = null;
  let relatedWithdrawalRequestId: string | null = null;
  if (ref.startsWith("mdep_")) relatedDepositRequestId = ref.slice(5);
  const stripped = ref.replace(/^(refund_|reject_|cancel_)/, "");
  if (stripped.startsWith("wd_")) relatedWithdrawalRequestId = stripped;
  return { relatedDepositRequestId, relatedWithdrawalRequestId };
}

export type LedgerDetailRow = {
  id: string;
  userId: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  bonusCents: number;
  category: string | null;
  actorId: string | null;
  reason: string;
  clientId: string;
  environment: WalletEnvironment;
  referenceId: string;
  createdAt: Date;
  displayName: string | null;
  email: string | null;
  withdrawalStatus: string | null;
};

export function serializeLedgerDetail(tx: LedgerDetailRow) {
  return {
    id: tx.id,
    userId: tx.userId,
    displayName: tx.displayName,
    email: tx.email,
    type: tx.type as "debit" | "credit",
    amountCents: tx.amountCents,
    bonusCents: tx.bonusCents,
    balanceAfterCents: tx.balanceAfterCents,
    category: tx.category,
    actorId: tx.actorId,
    reason: tx.reason,
    clientId: tx.clientId,
    environment: tx.environment,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt.toISOString(),
    withdrawalStatus: tx.withdrawalStatus ?? null,
    ...relatedRequestIds(tx.referenceId),
  };
}

export async function loadLedgerTransactionById(id: string): Promise<LedgerDetailRow | null> {
  const row = await db
    .select({
      id: ledgerEntries.id,
      userId: ledgerEntries.userId,
      type: ledgerEntries.type,
      amountCents: ledgerEntries.amountCents,
      balanceAfterCents: ledgerEntries.balanceAfterCents,
      bonusCents: ledgerEntries.bonusCents,
      category: ledgerEntries.category,
      actorId: ledgerEntries.actorId,
      reason: ledgerEntries.reason,
      clientId: ledgerEntries.clientId,
      environment: ledgerEntries.environment,
      referenceId: ledgerEntries.referenceId,
      createdAt: ledgerEntries.createdAt,
      displayName: users.name,
      email: users.email,
      withdrawalStatus: ledgerWithdrawalStatusSql,
    })
    .from(ledgerEntries)
    .leftJoin(users, eq(ledgerEntries.userId, users.id))
    .where(eq(ledgerEntries.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return null;
  return {
    ...row,
    environment: row.environment as WalletEnvironment,
  };
}

/** True if this game client may read the ledger row (own game txs + platform money for its players). */
export async function clientCanReadLedgerTx(
  clientId: string,
  tx: LedgerDetailRow,
): Promise<boolean> {
  if (tx.clientId === clientId) return true;
  if (tx.clientId !== "platform") return false;

  const [gameHit] = await db
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.clientId, clientId), eq(ledgerEntries.userId, tx.userId)))
    .limit(1);
  if (gameHit) return true;

  const [tokenHit] = await db
    .select({ id: launchTokens.id })
    .from(launchTokens)
    .where(and(eq(launchTokens.clientId, clientId), eq(launchTokens.userId, tx.userId)))
    .limit(1);
  return Boolean(tokenHit);
}
