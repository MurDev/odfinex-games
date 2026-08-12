import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// bazik.ts reads BAZIK_* env vars at module load time, so every test that
// needs a specific config must stub the env first and re-import the module
// fresh (vi.resetModules), rather than importing once at the top of the file.
async function loadBazik() {
  vi.resetModules();
  return import("./bazik.js");
}

describe("classifyWithdrawOutcome", () => {
  it("classifies known success statuses as success", async () => {
    const { classifyWithdrawOutcome } = await loadBazik();
    expect(classifyWithdrawOutcome("successful", "tx_1")).toBe("success");
    expect(classifyWithdrawOutcome("completed", null)).toBe("success");
  });

  it("classifies known failure statuses as failed, even with a transactionId", async () => {
    const { classifyWithdrawOutcome } = await loadBazik();
    expect(classifyWithdrawOutcome("failed", "tx_1")).toBe("failed");
    expect(classifyWithdrawOutcome("rejected", null)).toBe("failed");
  });

  it("classifies an unrecognized status or a missing status as ambiguous", async () => {
    const { classifyWithdrawOutcome } = await loadBazik();
    expect(classifyWithdrawOutcome("weird_new_status", null)).toBe("ambiguous");
    expect(classifyWithdrawOutcome(null, null)).toBe("ambiguous");
  });
});

describe("BazikNetworkError (withdraw outcome-unknown path)", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("BAZIK_USER_ID", "test-user");
    vi.stubEnv("BAZIK_SECRET_KEY", "test-secret");
    vi.stubEnv("BAZIK_MOCK", "");
    vi.stubEnv("BAZIK_WITHDRAW_DRY_RUN", "");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.unstubAllEnvs();
  });

  it("throws BazikNetworkError when the auth call itself fails (network error, no response)", async () => {
    const { withdrawToMoncash, BazikNetworkError } = await loadBazik();
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      withdrawToMoncash({
        gdes: 100,
        wallet: "3712345678",
        customerFirstName: "Jean",
        customerLastName: "Pierre",
        referenceId: "wd_1",
      }),
    ).rejects.toBeInstanceOf(BazikNetworkError);
  });

  it("throws a plain Error (not BazikNetworkError) when Bazik responds with a clear rejection", async () => {
    const { withdrawToMoncash, BazikNetworkError } = await loadBazik();
    global.fetch = vi
      .fn()
      // auth call succeeds
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }),
      )
      // withdraw call is explicitly rejected by Bazik
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "insufficient float" }), { status: 400 }),
      );

    let caught: unknown;
    try {
      await withdrawToMoncash({
        gdes: 100,
        wallet: "3712345678",
        customerFirstName: "Jean",
        customerLastName: "Pierre",
        referenceId: "wd_2",
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(BazikNetworkError);
  });

  it("throws BazikNetworkError when the withdraw call itself times out after a successful auth call", async () => {
    const { withdrawToMoncash, BazikNetworkError } = await loadBazik();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }),
      )
      .mockRejectedValueOnce(new DOMException("The operation was aborted", "TimeoutError"));

    await expect(
      withdrawToMoncash({
        gdes: 100,
        wallet: "3712345678",
        customerFirstName: "Jean",
        customerLastName: "Pierre",
        referenceId: "wd_3",
      }),
    ).rejects.toBeInstanceOf(BazikNetworkError);
  });
});
