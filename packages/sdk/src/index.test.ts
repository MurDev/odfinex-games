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
});
