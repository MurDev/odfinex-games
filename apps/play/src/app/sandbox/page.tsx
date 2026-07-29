"use client";

import { useEffect, useState } from "react";
import { OdfinexGamesClient, OdfinexGamesError, type User } from "@odfinex/games-sdk";

export default function SandboxGamePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = new OdfinexGamesClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
      clientId: "sandbox",
      webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
    });

    client
      .getUser()
      .then(setUser)
      .catch((err: unknown) => {
        if (err instanceof OdfinexGamesError) {
          setError(`${err.code}: ${err.message}`);
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, fontSize: "0.8rem" }}>
        Sandbox game
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 1rem" }}>Jeu de référence</h1>
      <p style={{ opacity: 0.75, marginBottom: "2rem" }}>
        Page locale qui consomme <code>@odfinex/games-sdk</code> via le token de launch.
      </p>

      {loading && <p style={{ opacity: 0.6 }}>Chargement du joueur…</p>}

      {error && (
        <div
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.35)",
            borderRadius: 10,
            padding: "1rem 1.25rem",
          }}
        >
          <p style={{ margin: 0, color: "#f87171" }}>{error}</p>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            Lance via{" "}
            <a href="/launch/sandbox" style={{ color: "#60a5fa" }}>
              /launch/sandbox
            </a>{" "}
            (connecté).
          </p>
        </div>
      )}

      {user && (
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.55 }}>SDK getUser()</p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "1.25rem", fontWeight: 600 }}>
            {user.displayName ?? "Joueur"}
          </p>
          <p style={{ margin: "0.25rem 0 0", opacity: 0.7 }}>{user.email}</p>
          <p style={{ margin: "1rem 0 0", fontFamily: "monospace", fontSize: "0.8rem", opacity: 0.55 }}>
            {user.id}
          </p>
        </div>
      )}
    </main>
  );
}
