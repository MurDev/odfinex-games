"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

export function GrantButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grant = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/v1/wallet/grant`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amountCents: 10000, reason: "grant" }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(json?.error?.message ?? `Grant failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      <button
        type="button"
        onClick={grant}
        disabled={loading}
        style={{
          background: "#14b8a6",
          color: "#042f2e",
          border: "none",
          borderRadius: 10,
          padding: "0.75rem 1.25rem",
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "…" : "Crédit test (+100 HTG)"}
      </button>
      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>
      )}
    </div>
  );
}
