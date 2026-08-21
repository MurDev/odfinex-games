import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { userNotifications } from "@odfinex/db";
import {
  UserNotificationsResponseSchema,
  type UserNotification,
} from "@odfinex/shared";

import { db } from "../db.js";
import { apiError } from "../lib/errors.js";
import { resolveUserId } from "./me.js";

export const notificationRoutes = new Hono();

function toPublic(row: {
  id: string;
  type: string;
  titleFr: string;
  titleEn: string;
  titleHt: string;
  bodyFr: string;
  bodyEn: string;
  bodyHt: string;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}): UserNotification {
  return {
    id: row.id,
    type: row.type,
    titleFr: row.titleFr,
    titleEn: row.titleEn,
    titleHt: row.titleHt,
    bodyFr: row.bodyFr,
    bodyEn: row.bodyEn,
    bodyHt: row.bodyHt,
    linkUrl: row.linkUrl,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

notificationRoutes.get("/me/notifications", async (c) => {
  const userId = await resolveUserId(c);
  if (!userId) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing session or launch token");
  }

  const limit = Math.min(Number(c.req.query("limit") ?? "30") || 30, 50);

  const rows = await db
    .select()
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId))
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);

  const unreadCount = rows.filter((r) => r.readAt == null).length;
  const body = UserNotificationsResponseSchema.parse({
    items: rows.map(toPublic),
    unreadCount,
  });
  return c.json(body);
});

notificationRoutes.post("/me/notifications/:id/read", async (c) => {
  const userId = await resolveUserId(c);
  if (!userId) {
    return apiError(c, 401, "UNAUTHORIZED", "Missing session or launch token");
  }

  const id = c.req.param("id");
  const existing = await db
    .select({ id: userNotifications.id, readAt: userNotifications.readAt })
    .from(userNotifications)
    .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) {
    return apiError(c, 404, "NOT_FOUND", "Notification not found");
  }

  if (!existing.readAt) {
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId),
          isNull(userNotifications.readAt),
        ),
      );
  }

  return c.json({ ok: true as const });
});
