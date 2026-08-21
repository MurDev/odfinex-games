import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveUserIdMock } = vi.hoisted(() => ({
  resolveUserIdMock: vi.fn(),
}));

const { selectLimit, updateWhere } = vi.hoisted(() => ({
  selectLimit: vi.fn(),
  updateWhere: vi.fn(),
}));

const selectChain: {
  from: () => typeof selectChain;
  where: () => typeof selectChain;
  orderBy: () => typeof selectChain;
  limit: (...args: unknown[]) => unknown;
} = {
  from: () => selectChain,
  where: () => selectChain,
  orderBy: () => selectChain,
  limit: (...args: unknown[]) => selectLimit(...args),
};

const updateChain: {
  set: () => typeof updateChain;
  where: (...args: unknown[]) => unknown;
} = {
  set: () => updateChain,
  where: (...args: unknown[]) => updateWhere(...args),
};

vi.mock("../db.js", () => ({
  db: {
    select: () => selectChain,
    update: () => updateChain,
  },
}));

vi.mock("./me.js", () => ({
  resolveUserId: resolveUserIdMock,
  meRoutes: {},
}));

import { notificationRoutes } from "./notifications.js";

function get(path: string, headers: Record<string, string> = {}) {
  return notificationRoutes.request(path, { method: "GET", headers });
}

function post(path: string, headers: Record<string, string> = {}) {
  return notificationRoutes.request(path, { method: "POST", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /me/notifications", () => {
  it("returns 401 without a resolved user", async () => {
    resolveUserIdMock.mockResolvedValue(null);
    const res = await get("/me/notifications");
    expect(res.status).toBe(401);
  });

  it("returns only the acting user's notifications", async () => {
    resolveUserIdMock.mockResolvedValue("user-a");
    const createdAt = new Date("2026-08-21T00:00:00.000Z");
    selectLimit.mockResolvedValue([
      {
        id: "n1",
        userId: "user-a",
        type: "whatsapp_welcome",
        titleFr: "Bienvenue dans la communaute",
        titleEn: "Welcome to the community",
        titleHt: "Byenveni nan kominote a",
        bodyFr: "Rejoins le groupe",
        bodyEn: "Join the group",
        bodyHt: "Antre nan gwoup la",
        linkUrl: "https://chat.whatsapp.com/abc",
        readAt: null,
        createdAt,
      },
    ]);

    const res = await get("/me/notifications");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      unreadCount: number;
      items: Array<{ id: string; type: string; readAt: string | null }>;
    };
    expect(body.unreadCount).toBe(1);
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    expect(item?.id).toBe("n1");
    expect(item?.type).toBe("whatsapp_welcome");
    expect(item?.readAt).toBeNull();
  });
});

describe("POST /me/notifications/:id/read", () => {
  it("returns 404 when the notification belongs to another user", async () => {
    resolveUserIdMock.mockResolvedValue("user-a");
    selectLimit.mockResolvedValue([]);
    const res = await post("/me/notifications/n-other/read");
    expect(res.status).toBe(404);
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it("sets readAt for the acting user's notification", async () => {
    resolveUserIdMock.mockResolvedValue("user-a");
    selectLimit.mockResolvedValue([{ id: "n1", readAt: null }]);
    updateWhere.mockResolvedValue(undefined);

    const res = await post("/me/notifications/n1/read");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateWhere).toHaveBeenCalled();
  });
});
