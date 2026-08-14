import { CreateLaunchResponseSchema, GamesListResponseSchema, type GameClient } from "@odfinex/shared";

const apiUrl = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const FALLBACK_GAMES: GameClient[] = [
  {
    clientId: "duelpion.live",
    name: "DUELPION",
    launchUrl: "http://localhost:3002",
    isActive: true,
  },
];

export async function loadGames(): Promise<GameClient[]> {
  try {
    const res = await fetch(`${apiUrl}/v1/games`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = GamesListResponseSchema.parse(await res.json());
    return data.games.filter((g) => g.isActive);
  } catch {
    return FALLBACK_GAMES;
  }
}

export async function createLaunch(clientId: string, sessionToken: string) {
  const res = await fetch(`${apiUrl}/v1/launch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      Accept: "application/json",
    },
    body: JSON.stringify({ clientId }),
    cache: "no-store",
  });

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json as { error?: { code?: string; message?: string } } | null;
    return {
      ok: false as const,
      status: res.status,
      code: err?.error?.code ?? "LAUNCH_FAILED",
      message: err?.error?.message ?? `Launch failed (${res.status})`,
    };
  }

  return {
    ok: true as const,
    data: CreateLaunchResponseSchema.parse(json),
  };
}
