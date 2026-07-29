import { describe, expect, it } from "vitest";
import {
  generateLaunchToken,
  hashToken,
  launchExpiresAt,
  LAUNCH_TOKEN_TTL_MS,
} from "./tokens.js";

describe("launch tokens", () => {
  it("generates opaque base64url tokens", () => {
    const a = generateLaunchToken();
    const b = generateLaunchToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes deterministically", () => {
    const token = "test-token";
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(hashToken("other"));
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("expires in 7 days", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expires = launchExpiresAt(from);
    expect(expires.getTime() - from.getTime()).toBe(LAUNCH_TOKEN_TTL_MS);
  });
});
