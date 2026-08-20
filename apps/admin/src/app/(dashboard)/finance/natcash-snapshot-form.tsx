"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NatcashSnapshotForm() {
  const router = useRouter();
  const [balanceHtg, setBalanceHtg] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const balanceCents = Math.round(parseFloat(balanceHtg) * 100);
    if (!Number.isFinite(balanceCents) || balanceCents < 0) {
      setError("Solde invalide");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/proxy/admin/finance/natcash-balance/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balanceCents, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      setBalanceHtg("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <Input
          placeholder="Solde reel (HTG)"
          type="number"
          min="0"
          step="0.01"
          value={balanceHtg}
          onChange={(e) => setBalanceHtg(e.target.value)}
          required
        />
        <Input
          placeholder="Note (optionnel)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "..." : "Declarer"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
