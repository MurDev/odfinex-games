"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  OdfinexGamesClient,
  OdfinexGamesError,
  type User,
  type WalletBalance,
} from "@odfinex/games-sdk";

function formatHtg(cents: number) {
  return `${(cents / 100).toFixed(2)} HTG`;
}

export default function SandboxGamePage() {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [client, setClient] = useState<OdfinexGamesClient | null>(null);

  useEffect(() => {
    const c = new OdfinexGamesClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
      clientId: "sandbox",
      webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
    });
    setClient(c);

    c.getUser()
      .then(async (u) => {
        setUser(u);
        try {
          setBalance(await c.getBalance());
        } catch {
          /* wallet optional if not enabled */
        }
      })
      .catch((err: unknown) => {
        if (err instanceof OdfinexGamesError) {
          setError(`${err.code}: ${err.message}`);
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!client) return;
    setBalance(await client.getBalance());
  }, [client]);

  const runDebit = async () => {
    if (!client) return;
    setBusy(true);
    setActionError(null);
    try {
      const ref = `sandbox-debit-${Date.now()}`;
      await client.debit({
        amountCents: 100,
        reason: "sandbox_demo",
        referenceId: ref,
      });
      await refreshBalance();
    } catch (err) {
      setActionError(
        err instanceof OdfinexGamesError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Debit failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const runCredit = async () => {
    if (!client) return;
    setBusy(true);
    setActionError(null);
    try {
      const ref = `sandbox-credit-${Date.now()}`;
      await client.credit({
        amountCents: 100,
        reason: "sandbox_demo",
        referenceId: ref,
      });
      await refreshBalance();
    } catch (err) {
      setActionError(
        err instanceof OdfinexGamesError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Credit failed",
      );
    } finally {
      setBusy(false);
    }
  };

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
            <Link href="/launch/sandbox" style={{ color: "#60a5fa" }}>
              /launch/sandbox
            </Link>{" "}
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
            marginBottom: "1.25rem",
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

      {user && (
        <div
          style={{
            background: "rgba(20,184,166,0.08)",
            border: "1px solid rgba(20,184,166,0.3)",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.55 }}>Money demo (Phase 2)</p>
          <p style={{ margin: "0.35rem 0 1rem", fontSize: "1.5rem", fontWeight: 700 }}>
            {balance ? formatHtg(balance.balanceCents) : "—"}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy || !client}
              onClick={runDebit}
              style={btnStyle}
            >
              Debit 1 HTG
            </button>
            <button
              type="button"
              disabled={busy || !client}
              onClick={runCredit}
              style={btnStyle}
            >
              Credit 1 HTG
            </button>
            <button
              type="button"
              disabled={busy || !client}
              onClick={() => refreshBalance().catch(() => undefined)}
              style={{ ...btnStyle, background: "transparent", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Refresh
            </button>
          </div>
          {actionError && (
            <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "0.75rem", marginBottom: 0 }}>
              {actionError}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#14b8a6",
  color: "#042f2e",
  border: "none",
  borderRadius: 8,
  padding: "0.55rem 0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};
