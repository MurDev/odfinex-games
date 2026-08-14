import type { GameClient } from "@odfinex/shared";
import { loadGames } from "@/lib/api";

const webUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function GameTile({ game }: { game: GameClient }) {
  const hash = hashSeed(game.clientId);
  const hue = hash % 360;
  const accent = `hsl(${hue} 72% 56%)`;
  const accent2 = `hsl(${(hue + 34) % 360} 72% 46%)`;

  return (
    <a
      className="play-tile"
      href={`${webUrl}/launch/${encodeURIComponent(game.clientId)}`}
      style={{ "--accent": accent, "--accent-2": accent2 } as React.CSSProperties}
    >
      <span className="play-tile__icon" aria-hidden="true">
        <span className="play-tile__initials">{initialsFor(game.name)}</span>
      </span>
      <span className="play-tile__name">{game.name}</span>
    </a>
  );
}

export default async function HomePage() {
  const games = await loadGames();
  const featured = games.slice(0, 3);
  const showFeatured = games.length >= 2;

  return (
    <main className="play-page">
      <header className="play-header">
        <a className="play-header__brand" href={webUrl}>
          <span className="play-header__mark">OG</span>
          <span className="play-header__text">Odfinex Games</span>
        </a>
        <a className="play-header__login" href={`${webUrl}/login`}>
          Se connecter
        </a>
      </header>

      {showFeatured && (
        <section className="play-section play-featured" aria-labelledby="featured-title">
          <h2 id="featured-title">Jeux en vedette</h2>
          <div className="play-featured__track">
            {featured.map((game) => (
              <GameTile key={game.clientId} game={game} />
            ))}
          </div>
        </section>
      )}

      <section className="play-section" aria-labelledby="all-games-title">
        <h2 id="all-games-title">Tous les jeux</h2>
        <div className="play-grid">
          {games.map((game) => (
            <GameTile key={game.clientId} game={game} />
          ))}
        </div>
      </section>
    </main>
  );
}
