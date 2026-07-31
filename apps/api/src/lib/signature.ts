import { createHmac, createHash, randomBytes } from "node:crypto";

/**
 * Generate a new client secret (base64url, 32 bytes).
 * Return raw secret + its SHA-256 hash.
 */
export function generateClientSecret() {
  const secret = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(secret).digest("hex");
  return { secret, hash };
}

/**
 * Hash a raw secret for DB storage/comparison.
 */
export function hashClientSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Compute HMAC-SHA256 signature for a wallet mutation.
 * Combines body + timestamp to prevent replay.
 */
export function computeClientSignature(
  body: string,
  timestamp: string,
  clientSecret: string,
): string {
  return createHmac("sha256", clientSecret)
    .update(`${body}.${timestamp}`)
    .digest("hex");
}

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validate timestamp is within tolerance (anti-replay).
 */
export function isValidTimestamp(timestamp: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= TIMESTAMP_TOLERANCE_MS;
}
