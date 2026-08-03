/**
 * @odfinex/games-sdk — identity + wallet client for external games.
 */
import {
  ClientTransactionsResponseSchema,
  SessionResponseSchema,
  WalletBalanceSchema,
  WalletDepositCompleteResponseSchema,
  WalletDepositResponseSchema,
  WalletMutationResponseSchema,
  WalletTransactionsResponseSchema,
  WalletWithdrawResponseSchema,
  type ClientTransactionsResponse,
  type SessionResponse,
  type User,
  type WalletBalance,
  type WalletMutationRequest,
  type WalletMutationResponse,
  type WalletTransactionsResponse,
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
   * Withdraw HTG to a MonCash phone. Synchronous Bazik payout.
   * Requires launch token. Debits wallet first; refunds on provider failure.
   */
  async createWithdraw(input: {
    amountHtg: number;
    phone: string;
  }): Promise<{
    id: string;
    status: string;
    amountCents: number;
    balanceCents?: number;
    providerTxId?: string | null;
    dryRun?: boolean;
    warning?: string;
  }> {
    const token = this.requireToken();
    const body = JSON.stringify({
      amountHtg: input.amountHtg,
      phone: input.phone,
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
  WalletWithdrawResponseSchema,
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
  type WalletWithdrawRequest,
  type WalletWithdrawResponse,
  type LedgerEntry,
  type ClientLedgerEntry,
} from "@odfinex/shared";
