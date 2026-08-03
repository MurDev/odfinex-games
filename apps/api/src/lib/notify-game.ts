import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { gameClients } from "@odfinex/db";

import { db } from "../db.js";

export type WalletNotifyEvent = {
  type: "deposit_request" | "withdrawal_request";
  requestId: string;
  userId: string;
  status: string;
  amountCents: number;
  method?: string;
};

/**
 * POST signed wallet status events to the game client's notifyUrl (if set).
 * Best-effort — failures are logged, never thrown to callers.
 */
export async function notifyGameWalletEvent(
  clientId: string | null | undefined,
  event: WalletNotifyEvent,
): Promise<void> {
  if (!clientId) return;

  const game = await db
    .select({
      notifyUrl: gameClients.notifyUrl,
      clientSecretHash: gameClients.clientSecretHash,
      clientId: gameClients.clientId,
    })
    .from(gameClients)
    .where(eq(gameClients.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const notifyUrl =
    game?.notifyUrl ??
    (clientId.startsWith("duelpion")
      ? process.env.DUELPION_NOTIFY_URL?.replace(/\/$/, "") ?? null
      : null);

  if (!notifyUrl) return;

  const secret = process.env.ODFINEX_NOTIFY_SECRET ?? process.env.NOTIFY_SECRET;
  if (!secret) {
    console.warn("[notify-game] ODFINEX_NOTIFY_SECRET unset — skipping webhook");
    return;
  }

  const body = JSON.stringify({
    ...event,
    clientId,
    at: new Date().toISOString(),
  });
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", secret)
    .update(`${body}.${timestamp}`)
    .digest("hex");

  try {
    const res = await fetch(
      notifyUrl.endsWith("/webhooks/odfinex/wallet-events")
        ? notifyUrl
        : `${notifyUrl.replace(/\/$/, "")}/webhooks/odfinex/wallet-events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-timestamp": timestamp,
          "x-odfinex-signature": signature,
        },
        body,
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) {
      console.warn("[notify-game] webhook non-OK", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.warn("[notify-game] webhook failed", err);
  }
}
