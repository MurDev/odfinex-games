import { createHmac, randomUUID } from "node:crypto";

const BASE_URL = process.env.BAZIK_API_URL || "https://api.bazik.io";
const BAZIK_TIMEOUT_MS = Math.min(
  Math.max(Number.parseInt(process.env.BAZIK_TIMEOUT_MS || "15000", 10) || 15_000, 1_000),
  60_000,
);

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function isBazikConfigured(): boolean {
  return Boolean(process.env.BAZIK_USER_ID?.trim() && process.env.BAZIK_SECRET_KEY?.trim());
}

/** Local/dev mock payments without calling Bazik. Never default on in production. */
export function isBazikMock(): boolean {
  if (process.env.NODE_ENV === "production" && !envFlag("BAZIK_MOCK")) return false;
  return envFlag("BAZIK_MOCK") || !isBazikConfigured();
}

export function isWithdrawDryRun(): boolean {
  return envFlag("BAZIK_WITHDRAW_DRY_RUN") || isBazikMock();
}

/**
 * Thrown when a Bazik request never got a response (network error or our own
 * timeout) — the provider may still have processed it. Callers that would
 * otherwise auto-refund/auto-fail on any exception must treat this
 * differently from a definite HTTP-level rejection (`!res.ok`, a real Error):
 * a `BazikNetworkError` means "outcome unknown", not "outcome is failure".
 */
export class BazikNetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BazikNetworkError";
  }
}

async function bazikFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(BAZIK_TIMEOUT_MS),
    });
  } catch (err) {
    throw new BazikNetworkError(
      `Bazik request failed before a response was received (network error or timeout after ${BAZIK_TIMEOUT_MS}ms): ${(err as Error).message}`,
      { cause: err },
    );
  }
}

interface TokenResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  expires_at?: number;
  message?: string;
}

export interface CreatePaymentParams {
  gdes: number;
  description?: string;
  referenceId: string;
  successUrl?: string;
  errorUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentResponse {
  orderId: string;
  gourdes: number;
  status: string;
  redirectUrl: string;
  referenceId: string;
  environment: string;
}

export interface PaymentStatus {
  orderId: string;
  transactionId: string;
  status: "pending" | "successful" | "failed" | "cancelled";
  amount?: number;
  gourdes?: number;
  currency: string;
  referenceId: string;
  timestamp: string;
}

export interface WithdrawParams {
  gdes: number;
  wallet: string;
  customerFirstName: string;
  customerLastName: string;
  referenceId?: string;
  description?: string;
  customerEmail?: string;
}

export function splitFullName(fullName: string): {
  customerFirstName: string;
  customerLastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { customerFirstName: "Unknown", customerLastName: "Unknown" };
  }
  if (parts.length === 1) {
    return { customerFirstName: parts[0]!, customerLastName: parts[0]! };
  }
  return {
    customerFirstName: parts[0]!,
    customerLastName: parts.slice(1).join(" "),
  };
}

const credentials = {
  userID: process.env.BAZIK_USER_ID || "",
  secretKey: process.env.BAZIK_SECRET_KEY || "",
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await bazikFetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bazik auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  const rawToken = data.access_token || data.token;
  if (!rawToken) {
    throw new Error(`Bazik auth failed: ${data.message || "no token in response"}`);
  }

  let expiresAt: number;
  if (data.expires_at) {
    expiresAt = data.expires_at - 60_000;
  } else if (data.expires_in) {
    expiresAt = Date.now() + data.expires_in * 1000 - 60_000;
  } else {
    expiresAt = Date.now() + 3600 * 1000 - 60_000;
  }

  cachedToken = { token: rawToken, expiresAt };
  return rawToken;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function createPayment(
  params: CreatePaymentParams,
): Promise<CreatePaymentResponse> {
  if (isBazikMock()) {
    const orderId = `mock_${randomUUID()}`;
    const webUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return {
      orderId,
      gourdes: params.gdes,
      status: "pending",
      redirectUrl: `${webUrl}/wallet/deposit/complete?orderId=${encodeURIComponent(orderId)}&mock=1`,
      referenceId: params.referenceId,
      environment: "mock",
    };
  }

  const headers = await authHeaders();
  const res = await bazikFetch(`${BASE_URL}/moncash/token`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bazik createPayment failed (${res.status}): ${text}`);
  }

  return (await res.json()) as CreatePaymentResponse;
}

export async function verifyPayment(orderId: string): Promise<PaymentStatus> {
  if (isBazikMock() && orderId.startsWith("mock_")) {
    return {
      orderId,
      transactionId: `mock_tx_${orderId}`,
      status: "successful",
      gourdes: 0,
      currency: "HTG",
      referenceId: "",
      timestamp: new Date().toISOString(),
    };
  }

  const headers = await authHeaders();
  const res = await bazikFetch(`${BASE_URL}/order/${orderId}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bazik verifyPayment failed (${res.status}): ${text}`);
  }

  return (await res.json()) as PaymentStatus;
}

const WITHDRAW_SUCCESS_STATUSES = new Set([
  "successful",
  "success",
  "completed",
  "processed",
  "succeeded",
]);
const WITHDRAW_FAILURE_STATUSES = new Set([
  "failed",
  "failure",
  "error",
  "cancelled",
  "canceled",
  "rejected",
]);

export function normalizeWithdrawResponse(raw: Record<string, unknown>): {
  transactionId: string | null;
  status: string | null;
} {
  const pickString = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };
  return {
    transactionId: pickString("transactionId", "transaction_id", "id"),
    status: pickString("status"),
  };
}

export function classifyWithdrawOutcome(
  status: string | null,
  transactionId: string | null,
): "success" | "failed" | "ambiguous" {
  const normalized = status?.trim().toLowerCase() ?? null;
  if (normalized && WITHDRAW_FAILURE_STATUSES.has(normalized)) return "failed";
  if (normalized && WITHDRAW_SUCCESS_STATUSES.has(normalized)) return "success";
  if (transactionId) return "success";
  if (normalized) return "ambiguous";
  return "ambiguous";
}

export async function withdrawToMoncash(
  params: WithdrawParams,
): Promise<{ transactionId: string | null; status: string | null; dryRun?: boolean }> {
  if (isWithdrawDryRun()) {
    console.warn(
      `[Bazik] DRY RUN withdraw ${params.gdes} HTG -> ${params.wallet} (ref=${params.referenceId ?? "n/a"})`,
    );
    return {
      transactionId: `dryrun_${params.referenceId ?? randomUUID()}`,
      status: "successful",
      dryRun: true,
    };
  }

  const headers = await authHeaders();
  const res = await bazikFetch(`${BASE_URL}/moncash/withdraw`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bazik withdraw failed (${res.status}): ${text}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeWithdrawResponse(raw);
}

export interface BalanceResponse {
  available: number;
  reserved: number;
  currency: string;
  environment: string;
}

export async function getBalance(): Promise<BalanceResponse> {
  if (isBazikMock()) {
    return { available: 0, reserved: 0, currency: "HTG", environment: "mock" };
  }

  const headers = await authHeaders();
  const res = await bazikFetch(`${BASE_URL}/balance`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bazik getBalance failed (${res.status}): ${text}`);
  }

  return (await res.json()) as BalanceResponse;
}

export function verifyWebhookSignatureWithReason(
  rawBody: string,
  signature: string,
  timestamp: string,
  eventId: string,
): { valid: boolean; reason?: string } {
  const secret = process.env.BAZIK_WEBHOOK_SECRET;
  if (!secret) return { valid: false, reason: "BAZIK_WEBHOOK_SECRET missing" };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { valid: false, reason: "timestamp_invalid" };
  const tsMs = ts < 1_000_000_000_000 ? ts * 1000 : ts;
  if (Math.abs(Date.now() - tsMs) > 300_000) {
    return { valid: false, reason: "timestamp_expired" };
  }

  const signedPayload = `${timestamp}.${eventId}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const received = signature.trim().startsWith("v1=")
    ? signature.trim().slice(3)
    : signature.trim();

  if (expected.length !== received.length) {
    return { valid: false, reason: "signature_length_mismatch" };
  }

  // timing-safe compare via buffers
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  if (a.length !== b.length || a.length === 0) {
    return { valid: false, reason: "signature_mismatch" };
  }
  let ok = true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) ok = false;
  }
  return ok ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
