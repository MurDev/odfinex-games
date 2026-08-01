import { GamesListResponseSchema, type GameClient } from "@odfinex/shared";

const apiUrl = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

const GAME_COPY: Record<string, { blurb: string; accent: string }> = {
  "duelpion.live": {
    blurb: "Morpion & Gomoku — duels de pions élégants",
    accent: "#14b8a6",
  },
};

const FALLBACK_GAMES: GameClient[] = [
  {
    clientId: "duelpion.live",
    name: "DUELPION",
    launchUrl: "http://localhost:3002",
    isActive: true,
  },
];

async function loadGames(): Promise<GameClient[]> {
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

function sortGames(games: GameClient[]): GameClient[] {
  const order = ["duelpion.live"];
  return [...games].sort((a, b) => {
    const ai = order.indexOf(a.clientId);
    const bi = order.indexOf(b.clientId);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export default async function HomePage() {
  const games = sortGames(await loadGames());

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "4rem 1.5rem",
      }}
    >
      <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
        Odfinex Games
      </p>
      <h1 style={{ fontSize: "2.5rem", lineHeight: 1.15, margin: "0.5rem 0 1rem" }}>
        Catalogue
      </h1>
      <p style={{ opacity: 0.85, maxWidth: 480, fontSize: "1.05rem" }}>
        Site principal — jeux, compte et wallet. Choisir un jeu lance la connexion
        et redirige vers le jeu avec un token sécurisé.
      </p>

      <section
        style={{
          marginTop: "2.5rem",
          display: "grid",
          gap: "1rem",
        }}
      >
        {games.map((game) => {
          const copy = GAME_COPY[game.clientId] ?? {
            blurb: game.launchUrl,
            accent: "#a3a3a3",
          };
          return (
            <a
              key={game.clientId}
              href={`/launch/${encodeURIComponent(game.clientId)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1.15rem 1.35rem",
                borderRadius: 14,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderLeft: `4px solid ${copy.accent}`,
                color: "#e8eef3",
                textDecoration: "none",
                transition: "background 0.15s ease, transform 0.15s ease",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: "1.1rem" }}>{game.name}</strong>
                <span style={{ opacity: 0.65, fontSize: "0.9rem" }}>{copy.blurb}</span>
              </span>
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  opacity: 0.85,
                  whiteSpace: "nowrap",
                }}
              >
                Jouer →
              </span>
            </a>
          );
        })}
      </section>
    </main>
  );
}
