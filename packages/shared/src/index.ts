import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  version: z.string(),
  db: z.enum(["connected", "disconnected"]).optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  isAdmin: z.boolean().optional(),
  isBot: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const UpdateUsernameRequestSchema = z.object({
  username: z
    .string()
    .regex(
      USERNAME_PATTERN,
      "Username must be 3-20 characters: lowercase letters, digits, or underscores",
    ),
});

export type UpdateUsernameRequest = z.infer<typeof UpdateUsernameRequestSchema>;

export const UpdateUsernameResponseSchema = z.object({
  username: z.string(),
});

export type UpdateUsernameResponse = z.infer<typeof UpdateUsernameResponseSchema>;

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

export const WalletEnvironmentSchema = z.enum(["sandbox", "live"]);

export type WalletEnvironment = z.infer<typeof WalletEnvironmentSchema>;

export const LedgerCategorySchema = z.enum([
  "admin_investment",
  "admin_debit",
  "deposit",
  "depot_manual",
  "bonus",
  "reward",
  "weekly_reward",
  "grant",
  "refund",
  "withdrawal",
  "game",
  "natcash_deposit",
  "moncash_withdraw_refund",
  "withdraw_reject_refund",
  "withdraw_cancel_refund",
]);

export type LedgerCategory = z.infer<typeof LedgerCategorySchema>;

export const WalletBalanceSchema = z.object({
  balanceCents: z.number().int().nonnegative(),
  bonusCents: z.number().int().nonnegative(),
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
  bonusCents: z.number().int().nonnegative(),
  currency: z.literal("HTG"),
});

export type WalletMutationResponse = z.infer<typeof WalletMutationResponseSchema>;

export const WalletCreditUserRequestSchema = z.object({
  platformUserId: z.string().min(1).max(128),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(64),
  referenceId: z.string().min(1).max(128),
});

export type WalletCreditUserRequest = z.infer<typeof WalletCreditUserRequestSchema>;

export const WalletDepositRequestSchema = z.object({
  // No fixed min/max here: the real bounds are configured per rail in
  // payment_rail_config (Odfinex admin), not hardcoded in the schema.
  amountHtg: z.number().int().positive(),
  method: z.enum(["moncash"]).optional().default("moncash"),
  successUrl: z.string().url().optional(),
  errorUrl: z.string().url().optional(),
});

export type WalletDepositRequest = z.infer<typeof WalletDepositRequestSchema>;

export const WalletDepositResponseSchema = z.object({
  orderId: z.string(),
  amountCents: z.number().int().positive(),
  redirectUrl: z.string().url(),
  status: z.string(),
  mock: z.boolean().optional(),
});

export type WalletDepositResponse = z.infer<typeof WalletDepositResponseSchema>;

export const WalletDepositCompleteResponseSchema = z.object({
  status: z.enum(["successful", "pending"]),
  balanceCents: z.number().int().nonnegative().optional(),
  outcome: z.string().optional(),
  providerStatus: z.string().optional(),
});

export type WalletDepositCompleteResponse = z.infer<
  typeof WalletDepositCompleteResponseSchema
>;

export const WalletWithdrawRequestSchema = z.object({
  // No fixed min/max here: the real bounds are configured per rail in
  // payment_rail_config (Odfinex admin), not hardcoded in the schema.
  amountHtg: z.number().int().positive(),
  method: z.enum(["moncash", "natcash"]).optional().default("moncash"),
  account: z.string().min(3).max(64).optional(),
  accountName: z.string().min(1).max(128).optional(),
  phone: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Invalid phone")
    .optional(),
});

export type WalletWithdrawRequest = z.infer<typeof WalletWithdrawRequestSchema>;

export const WalletWithdrawResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  amountCents: z.number().int().positive(),
  method: z.enum(["moncash", "natcash"]).optional(),
  balanceCents: z.number().int().nonnegative().optional(),
  providerTxId: z.string().nullable().optional(),
  dryRun: z.boolean().optional(),
  warning: z.string().optional(),
});

export type WalletWithdrawResponse = z.infer<typeof WalletWithdrawResponseSchema>;

export const ManualDepositRequestCreateSchema = z.object({
  // No fixed min/max here: the real bounds are configured per rail in
  // payment_rail_config (Odfinex admin), not hardcoded in the schema.
  amountHtg: z.number().int().positive(),
  method: z.enum(["natcash"]).optional().default("natcash"),
  reference: z.string().min(3).max(128).optional(),
  paymentProofUrl: z.string().url().optional(),
});

export type ManualDepositRequestCreate = z.infer<
  typeof ManualDepositRequestCreateSchema
>;

export const ManualDepositRequestSchema = z.object({
  id: z.string(),
  amountCents: z.number().int().positive(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  paymentProofUrl: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  adminComment: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type ManualDepositRequest = z.infer<typeof ManualDepositRequestSchema>;

export const PaymentRailPublicSchema = z.object({
  method: z.literal("natcash"),
  enabled: z.boolean(),
  accountName: z.string(),
  accountNumber: z.string(),
  minAmountCents: z.number().int(),
  maxAmountCents: z.number().int(),
  instructions: z.string().nullable().optional(),
});

export type PaymentRailPublic = z.infer<typeof PaymentRailPublicSchema>;

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
  bonusCents: z.number().int().nonnegative(),
  balanceAfterCents: z.number().int().nonnegative(),
  reason: z.string(),
  clientId: z.string(),
  environment: WalletEnvironmentSchema,
  referenceId: z.string(),
  category: LedgerCategorySchema,
  actorId: z.string().optional(),
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

export const ClientLedgerEntrySchema = LedgerEntrySchema.extend({
  userId: z.string(),
  displayName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export type ClientLedgerEntry = z.infer<typeof ClientLedgerEntrySchema>;

export const ClientTransactionsResponseSchema = z.object({
  items: z.array(ClientLedgerEntrySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type ClientTransactionsResponse = z.infer<
  typeof ClientTransactionsResponseSchema
>;

export const AdminStatsSchema = z.object({
  totalAccounts: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  totalBots: z.number().int().nonnegative(),
  totalGames: z.number().int().nonnegative(),
  totalTransactions: z.number().int().nonnegative(),
  totalWalletBalance: z.number().int().nonnegative(),
  totalVolumeCents: z.number().int().nonnegative(),
  pendingDeposits: z.number().int().nonnegative(),
  pendingWithdrawals: z.number().int().nonnegative(),
});

export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminGameStatsSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  environment: WalletEnvironmentSchema,
  launchUrl: z.string(),
  redirectUrls: z.array(z.string()),
  notifyUrl: z.string().url().nullable(),
  hidden: z.boolean(),
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
  hidden: z.boolean().optional(),
  notifyUrl: z.string().url().nullable().optional(),
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
  isBot: z.boolean(),
  createdAt: z.string(),
  balanceCents: z.number().int().nonnegative(),
  bonusCents: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
});

export type AdminPlayer = z.infer<typeof AdminPlayerSchema>;

export const AdminUserCreateSchema = z.object({
  name: z.string().min(1).max(64),
  email: z.string().email().max(254),
  isBot: z.boolean().optional().default(false),
  isAdmin: z.boolean().optional().default(false),
  clientId: z.string().min(1).max(64).optional(),
});

export type AdminUserCreate = z.infer<typeof AdminUserCreateSchema>;

export const AdminUserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    isBot: z.boolean(),
    isAdmin: z.boolean(),
    createdAt: z.string(),
  }),
});

export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;

export const AdminUserCreditSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(64).optional(),
  referenceId: z.string().min(1).max(128).optional(),
  category: LedgerCategorySchema.optional().default("admin_investment"),
});

export type AdminUserCredit = z.infer<typeof AdminUserCreditSchema>;

export const AdminUserDebitSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(64).optional(),
  referenceId: z.string().min(1).max(128).optional(),
  category: LedgerCategorySchema.optional().default("admin_debit"),
});

export type AdminUserDebit = z.infer<typeof AdminUserDebitSchema>;

export const AdminAccountSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  email: z.string().email().nullable(),
  isBot: z.boolean(),
  isAdmin: z.boolean(),
  clientId: z.string().nullable(),
  gameName: z.string().nullable(),
  balanceCents: z.number().int().nonnegative(),
  bonusCents: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type AdminAccount = z.infer<typeof AdminAccountSchema>;

export const AdminDepositRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  paymentProofUrl: z.string().nullable(),
  reference: z.string().nullable(),
  adminComment: z.string().nullable(),
  clientId: z.string().nullable(),
  gameName: z.string().nullable(),
  environment: WalletEnvironmentSchema,
  reviewedBy: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isSelf: z.boolean().optional(),
});

export type AdminDepositRequest = z.infer<typeof AdminDepositRequestSchema>;

export const AdminDepositRequestDetailSchema = z.object({
  request: AdminDepositRequestSchema,
  ledgerEntry: z
    .object({
      id: z.string(),
      amountCents: z.number(),
      balanceAfterCents: z.number(),
      referenceId: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
});

export type AdminDepositRequestDetail = z.infer<typeof AdminDepositRequestDetailSchema>;

export const AdminWithdrawalRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  method: z.string(),
  account: z.string(),
  accountName: z.string().nullable(),
  status: z.enum(["pending", "processing", "successful", "failed", "cancelled"]),
  adminComment: z.string().nullable(),
  clientId: z.string().nullable(),
  gameName: z.string().nullable(),
  environment: WalletEnvironmentSchema,
  referenceId: z.string(),
  providerTxId: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  isSelf: z.boolean().optional(),
});

export type AdminWithdrawalRequest = z.infer<typeof AdminWithdrawalRequestSchema>;

export const AdminWithdrawalRequestDetailSchema = z.object({
  request: AdminWithdrawalRequestSchema,
  ledgerEntries: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      amountCents: z.number(),
      balanceAfterCents: z.number(),
      reason: z.string(),
      referenceId: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export type AdminWithdrawalRequestDetail = z.infer<typeof AdminWithdrawalRequestDetailSchema>;

export const ClientBalancesRequestSchema = z.object({
  userIds: z.array(z.string().min(1).max(128)).max(200),
});

export type ClientBalancesRequest = z.infer<typeof ClientBalancesRequestSchema>;

export const ClientBalanceEntrySchema = z.object({
  userId: z.string(),
  balanceCents: z.number().int().nonnegative(),
  bonusCents: z.number().int().nonnegative(),
  currency: z.literal("HTG"),
});

export type ClientBalanceEntry = z.infer<typeof ClientBalanceEntrySchema>;

export const ClientBalancesResponseSchema = z.object({
  items: z.array(ClientBalanceEntrySchema),
});

export type ClientBalancesResponse = z.infer<typeof ClientBalancesResponseSchema>;

export const ClientBotCreateRequestSchema = z.object({
  name: z.string().min(1).max(64),
  email: z.string().email().max(254).optional(),
  initialBalanceCents: z.number().int().nonnegative().max(10_000_000).optional(),
});

export type ClientBotCreateRequest = z.infer<typeof ClientBotCreateRequestSchema>;

export const ClientBotCreateResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    isBot: z.boolean(),
    createdAt: z.string(),
  }),
  balanceCents: z.number().int().nonnegative(),
});

export type ClientBotCreateResponse = z.infer<typeof ClientBotCreateResponseSchema>;

export const ClientSecretResponseSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  warning: z.string(),
});

export type ClientSecretResponse = z.infer<typeof ClientSecretResponseSchema>;
