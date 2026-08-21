import type { Db } from "./client";
import { userNotifications } from "./schema";

export const WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/FPzXzce9jP76DP6NT75nIO?mode=gi_t";

export const WHATSAPP_WELCOME_TYPE = "whatsapp_welcome";

export const WHATSAPP_WELCOME_COPY = {
  titleFr: "Bienvenue dans la communaute",
  titleEn: "Welcome to the community",
  titleHt: "Byenveni nan kominote a",
  bodyFr: "Rejoins le groupe WhatsApp pour echanger avec les autres joueurs.",
  bodyEn: "Join the WhatsApp group to chat with other players.",
  bodyHt: "Antre nan gwoup WhatsApp la pou echanje ak lot jwe yo.",
} as const;

/** Idempotent: unique (user_id, type) — second call is a no-op. */
export async function ensureWhatsAppWelcomeNotification(
  db: Db,
  userId: string,
): Promise<void> {
  await db
    .insert(userNotifications)
    .values({
      userId,
      type: WHATSAPP_WELCOME_TYPE,
      titleFr: WHATSAPP_WELCOME_COPY.titleFr,
      titleEn: WHATSAPP_WELCOME_COPY.titleEn,
      titleHt: WHATSAPP_WELCOME_COPY.titleHt,
      bodyFr: WHATSAPP_WELCOME_COPY.bodyFr,
      bodyEn: WHATSAPP_WELCOME_COPY.bodyEn,
      bodyHt: WHATSAPP_WELCOME_COPY.bodyHt,
      linkUrl: WHATSAPP_COMMUNITY_URL,
    })
    .onConflictDoNothing({
      target: [userNotifications.userId, userNotifications.type],
    });
}
