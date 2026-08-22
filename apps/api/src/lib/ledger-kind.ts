import { ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { ledgerEntries } from "@odfinex/db";

import { ledgerWithdrawalStatusSql } from "./ledger-detail.js";

export const LEDGER_KINDS = ["withdraw", "deposit", "bet", "win", "grant"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const WITHDRAWAL_STATUSES = [
  "pending",
  "processing",
  "successful",
  "failed",
  "cancelled",
] as const;
export type WithdrawalStatusFilter = (typeof WITHDRAWAL_STATUSES)[number];

const DEPOSIT_REASONS = ["moncash_deposit", "natcash_deposit", "depot_manual", "deposit"] as const;
const GRANT_REASONS = [
  "bonus",
  "gift",
  "weekly_reward",
  "reward",
  "grant",
  "admin_investment",
] as const;

export function parseLedgerKind(value: string | undefined | null): LedgerKind | undefined {
  if (!value) return undefined;
  return (LEDGER_KINDS as readonly string[]).includes(value) ? (value as LedgerKind) : undefined;
}

export function parseWithdrawalStatus(
  value: string | undefined | null,
): WithdrawalStatusFilter | undefined {
  if (!value) return undefined;
  return (WITHDRAWAL_STATUSES as readonly string[]).includes(value)
    ? (value as WithdrawalStatusFilter)
    : undefined;
}

export function ledgerKindSql(kind: LedgerKind): SQL {
  switch (kind) {
    case "withdraw":
      return or(
        ilike(ledgerEntries.reason, "%withdraw%"),
        ilike(ledgerEntries.category, "%withdraw%"),
      )!;
    case "deposit":
      return or(
        inArray(ledgerEntries.reason, [...DEPOSIT_REASONS]),
        inArray(ledgerEntries.category, [...DEPOSIT_REASONS]),
      )!;
    case "bet":
      return sql`(
        ${ledgerEntries.reason} = 'bet'
        OR ${ledgerEntries.reason} LIKE 'bet_%'
        OR ${ledgerEntries.reason} ILIKE '%: bet'
        OR ${ledgerEntries.category} ILIKE '%: bet'
      )`;
    case "win":
      return sql`(
        ${ledgerEntries.reason} = 'win'
        OR ${ledgerEntries.reason} = 'payout'
        OR ${ledgerEntries.reason} LIKE 'win_%'
        OR ${ledgerEntries.reason} ILIKE '%: win'
        OR ${ledgerEntries.reason} ILIKE '%: payout'
        OR ${ledgerEntries.category} ILIKE '%: payout'
      )`;
    case "grant":
      return or(
        inArray(ledgerEntries.reason, [...GRANT_REASONS]),
        inArray(ledgerEntries.category, [...GRANT_REASONS]),
      )!;
  }
}

export function withdrawalStatusFilterSql(status: WithdrawalStatusFilter): SQL {
  return sql`${ledgerWithdrawalStatusSql} = ${status}`;
}
