import { loadGames } from "@/lib/api";
import { GameGrid } from "@/components/game-tile";

const webUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function HomePage() {
  const games = await loadGames();

  return (
    <>
      <header className="play-header">
        <div className="play-header__inner">
          <a className="play-header__brand" href={webUrl}>
            <span className="play-header__mark">OG</span>
            <span className="play-header__text">Odfinex Games</span>
          </a>
        </div>
      </header>

      <main className="play-page">
        <section className="play-section" aria-labelledby="games-title">
          <h2 id="games-title">Jeux</h2>
          <GameGrid games={games} />
        </section>
      </main>
    </>
  );
}
