"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

export function DepositForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const amountHtg = Number.parseInt(amount, 10);
      const res = await fetch(`${apiUrl}/v1/wallet/deposit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amountHtg }),
      });
      const json = (await res.json().catch(() => null)) as {
        redirectUrl?: string;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Deposit failed (${res.status})`);
      }
      if (!json?.redirectUrl) throw new Error("Missing redirect URL");
      window.location.href = json.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} style={{ marginBottom: "1.25rem" }}>
      <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.7, marginBottom: 6 }}>
        Dépôt MonCash (HTG)
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="number"
          min={10}
          max={75000}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          style={{
            flex: "1 1 120px",
            padding: "0.7rem 0.85rem",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.25)",
            color: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#F0C75E",
            color: "#1A2F23",
            border: "none",
            borderRadius: 10,
            padding: "0.7rem 1.1rem",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "…" : "Déposer"}
        </button>
      </div>
      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>
      )}
    </form>
  );
}
