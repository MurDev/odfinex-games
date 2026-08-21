/**
 * @odfinex/games-sdk — identity + wallet client for external games.
 */
import {
  ClientBalancesResponseSchema,
  ClientBotCreateResponseSchema,
  ClientTransactionsResponseSchema,
  AdminLedgerTransactionSchema,
  RakeEventCreateResponseSchema,
  SessionResponseSchema,
  UpdateUsernameResponseSchema,
  WalletBalanceSchema,
  WalletDepositCompleteResponseSchema,
  WalletDepositResponseSchema,
  WalletMutationResponseSchema,
  WalletTransactionsResponseSchema,
  WalletWithdrawResponseSchema,
  UserNotificationsResponseSchema,
  MarkNotificationReadResponseSchema,
  type ClientBalancesResponse,
  type ClientBotCreateResponse,
  type ClientTransactionsResponse,
  type AdminLedgerTransaction,
  type RakeEventCreateResponse,
  type SessionResponse,
  type UpdateUsernameResponse,
  type User,
  type WalletBalance,
  type WalletMutationRequest,
  type WalletMutationResponse,
  type WalletTransactionsResponse,
  type UserNotificationsResponse,
  type MarkNotificationReadResponse,
} from "@odfinex/shared";

export type OdfinexGamesClientOptions = {
  /** Platform API base URL, e.g. https://api.odfinexgames.com */
  baseUrl: string;
  /** Registered game client id */
  clientId: string;
  /**
   * Launch token from play redirect (`?token=`).
   * If omitted, the SDK reads `token` from the current URL (browser).
   */
  sessionToken?: string;
  /** Client secret for HMAC-signing wallet mutations (S2S auth). */
  clientSecret?: string;
  /** Catalogue / login origin for redirect helpers */
  webUrl?: string;
};

export class OdfinexGamesError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OdfinexGamesError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Compute HMAC-SHA256 signature for S2S wallet mutations.
 * Uses Web Crypto API (browser) or Node.js crypto.
 */
async function computeClientSignature(
  body: string,
  timestamp: string,
  clientSecret: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${body}.${timestamp}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readTokenFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("token") ?? undefined;
}

export class OdfinexGamesClient {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly webUrl: string;
  readonly clientSecret?: string;
  private sessionToken?: string;

  constructor(options: OdfinexGamesClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.clientId = options.clientId;
    this.webUrl = (options.webUrl ?? "http://localhost:3000").replace(/\/$/, "");
    this.clientSecret = options.clientSecret;
    this.sessionToken = options.sessionToken ?? readTokenFromUrl();
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  /** Build Odfinex login URL (entrée depuis un jeu). */
  loginUrl(options?: { returnTo?: string; provider?: "google" }): string {
    const url = new URL(`${this.webUrl}/login`);
    url.searchParams.set("clientId", this.clientId);
    if (options?.returnTo) url.searchParams.set("returnTo", options.returnTo);
    if (options?.provider) url.searchParams.set("provider", options.provider);
    return url.toString();
  }

  private requireToken(): string {
    if (!this.sessionToken) {
      throw new OdfinexGamesError(
        401,
        "MISSING_TOKEN",
        "No launch token. Pass sessionToken or include ?token= in the URL.",
      );
    }
    return this.sessionToken;
  }

  private async parseError(res: Response, fallback: string): Promise<never> {
    const json: unknown = await res.json().catch(() => null);
    const err = json as { error?: { code?: string; message?: string } } | null;
    throw new OdfinexGamesError(
      res.status,
      err?.error?.code ?? "REQUEST_FAILED",
      err?.error?.message ?? fallback,
    );
  }

  /** Validate launch token and return the player profile. */
  async getUser(): Promise<User> {
    const session = await this.getSession();
    return session.user;
  }

  async getSession(): Promise<SessionResponse> {
    const token = this.requireToken();
    const res = await fetch(`${this.baseUrl}/v1/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return this.parseError(res, `GET /v1/session failed (${res.status})`);
    }

    return SessionResponseSchema.parse(await res.json());
  }

  /** Update the player's platform-wide username, shared across every Odfinex game. */
  async updateUsername(username: string): Promise<UpdateUsernameResponse> {
    const token = this.requireToken();
    const res = await fetch(`${this.baseUrl}/v1/me/username`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      return this.parseError(res, `PATCH /v1/me/username failed (${res.status})`);
    }

    return UpdateUsernameResponseSchema.parse(await res.json());
  }

  /** Platform inbox (launch token or platform session). */
  async listNotifications(opts?: {
    limit?: number;
  }): Promise<UserNotificationsResponse> {
    const token = this.requireToken();
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/v1/me/notifications${qs ? `?${qs}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return this.parseError(res, `GET /v1/me/notifications failed (${res.status})`);
    }

    return UserNotificationsResponseSchema.parse(await res.json());
  }

  async markNotificationRead(id: string): Promise<MarkNotificationReadResponse> {
    const token = this.requireToken();
    const res = await fetch(
      `${this.baseUrl}/v1/me/notifications/${encodeURIComponent(id)}/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return this.parseError(
        res,
        `POST /v1/me/notifications/${id}/read failed (${res.status})`,
      );
    }

    return MarkNotificationReadResponseSchema.parse(await res.json());
  }

  async getBalance(): Promise<WalletBalance> {
    const token = this.requireToken();
    const res = await fetch(`${this.baseUrl}/v1/wallet`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return this.parseError(res, `GET /v1/wallet failed (${res.status})`);
    }

    return WalletBalanceSchema.parse(await res.json());
  }

  /** Player ledger history (launch token). Source of truth: Platform API. */
  async getTransactions(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<WalletTransactionsResponse> {
    const token = this.requireToken();
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/v1/wallet/transactions${qs ? `?${qs}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return this.parseError(res, `GET /v1/wallet/transactions failed (${res.status})`);
    }

    return WalletTransactionsResponseSchema.parse(await res.json());
  }

  /**
   * S2S game-admin ledger (this client + related platform deposits).
   * Requires `clientSecret`. Signs an empty body (GET).
   */
  async listClientTransactions(opts?: {
    limit?: number;
    offset?: number;
    type?: "debit" | "credit";
    player?: string;
  }): Promise<ClientTransactionsResponse> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for listClientTransactions",
      );
    }

    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    if (opts?.type) params.set("type", opts.type);
    if (opts?.player) params.set("player", opts.player);
    const qs = params.toString();

    const timestamp = Date.now().toString();
    const body = "";
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);

    const res = await fetch(
      `${this.baseUrl}/v1/client/transactions${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-client-id": this.clientId,
          "x-client-secret": this.clientSecret,
          "x-timestamp": timestamp,
          "x-client-signature": signature,
        },
      },
    );

    if (!res.ok) {
      return this.parseError(res, `GET /v1/client/transactions failed (${res.status})`);
    }

    return ClientTransactionsResponseSchema.parse(await res.json());
  }

  /** S2S: one ledger row this client is allowed to read. */
  async getClientTransaction(id: string): Promise<AdminLedgerTransaction> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for getClientTransaction",
      );
    }

    const timestamp = Date.now().toString();
    const body = "";
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);
    const path = `/v1/client/transactions/${encodeURIComponent(id)}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
    });
    if (!res.ok) {
      return this.parseError(res, `GET ${path} failed (${res.status})`);
    }
    return AdminLedgerTransactionSchema.parse(await res.json());
  }

  async debit(input: WalletMutationRequest): Promise<WalletMutationResponse> {
    return this.mutate("debit", input);
  }

  async credit(input: WalletMutationRequest): Promise<WalletMutationResponse> {
    return this.mutate("credit", input);
  }

  /**
   * S2S credit to a platform user who may be offline (no launch token).
   * Requires `clientSecret`. Used for referral commissions and similar payouts.
   */
  async creditToUser(input: {
    platformUserId: string;
    amountCents: number;
    reason: string;
    referenceId: string;
  }): Promise<WalletMutationResponse> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for creditToUser",
      );
    }

    const timestamp = Date.now().toString();
    const body = JSON.stringify(input);
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v1/wallet/credit-user`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/credit-user failed (${res.status})`);
    }

    return WalletMutationResponseSchema.parse(await res.json());
  }

  /**
   * S2S debit to a platform user who may be offline (no launch token).
   * Requires `clientSecret`. Used for game bots and operator accounts.
   */
  async debitToUser(input: {
    platformUserId: string;
    amountCents: number;
    reason: string;
    referenceId: string;
  }): Promise<WalletMutationResponse> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for debitToUser",
      );
    }

    const timestamp = Date.now().toString();
    const body = JSON.stringify(input);
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v1/wallet/debit-user`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/debit-user failed (${res.status})`);
    }

    return WalletMutationResponseSchema.parse(await res.json());
  }

  /**
   * S2S bulk balances for a list of platform users (e.g. game bots eligibility).
   * Requires `clientSecret`. Users not yet provisioned return balance 0.
   */
  async getBalances(userIds: string[]): Promise<ClientBalancesResponse> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for getBalances",
      );
    }

    const timestamp = Date.now().toString();
    const body = JSON.stringify({ userIds });
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v1/client/balances`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/client/balances failed (${res.status})`);
    }

    return ClientBalancesResponseSchema.parse(await res.json());
  }

  /**
   * S2S provision a game-owned bot account (is_bot user owned by this client).
   * Requires `clientSecret`. Optionally seeds the live wallet via `initialBalanceCents`.
   */
  async createBot(input: {
    name: string;
    email?: string;
    initialBalanceCents?: number;
  }): Promise<ClientBotCreateResponse> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for createBot",
      );
    }

    const timestamp = Date.now().toString();
    const body = JSON.stringify(input);
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v1/client/bots`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/client/bots failed (${res.status})`);
    }

    return ClientBotCreateResponseSchema.parse(await res.json());
  }

  /**
   * S2S record the rake taken on a settled match. Pure analytics event — never
   * moves wallet money. Idempotent on (clientId, referenceId): safe to retry.
   * Requires `clientSecret`.
   */
  async recordRake(input: {
    amountCents: number;
    referenceId: string;
    reason?: string;
  }): Promise<RakeEventCreateResponse> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(
        401,
        "MISSING_CLIENT_SECRET",
        "clientSecret is required for recordRake",
      );
    }

    const timestamp = Date.now().toString();
    const body = JSON.stringify(input);
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v1/client/rake`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/client/rake failed (${res.status})`);
    }

    return RakeEventCreateResponseSchema.parse(await res.json());
  }

  /**
   * Start a MonCash deposit. Returns Bazik `redirectUrl` — send the player there directly.
   * Requires launch token. Does not need clientSecret.
   */
  async createDeposit(input: {
    amountHtg: number;
    successUrl: string;
    errorUrl: string;
    method?: "moncash";
  }): Promise<{
    orderId: string;
    amountCents: number;
    redirectUrl: string;
    status: string;
    mock?: boolean;
  }> {
    const token = this.requireToken();
    const body = JSON.stringify({
      amountHtg: input.amountHtg,
      successUrl: input.successUrl,
      errorUrl: input.errorUrl,
      method: input.method ?? "moncash",
    });

    const res = await fetch(`${this.baseUrl}/v1/wallet/deposit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/deposit failed (${res.status})`);
    }

    return WalletDepositResponseSchema.parse(await res.json());
  }

  /** Confirm a deposit after return from MonCash (or mock). */
  async completeDeposit(orderId: string): Promise<{
    status: "successful" | "pending";
    balanceCents?: number;
    outcome?: string;
    providerStatus?: string;
  }> {
    const token = this.requireToken();
    const res = await fetch(
      `${this.baseUrl}/v1/wallet/deposit/${encodeURIComponent(orderId)}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/deposit/.../complete failed (${res.status})`);
    }

    return WalletDepositCompleteResponseSchema.parse(await res.json());
  }

  /**
   * Withdraw HTG (MonCash or NatCash). Creates a pending request (hold).
   * Odfinex admin must approve. Requires launch token.
   */
  async createWithdraw(input: {
    amountHtg: number;
    method?: "moncash" | "natcash";
    account?: string;
    accountName?: string;
    /** @deprecated use account */
    phone?: string;
  }): Promise<{
    id: string;
    status: string;
    amountCents: number;
    method?: string;
    balanceCents?: number;
    providerTxId?: string | null;
    dryRun?: boolean;
    warning?: string;
  }> {
    const token = this.requireToken();
    const method = input.method ?? "moncash";
    const body = JSON.stringify({
      amountHtg: input.amountHtg,
      method,
      account: input.account ?? input.phone,
      accountName: input.accountName,
      phone: input.phone ?? (method === "moncash" ? input.account : undefined),
    });

    const res = await fetch(`${this.baseUrl}/v1/wallet/withdraw`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/withdraw failed (${res.status})`);
    }

    return WalletWithdrawResponseSchema.parse(await res.json());
  }

  async getPaymentRails(): Promise<{
    items: Array<{
      method: string;
      enabled: boolean;
      accountName: string;
      accountNumber: string;
      minAmountCents: number;
      maxAmountCents: number;
      instructions?: string | null;
    }>;
  }> {
    const token = this.requireToken();
    const res = await fetch(`${this.baseUrl}/v1/wallet/payment-rails`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return this.parseError(res, `GET /v1/wallet/payment-rails failed (${res.status})`);
    }
    return (await res.json()) as {
      items: Array<{
        method: string;
        enabled: boolean;
        accountName: string;
        accountNumber: string;
        minAmountCents: number;
        maxAmountCents: number;
        instructions?: string | null;
      }>;
    };
  }

  async createDepositRequest(input: {
    amountHtg: number;
    reference?: string;
    paymentProofUrl?: string;
    method?: "natcash";
  }): Promise<{ id: string; amountCents: number; status: string; createdAt: string }> {
    const token = this.requireToken();
    const body = JSON.stringify({
      amountHtg: input.amountHtg,
      method: input.method ?? "natcash",
      reference: input.reference,
      paymentProofUrl: input.paymentProofUrl,
    });
    const res = await fetch(`${this.baseUrl}/v1/wallet/deposit-requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    });
    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/deposit-requests failed (${res.status})`);
    }
    return (await res.json()) as {
      id: string;
      amountCents: number;
      status: string;
      createdAt: string;
    };
  }

  async listDepositRequests(limit = 20): Promise<{
    items: Array<{
      id: string;
      amountCents: number;
      status: string;
      paymentProofUrl?: string | null;
      reference?: string | null;
      adminComment?: string | null;
      createdAt: string;
    }>;
  }> {
    const token = this.requireToken();
    const res = await fetch(
      `${this.baseUrl}/v1/wallet/deposit-requests?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      return this.parseError(res, `GET /v1/wallet/deposit-requests failed (${res.status})`);
    }
    return (await res.json()) as {
      items: Array<{
        id: string;
        amountCents: number;
        status: string;
        paymentProofUrl?: string | null;
        reference?: string | null;
        adminComment?: string | null;
        createdAt: string;
      }>;
    };
  }

  async cancelDepositRequest(id: string): Promise<{ id: string; status: string }> {
    const token = this.requireToken();
    const res = await fetch(
      `${this.baseUrl}/v1/wallet/deposit-requests/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      return this.parseError(res, `POST cancel deposit-request failed (${res.status})`);
    }
    return (await res.json()) as { id: string; status: string };
  }

  async listWithdrawRequests(limit = 20): Promise<{
    items: Array<{
      id: string;
      amountCents: number;
      method: string;
      account: string;
      status: string;
      createdAt: string;
    }>;
  }> {
    const token = this.requireToken();
    const res = await fetch(
      `${this.baseUrl}/v1/wallet/withdraw-requests?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      return this.parseError(res, `GET /v1/wallet/withdraw-requests failed (${res.status})`);
    }
    return (await res.json()) as {
      items: Array<{
        id: string;
        amountCents: number;
        method: string;
        account: string;
        status: string;
        createdAt: string;
      }>;
    };
  }

  async cancelWithdrawRequest(id: string): Promise<{
    id: string;
    status: string;
    balanceCents?: number;
  }> {
    const token = this.requireToken();
    const res = await fetch(
      `${this.baseUrl}/v1/wallet/withdraw-requests/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      return this.parseError(res, `POST cancel withdraw-request failed (${res.status})`);
    }
    return (await res.json()) as {
      id: string;
      status: string;
      balanceCents?: number;
    };
  }

  /** S2S: list deposit requests for this client (read-only). */
  async listClientDepositRequests(opts?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{ items: unknown[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    return this.s2sGet(`/v1/client/deposit-requests${qs ? `?${qs}` : ""}`);
  }

  /** S2S: list withdrawal requests for this client (read-only). */
  async listClientWithdrawalRequests(opts?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{ items: unknown[]; total: number }> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    return this.s2sGet(`/v1/client/withdrawal-requests${qs ? `?${qs}` : ""}`);
  }

  private async s2sGet(path: string): Promise<{ items: unknown[]; total: number }> {
    if (!this.clientSecret) {
      throw new OdfinexGamesError(401, "MISSING_SECRET", "clientSecret required for S2S");
    }
    const timestamp = Date.now().toString();
    const body = "";
    const signature = await computeClientSignature(body, timestamp, this.clientSecret);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-timestamp": timestamp,
        "x-client-signature": signature,
      },
    });
    if (!res.ok) {
      return this.parseError(res, `GET ${path} failed (${res.status})`);
    }
    return (await res.json()) as { items: unknown[]; total: number };
  }

  private async mutate(
    kind: "debit" | "credit",
    input: WalletMutationRequest,
  ): Promise<WalletMutationResponse> {
    const token = this.requireToken();
    const timestamp = Date.now().toString();
    const body = JSON.stringify(input);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (this.clientSecret) {
      const signature = await computeClientSignature(body, timestamp, this.clientSecret);
      headers["x-client-secret"] = this.clientSecret;
      headers["x-timestamp"] = timestamp;
      headers["x-client-signature"] = signature;
    }

    const res = await fetch(`${this.baseUrl}/v1/wallet/${kind}`, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      return this.parseError(res, `POST /v1/wallet/${kind} failed (${res.status})`);
    }

    return WalletMutationResponseSchema.parse(await res.json());
  }
}

export {
  HealthResponseSchema,
  UserSchema,
  SessionResponseSchema,
  WalletBalanceSchema,
  WalletMutationRequestSchema,
  WalletMutationResponseSchema,
  WalletCreditUserRequestSchema,
  WalletDepositRequestSchema,
  WalletDepositResponseSchema,
  WalletDepositCompleteResponseSchema,
  WalletTransactionsResponseSchema,
  ClientTransactionsResponseSchema,
  ClientBalancesRequestSchema,
  ClientBalancesResponseSchema,
  ClientBotCreateRequestSchema,
  ClientBotCreateResponseSchema,
  RakeEventCreateRequestSchema,
  RakeEventCreateResponseSchema,
  WalletWithdrawResponseSchema,
  UserNotificationsResponseSchema,
  MarkNotificationReadResponseSchema,
  type HealthResponse,
  type User,
  type SessionResponse,
  type WalletBalance,
  type WalletMutationRequest,
  type WalletMutationResponse,
  type WalletCreditUserRequest,
  type WalletDepositRequest,
  type WalletDepositResponse,
  type WalletDepositCompleteResponse,
  type WalletTransactionsResponse,
  type ClientTransactionsResponse,
  type ClientBalancesRequest,
  type ClientBalancesResponse,
  type ClientBalanceEntry,
  type ClientBotCreateRequest,
  type ClientBotCreateResponse,
  type RakeEventCreateRequest,
  type RakeEventCreateResponse,
  type WalletWithdrawRequest,
  type WalletWithdrawResponse,
  type UserNotificationsResponse,
  type MarkNotificationReadResponse,
  type LedgerEntry,
  type ClientLedgerEntry,
} from "@odfinex/shared";
