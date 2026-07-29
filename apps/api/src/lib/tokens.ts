import { createHash, randomBytes } from "node:crypto";

export const LAUNCH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — game sessions without catalogue re-entry

export function generateLaunchToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function launchExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + LAUNCH_TOKEN_TTL_MS);
}
