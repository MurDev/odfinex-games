import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  version: z.string(),
  db: z.enum(["connected", "disconnected"]).optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Public player profile exposed to games via SDK */
export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  isAdmin: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const CreateLaunchRequestSchema = z.object({
  clientId: z.string().min(1),
});

export type CreateLaunchRequest = z.infer<typeof CreateLaunchRequestSchema>;

export const CreateLaunchResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  clientId: z.string(),
  launchUrl: z.string().url(),
});

export type CreateLaunchResponse = z.infer<typeof CreateLaunchResponseSchema>;

export const SessionResponseSchema = z.object({
  user: UserSchema,
  clientId: z.string(),
  expiresAt: z.string().datetime(),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const GameClientSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  launchUrl: z.string().url(),
  isActive: z.boolean(),
});

export type GameClient = z.infer<typeof GameClientSchema>;

export const GamesListResponseSchema = z.object({
  games: z.array(GameClientSchema),
});

export type GamesListResponse = z.infer<typeof GamesListResponseSchema>;

/** Wallet — HTG cents only (no floats) */
export const WalletBalanceSchema = z.object({
  balanceCents: z.number().int().nonnegative(),
  currency: z.literal("HTG"),
});

export type WalletBalance = z.infer<typeof WalletBalanceSchema>;

export const WalletMutationRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(64),
  referenceId: z.string().min(1).max(128),
});

export type WalletMutationRequest = z.infer<typeof WalletMutationRequestSchema>;

export const WalletMutationResponseSchema = z.object({
  txId: z.string(),
  balanceCents: z.number().int().nonnegative(),
  currency: z.literal("HTG"),
});

export type WalletMutationResponse = z.infer<typeof WalletMutationResponseSchema>;

export const WalletGrantRequestSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_00),
  reason: z.string().min(1).max(64).optional().default("grant"),
});

export type WalletGrantRequest = z.infer<typeof WalletGrantRequestSchema>;

export const LedgerEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["debit", "credit"]),
  amountCents: z.number().int().positive(),
  balanceAfterCents: z.number().int().nonnegative(),
  reason: z.string(),
  clientId: z.string(),
  referenceId: z.string(),
  createdAt: z.string().datetime(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const WalletTransactionsResponseSchema = z.object({
  items: z.array(LedgerEntrySchema),
  total: z.number().int().nonnegative(),
});

export type WalletTransactionsResponse = z.infer<
  typeof WalletTransactionsResponseSchema
>;

/* ─── Admin schemas ─── */

export const AdminStatsSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  totalGames: z.number().int().nonnegative(),
  totalTransactions: z.number().int().nonnegative(),
  totalWalletBalance: z.number().int().nonnegative(),
  totalVolumeCents: z.number().int().nonnegative(),
});

export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminGameStatsSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  launchUrl: z.string(),
  isActive: z.boolean(),
  walletEnabled: z.boolean(),
  hasClientSecret: z.boolean(),
  createdAt: z.string(),
  playerCount: z.number().int().nonnegative(),
  totalDebits: z.number().int().nonnegative(),
  totalCredits: z.number().int().nonnegative(),
  volumeCents: z.number().int().nonnegative(),
});

export type AdminGameStats = z.infer<typeof AdminGameStatsSchema>;

export const AdminGameUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  launchUrl: z.string().url().optional(),
  redirectUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  walletEnabled: z.boolean().optional(),
});

export type AdminGameUpdate = z.infer<typeof AdminGameUpdateSchema>;

export const AdminPlayerSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  balanceCents: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
});

export type AdminPlayer = z.infer<typeof AdminPlayerSchema>;

export const ClientSecretResponseSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  warning: z.string(),
});

export type ClientSecretResponse = z.infer<typeof ClientSecretResponseSchema>;
