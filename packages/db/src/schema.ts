import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const environmentEnum = pgEnum("game_environment", ["sandbox", "live"]);

/** Auth.js — users */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** Auth.js — OAuth accounts (property names match @auth/drizzle-adapter) */
export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  ],
);

/** Auth.js — database sessions (platform cookie) */
export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

/** Auth.js — email verification / magic links */
export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
    }),
  ],
);

/** Registered external games (SDK consumers) */
export const gameClients = pgTable("game_client", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().unique(),
  name: text("name").notNull(),
  environment: environmentEnum("environment").notNull().default("live"),
  hidden: boolean("hidden").notNull().default(false),
  launchUrl: text("launch_url").notNull(),
  redirectUrls: text("redirect_urls").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  walletEnabled: boolean("wallet_enabled").notNull().default(false),
  clientSecretHash: text("client_secret_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** Short-lived tokens handed to external games via play / SDK */
export const launchTokens = pgTable("launch_token", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => gameClients.clientId, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** Player wallet — balance in HTG cents (authority: Platform API only) */
export const walletAccounts = pgTable(
  "wallet_account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    environment: environmentEnum("environment").notNull().default("live"),
    balanceCents: integer("balance_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.environment] }),
  ],
);

/** Immutable ledger lines — idempotent via (clientId, referenceId) */
export const ledgerEntries = pgTable(
  "ledger_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    environment: environmentEnum("environment").notNull().default("live"),
    type: text("type").notNull(), // debit | credit
    amountCents: integer("amount_cents").notNull(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    reason: text("reason").notNull(),
    referenceId: text("reference_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("ledger_entry_client_ref_unique").on(table.clientId, table.referenceId)],
);
