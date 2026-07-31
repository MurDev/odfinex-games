import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "4rem 1.5rem",
      }}
    >
      <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
        play.odfinexgames
      </p>
      <h1 style={{ fontSize: "2.5rem", lineHeight: 1.15, margin: "0.5rem 0 1rem" }}>
        Surface de jeu
      </h1>
      <p style={{ opacity: 0.85, maxWidth: 42, fontSize: "1.05rem" }}>
        Après le choix d&apos;un jeu sur le catalogue, le joueur arrive ici pour lancer la
        session.
      </p>
      <p style={{ marginTop: "2rem" }}>
        <Link href="/launch/sandbox.sandbox" style={{ color: "#60a5fa" }}>
          Lancer Sandbox →
        </Link>
      </p>
    </main>
  );
}
