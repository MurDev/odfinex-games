/**
 * @odfinex/games-sdk — identity client for external games.
 */
import {
  SessionResponseSchema,
  type SessionResponse,
  type User,
} from "@odfinex/shared";

export type OdfinexGamesClientOptions = {
  /** Platform API base URL, e.g. https://api.odfinexgames.com */
  baseUrl: string;
  /** Registered game client id */
  clientId: string;
  /**
   * Launch token from play redirect (`?token=`).
   * If omitted, the SDK reads `token` from the current URL (browser).
   */
  sessionToken?: string;
  /** Catalogue / login origin for redirect helpers */
  webUrl?: string;
};

export class OdfinexGamesError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OdfinexGamesError";
    this.status = status;
    this.code = code;
  }
}

function readTokenFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("token") ?? undefined;
}

export class OdfinexGamesClient {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly webUrl: string;
  private sessionToken?: string;

  constructor(options: OdfinexGamesClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.clientId = options.clientId;
    this.webUrl = (options.webUrl ?? "http://localhost:3000").replace(/\/$/, "");
    this.sessionToken = options.sessionToken ?? readTokenFromUrl();
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  /** Build Odfinex login URL (entrée depuis un jeu). */
  loginUrl(options?: { returnTo?: string }): string {
    const url = new URL(`${this.webUrl}/login`);
    url.searchParams.set("clientId", this.clientId);
    if (options?.returnTo) url.searchParams.set("returnTo", options.returnTo);
    return url.toString();
  }

  /** Validate launch token and return the player profile. */
  async getUser(): Promise<User> {
    const session = await this.getSession();
    return session.user;
  }

  async getSession(): Promise<SessionResponse> {
    if (!this.sessionToken) {
      throw new OdfinexGamesError(
        401,
        "MISSING_TOKEN",
        "No launch token. Pass sessionToken or include ?token= in the URL.",
      );
    }

    const res = await fetch(`${this.baseUrl}/v1/session`, {
      headers: {
        Authorization: `Bearer ${this.sessionToken}`,
        Accept: "application/json",
      },
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const err = json as { error?: { code?: string; message?: string } } | null;
      throw new OdfinexGamesError(
        res.status,
        err?.error?.code ?? "REQUEST_FAILED",
        err?.error?.message ?? `GET /v1/session failed (${res.status})`,
      );
    }

    return SessionResponseSchema.parse(json);
  }

  /** Phase 2 — not implemented yet */
  async getBalance(): Promise<never> {
    throw new Error("OdfinexGamesClient.getBalance is not implemented yet (Phase 2)");
  }
}

export {
  HealthResponseSchema,
  UserSchema,
  SessionResponseSchema,
  type HealthResponse,
  type User,
  type SessionResponse,
} from "@odfinex/shared";
