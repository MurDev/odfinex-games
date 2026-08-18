import { describe, expect, it } from "vitest";
import {
  UserSchema,
  CreateLaunchRequestSchema,
  SessionResponseSchema,
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
});
