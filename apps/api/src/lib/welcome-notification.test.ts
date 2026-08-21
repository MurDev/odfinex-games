import { describe, expect, it, vi } from "vitest";
import {
  WHATSAPP_COMMUNITY_URL,
  WHATSAPP_WELCOME_COPY,
  WHATSAPP_WELCOME_TYPE,
  ensureWhatsAppWelcomeNotification,
} from "@odfinex/db";

describe("ensureWhatsAppWelcomeNotification", () => {
  it("inserts a targeted whatsapp_welcome row for the user", async () => {
    const insertValues = vi.fn();
    const onConflictDoNothing = vi.fn(async () => undefined);
    const db = {
      insert: () => ({
        values: (row: unknown) => {
          insertValues(row);
          return { onConflictDoNothing };
        },
      }),
    };

    await ensureWhatsAppWelcomeNotification(db as never, "user-1");

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: WHATSAPP_WELCOME_TYPE,
        titleFr: WHATSAPP_WELCOME_COPY.titleFr,
        bodyFr: WHATSAPP_WELCOME_COPY.bodyFr,
        linkUrl: WHATSAPP_COMMUNITY_URL,
      }),
    );
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("second insert still uses onConflictDoNothing (idempotent)", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const db = {
      insert: () => ({
        values: () => ({ onConflictDoNothing }),
      }),
    };

    await ensureWhatsAppWelcomeNotification(db as never, "user-1");
    await ensureWhatsAppWelcomeNotification(db as never, "user-1");
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
  });
});
