import { users } from "@odfinex/db";
import type { User } from "@odfinex/shared";

type DbUser = typeof users.$inferSelect;

export function toPublicUser(row: DbUser): User {
  return {
    id: row.id,
    displayName: row.name,
    email: row.email,
    avatarUrl: row.image && row.image.length > 0 ? row.image : null,
    createdAt: row.createdAt.toISOString(),
  };
}
