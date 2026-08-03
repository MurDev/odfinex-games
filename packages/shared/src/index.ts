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

/** Wallet environment — sandbox (test funds) vs live (real funds) */
export const WalletEnvironmentSchema = z.enum(["sandbox", "live"]);

export type WalletEnvironment = z.infer<typeof WalletEnvironmentSchema>;

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

/** S2S credit to a user who is not in-session (e.g. referral commission) */
export const WalletCreditUserRequestSchema = z.object({
  platformUserId: z.string().min(1).max(128),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(64),
  referenceId: z.string().min(1).max(128),
});

export type WalletCreditUserRequest = z.infer<typeof WalletCreditUserRequestSchema>;

export const WalletDepositRequestSchema = z.object({
  amountHtg: z.number().int().min(10).max(75_000),
});

export type WalletDepositRequest = z.infer<typeof WalletDepositRequestSchema>;

export const WalletDepositResponseSchema = z.object({
  orderId: z.string(),
  amountCents: z.number().int().positive(),
  redirectUrl: z.string().url(),
  status: z.string(),
});

export type WalletDepositResponse = z.infer<typeof WalletDepositResponseSchema>;

export const WalletWithdrawRequestSchema = z.object({
  amountHtg: z.number().int().min(10).max(75_000),
  phone: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Invalid phone"),
});

export type WalletWithdrawRequest = z.infer<typeof WalletWithdrawRequestSchema>;

export const WalletWithdrawResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  amountCents: z.number().int().positive(),
  providerTxId: z.string().nullable().optional(),
});

export type WalletWithdrawResponse = z.infer<typeof WalletWithdrawResponseSchema>;

export const WalletGrantRequestSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_00),
  reason: z.string().min(1).max(64).optional().default("grant"),
  environment: WalletEnvironmentSchema.optional().default("live"),
});

export type WalletGrantRequest = z.infer<typeof WalletGrantRequestSchema>;

export const LedgerEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["debit", "credit"]),
  amountCents: z.number().int().positive(),
  balanceAfterCents: z.number().int().nonnegative(),
  reason: z.string(),
  clientId: z.string(),
  environment: WalletEnvironmentSchema,
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
  environment: WalletEnvironmentSchema,
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

export const AdminGameCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/i).optional(),
  clientId: z.string().min(1).optional(),
  name: z.string().min(1),
  environment: WalletEnvironmentSchema.optional().default("live"),
  launchUrl: z.string().url(),
  redirectUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  walletEnabled: z.boolean().optional(),
});

export type AdminGameCreate = z.infer<typeof AdminGameCreateSchema>;

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
