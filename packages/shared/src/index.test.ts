import { describe, expect, it } from "vitest";
import {
  UserSchema,
  CreateLaunchRequestSchema,
  SessionResponseSchema,
  UserNotificationsResponseSchema,
} from "./index.js";

describe("shared schemas", () => {
  it("parses a public user", () => {
    const user = UserSchema.parse({
      id: "u1",
      displayName: "Ada",
      username: "ada",
      email: "ada@example.com",
      avatarUrl: "https://example.com/a.png",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(user.displayName).toBe("Ada");
  });

  it("requires clientId for launch", () => {
    expect(CreateLaunchRequestSchema.safeParse({}).success).toBe(false);
    expect(CreateLaunchRequestSchema.parse({ clientId: "sandbox" }).clientId).toBe(
      "sandbox",
    );
  });

  it("parses session response", () => {
    const session = SessionResponseSchema.parse({
      user: {
        id: "u1",
        displayName: null,
        username: null,
        email: "a@b.co",
        avatarUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      clientId: "sandbox",
      expiresAt: "2026-01-01T00:15:00.000Z",
    });
    expect(session.clientId).toBe("sandbox");
  });

  it("parses a user notifications response", () => {
    const parsed = UserNotificationsResponseSchema.parse({
      items: [
        {
          id: "n1",
          type: "whatsapp_welcome",
          titleFr: "Bienvenue dans la communaute",
          titleEn: "Welcome to the community",
          titleHt: "Byenveni nan kominote a",
          bodyFr: "Rejoins le groupe WhatsApp pour echanger avec les autres joueurs.",
          bodyEn: "Join the WhatsApp group to chat with other players.",
          bodyHt: "Antre nan gwoup WhatsApp la pou echanje ak lot jwe yo.",
          linkUrl: "https://chat.whatsapp.com/abc",
          readAt: null,
          createdAt: "2026-08-21T00:00:00.000Z",
        },
      ],
      unreadCount: 1,
    });
    expect(parsed.items[0]?.type).toBe("whatsapp_welcome");
    expect(parsed.unreadCount).toBe(1);
  });
});
