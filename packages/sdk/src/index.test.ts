import { describe, expect, it, vi, afterEach } from "vitest";
import { OdfinexGamesClient, OdfinexGamesError } from "./index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OdfinexGamesClient", () => {
  it("builds loginUrl with clientId", () => {
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
      webUrl: "http://localhost:3000",
    });
    const url = client.loginUrl({ returnTo: "http://localhost:5173" });
    expect(url).toContain("clientId=sandbox");
    expect(url).toContain("returnTo=");
  });

  it("getUser succeeds with valid token response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          user: {
            id: "u1",
            displayName: "Ada",
            email: "ada@example.com",
            avatarUrl: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          clientId: "sandbox",
          expiresAt: "2026-01-01T00:15:00.000Z",
        }),
      ),
    );

    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
      sessionToken: "tok",
    });
    const user = await client.getUser();
    expect(user.id).toBe("u1");
    expect(user.displayName).toBe("Ada");
  });

  it("getUser throws OdfinexGamesError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "INVALID_TOKEN", message: "expired" } },
          { status: 401 },
        ),
      ),
    );

    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
      sessionToken: "bad",
    });

    await expect(client.getUser()).rejects.toMatchObject({
      name: "OdfinexGamesError",
      code: "INVALID_TOKEN",
      status: 401,
    } satisfies Partial<OdfinexGamesError>);
  });

  it("getUser fails without token", async () => {
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
    });
    await expect(client.getUser()).rejects.toMatchObject({ code: "MISSING_TOKEN" });
  });

  it("getBalance returns HTG cents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ balanceCents: 1500, currency: "HTG" })),
    );
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
      sessionToken: "tok",
    });
    const bal = await client.getBalance();
    expect(bal).toEqual({ balanceCents: 1500, currency: "HTG" });
  });

  it("debit throws INSUFFICIENT_FUNDS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "INSUFFICIENT_FUNDS", message: "nope" } },
          { status: 402 },
        ),
      ),
    );
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
      sessionToken: "tok",
    });
    await expect(
      client.debit({ amountCents: 100, reason: "bet", referenceId: "r1" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS", status: 402 });
  });

  it("credit returns new balance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ txId: "t1", balanceCents: 200, currency: "HTG" }),
      ),
    );
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "sandbox",
      sessionToken: "tok",
    });
    const res = await client.credit({
      amountCents: 100,
      reason: "win",
      referenceId: "r2",
    });
    expect(res.txId).toBe("t1");
    expect(res.balanceCents).toBe(200);
  });
});
