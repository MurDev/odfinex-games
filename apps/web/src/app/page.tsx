import Link from "next/link";
import { GamesListResponseSchema, type GameClient } from "@odfinex/shared";
import { HeroSlider } from "@/components/hero-slider";
import { getGameCopy } from "@/lib/game-copy";

const apiUrl = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

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
    <main className="landing">
      <section className="portal-hero" aria-labelledby="hero-title">
        <div className="portal-copy">
          <p className="eyebrow">Plateforme de jeux</p>
          <h1 id="hero-title">Odfinex Games</h1>
          <p className="hero__copy">
            Un portail de jeux rapide, colore et connecte au meme compte joueur.
            Choisis une tuile, lance la session et retrouve ton wallet dans le meme hub.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="#catalogue">
              Explorer les jeux
            </Link>
            <Link className="button button--ghost" href="/wallet">
              Wallet
            </Link>
          </div>
        </div>

        <div className="hero-slider-wrap" aria-label="Hub de jeux">
          <HeroSlider games={games.map((game) => ({ game, copy: getGameCopy(game.clientId) }))} />
        </div>
      </section>

      <section id="catalogue" aria-labelledby="catalogue-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catalogue</p>
            <h2 id="catalogue-title">Jeux disponibles</h2>
          </div>
        </div>

        <div className="games-grid">
        {games.map((game) => {
          const copy = getGameCopy(game.clientId);
          return (
            <a
              key={game.clientId}
              href={`/launch/${encodeURIComponent(game.clientId)}`}
              className="game-card"
              style={{ "--accent": copy.accent, "--glow": copy.glow } as React.CSSProperties}
            >
              <span className="game-card__art">
                <span className="game-card__badge">{copy.badge}</span>
                <span className="game-card__board" />
                <span className="game-card__chip" />
                <span className="game-card__chip" />
                <span className="game-card__spark" />
              </span>
              <span className="game-card__body">
                <span className="game-card__meta">
                  <span className="pill">{copy.category}</span>
                  <span className="pill pill--live">Disponible</span>
                </span>
                <span>
                  <h3>{game.name}</h3>
                  <p>{copy.blurb}</p>
                </span>
                <span className="game-card__footer">
                  <span className="pill">{copy.players}</span>
                  <span className="pill">{copy.pace}</span>
                  <span className="game-card__cta">Jouer</span>
                </span>
              </span>
            </a>
          );
        })}
        </div>
      </section>
    </main>
  );
}
