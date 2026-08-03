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

  it("builds loginUrl with provider=google", () => {
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion",
      webUrl: "http://localhost:3000",
    });
    const url = client.loginUrl({ provider: "google" });
    expect(url).toContain("clientId=duelpion");
    expect(url).toContain("provider=google");
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

  it("getTransactions calls wallet transactions with Bearer token", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:4000/v1/wallet/transactions?limit=10");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return Response.json({
        items: [
          {
            id: "tx1",
            type: "credit",
            amountCents: 1000,
            balanceAfterCents: 1000,
            reason: "moncash_deposit",
            clientId: "platform",
            environment: "live",
            referenceId: "dep_1",
            createdAt: "2026-08-03T00:00:00.000Z",
          },
        ],
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
      sessionToken: "tok",
    });
    const res = await client.getTransactions({ limit: 10 });
    expect(res.total).toBe(1);
    expect(res.items[0]?.reason).toBe("moncash_deposit");
  });

  it("listClientTransactions signs empty body and requires secret", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/v1/client/transactions");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-client-id"]).toBe("duelpion.live");
      expect(headers["x-client-signature"]).toBeTruthy();
      return Response.json({ items: [], total: 0, limit: 30, offset: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
      clientSecret: "sec",
    });
    const res = await client.listClientTransactions({ limit: 30 });
    expect(res.total).toBe(0);

    const bare = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
    });
    await expect(bare.listClientTransactions()).rejects.toMatchObject({
      code: "MISSING_CLIENT_SECRET",
    });
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

  it("creditToUser requires clientSecret and posts to credit-user", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(_url).toBe("http://localhost:4000/v1/wallet/credit-user");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-client-id"]).toBe("duelpion.live");
      expect(headers["x-client-secret"]).toBe("sec");
      expect(headers["x-client-signature"]).toBeTruthy();
      return Response.json({ txId: "t2", balanceCents: 50, currency: "HTG" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
      clientSecret: "sec",
    });
    const res = await client.creditToUser({
      platformUserId: "user-1",
      amountCents: 50,
      reason: "referral",
      referenceId: "comm_1",
    });
    expect(res.txId).toBe("t2");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creditToUser fails without clientSecret", async () => {
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
    });
    await expect(
      client.creditToUser({
        platformUserId: "u",
        amountCents: 1,
        reason: "r",
        referenceId: "x",
      }),
    ).rejects.toMatchObject({ code: "MISSING_CLIENT_SECRET" });
  });

  it("createDeposit posts with launch token and returns redirectUrl", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:4000/v1/wallet/deposit");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer tok");
      const body = JSON.parse(String(init?.body));
      expect(body.amountHtg).toBe(100);
      expect(body.method).toBe("moncash");
      return Response.json({
        orderId: "ord_1",
        amountCents: 10000,
        redirectUrl: "https://moncash.example/pay",
        status: "pending",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
      sessionToken: "tok",
    });
    const res = await client.createDeposit({
      amountHtg: 100,
      successUrl: "https://duelpion.example/ok",
      errorUrl: "https://duelpion.example/err",
    });
    expect(res.redirectUrl).toBe("https://moncash.example/pay");
    expect(res.orderId).toBe("ord_1");
  });

  it("completeDeposit calls order complete endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toContain("/v1/wallet/deposit/ord_1/complete");
        return Response.json({ status: "successful", balanceCents: 5000 });
      }),
    );
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion",
      sessionToken: "tok",
    });
    const res = await client.completeDeposit("ord_1");
    expect(res.status).toBe("successful");
    expect(res.balanceCents).toBe(5000);
  });

  it("createWithdraw posts amount and phone with launch token", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:4000/v1/wallet/withdraw");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      expect(JSON.parse(String(init?.body))).toEqual({
        amountHtg: 50,
        method: "moncash",
        account: "37000000",
        phone: "37000000",
      });
      return Response.json({
        id: "wd1",
        status: "pending",
        amountCents: 5000,
        balanceCents: 1000,
        method: "moncash",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new OdfinexGamesClient({
      baseUrl: "http://localhost:4000",
      clientId: "duelpion.live",
      sessionToken: "tok",
    });
    const res = await client.createWithdraw({ amountHtg: 50, phone: "37000000" });
    expect(res.status).toBe("pending");
    expect(res.balanceCents).toBe(1000);
  });
});
