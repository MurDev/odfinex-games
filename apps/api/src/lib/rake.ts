import { and, eq } from "drizzle-orm";
import { rakeEvents } from "@odfinex/db";

import { db } from "../db.js";
import type { WalletEnvironment } from "@odfinex/shared";

type RakeEventInput = {
  clientId: string;
  environment: WalletEnvironment;
  amountCents: number;
  referenceId: string;
  reason?: string;
};

export type RakeEventResult =
  | { ok: true; id: string; replay: boolean }
  | { ok: false; code: "IDEMPOTENCY_CONFLICT"; message: string };

/**
 * Records a settled match's rake as a pure analytics event — never touches wallet
 * money (the winner's payout is already net of rake). Idempotent on
 * (clientId, referenceId), same shape as ledger_entry's idempotency key.
 */
export async function recordRakeEvent(input: RakeEventInput): Promise<RakeEventResult> {
  const { clientId, environment, amountCents, referenceId, reason } = input;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(rakeEvents)
      .where(and(eq(rakeEvents.clientId, clientId), eq(rakeEvents.referenceId, referenceId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      if (existing.amountCents !== amountCents) {
        return {
          ok: false as const,
          code: "IDEMPOTENCY_CONFLICT" as const,
          message: "referenceId already used with a different amountCents",
        };
      }
      return { ok: true as const, id: existing.id, replay: true };
    }

    const inserted = await tx
      .insert(rakeEvents)
      .values({ clientId, environment, amountCents, referenceId, reason: reason ?? null })
      .returning();

    const entry = inserted[0];
    if (!entry) {
      throw new Error("rake_event insert returned no row");
    }

    return { ok: true as const, id: entry.id, replay: false };
  });
}
