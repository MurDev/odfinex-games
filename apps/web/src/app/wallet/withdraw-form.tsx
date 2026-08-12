"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

export function WithdrawForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawableCents, setWithdrawableCents] = useState<number | null>(null);

  const amountCents = Number.parseInt(amount, 10);
  const canWithdraw =
    Number.isFinite(amountCents) &&
    amountCents > 0 &&
    (withdrawableCents === null || amountCents * 100 <= withdrawableCents);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/v1/wallet`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setWithdrawableCents((data.balanceCents - data.bonusCents) * 100);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const amountHtg = Number.parseInt(amount, 10);
      const res = await fetch(`${apiUrl}/v1/wallet/withdraw`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ amountHtg, phone }),
      });
      const json = (await res.json().catch(() => null)) as {
        status?: string;
        dryRun?: boolean;
        warning?: string;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Withdraw failed (${res.status})`);
      }
      const parts = [`Retrait ${json?.status ?? "ok"}`];
      if (json?.dryRun) parts.push("(simulation)");
      if (json?.warning) parts.push(json.warning);
      setMessage(parts.join(" — "));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginBottom: "1.25rem" }}>
      <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.7, marginBottom: 6 }}>
        Retrait MonCash
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          type="number"
          min={10}
          max={75000}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          placeholder="Montant HTG"
          style={{
            flex: "1 1 100px",
            padding: "0.7rem 0.85rem",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.25)",
            color: "inherit",
          }}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="Tél. MonCash (3XXXXXXX)"
          style={{
            flex: "1 1 140px",
            padding: "0.7rem 0.85rem",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.25)",
            color: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading || !canWithdraw}
          style={{
            background: "rgba(255,255,255,0.12)",
            color: "inherit",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 10,
            padding: "0.7rem 1.1rem",
            fontWeight: 700,
            cursor: loading || !canWithdraw ? "not-allowed" : "pointer",
            opacity: canWithdraw ? 1 : 0.6,
          }}
        >
          {loading ? "…" : "Retirer"}
        </button>
      </div>
      {withdrawableCents !== null && withdrawableCents < (Number.parseInt(amount, 10) * 100 || 0) && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "0.35rem" }}>
          Fonds non retirables insuffisants
        </p>
      )}
      {message && (
        <p style={{ color: "#34d399", fontSize: "0.85rem", marginTop: "0.35rem" }}>{message}</p>
      )}
      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "0.35rem" }}>{error}</p>
      )}
    </form>
  );
}
