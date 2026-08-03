import { describe, expect, it } from "vitest";
import {
  computeClientSignature,
  generateClientSecret,
  hashClientSecret,
  isValidTimestamp,
} from "./signature.js";

describe("client signature helpers", () => {
  it("hashes secrets deterministically", () => {
    const { secret, hash } = generateClientSecret();
    expect(hashClientSecret(secret)).toBe(hash);
    expect(hash).toHaveLength(64);
  });

  it("computes stable HMAC for body + timestamp", () => {
    const body = JSON.stringify({ amountCents: 100, reason: "win", referenceId: "r1" });
    const ts = "1700000000000";
    const secret = "test-secret";
    const a = computeClientSignature(body, ts, secret);
    const b = computeClientSignature(body, ts, secret);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(computeClientSignature(body + "x", ts, secret)).not.toBe(a);
  });

  it("accepts timestamps within 5 minutes", () => {
    expect(isValidTimestamp(String(Date.now()))).toBe(true);
    expect(isValidTimestamp(String(Date.now() - 4 * 60 * 1000))).toBe(true);
    expect(isValidTimestamp(String(Date.now() - 10 * 60 * 1000))).toBe(false);
    expect(isValidTimestamp("not-a-number")).toBe(false);
  });
});
