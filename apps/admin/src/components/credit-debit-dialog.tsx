"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CreditDebitDialogProps = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  balanceCents: number;
  direction: "credit" | "debit";
};

export function CreditDebitDialog({
  userId,
  displayName,
  email,
  balanceCents,
  direction,
}: CreditDebitDialogProps) {
  const router = useRouter();
  const isCredit = direction === "credit";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [amountHtg, setAmountHtg] = useState("");
  const [reason, setReason] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [category, setCategory] = useState(
    direction === "credit" ? "admin_investment" : "admin_debit",
  );
  const requiresReference = isCredit && category === "depot_manual";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const amountCents = Math.round(parseFloat(amountHtg) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Montant invalide");
      setLoading(false);
      return;
    }

    if (requiresReference && !referenceId.trim()) {
      setError("Une reference unique est requise pour un depot manuel");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}/${direction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          category,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(referenceId.trim() ? { referenceId: referenceId.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur");
      }

      setOpen(false);
      setAmountHtg("");
      setReason("");
      setReferenceId("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isCredit ? "outline" : "ghost"}
          size="sm"
          className={isCredit ? "text-emerald-500" : "text-destructive"}
        >
          {isCredit ? "Crediter" : "Debiter"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isCredit ? "Crediter" : "Debiter"} le compte</DialogTitle>
          <DialogDescription>
            {displayName ?? email} (solde actuel{" "}
            <span className="font-mono">{(balanceCents / 100).toFixed(2)} HTG</span>
            )
          </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Montant (HTG)</label>
              <Input
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={amountHtg}
                onChange={(e) => setAmountHtg(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {direction === "credit" ? (
                  <>
                    <option value="admin_investment">Approvisionnement</option>
                    <option value="depot_manual">Depot manuel</option>
                    <option value="weekly_reward">Recompense hebdomadaire (classement)</option>
                    <option value="bonus">Bonus</option>
                    <option value="refund">Remboursement</option>
                    <option value="grant">Grant test</option>
                  </>
                ) : (
                  <>
                    <option value="admin_debit">Debit admin</option>
                    <option value="withdrawal">Retrait</option>
                    <option value="game">Jeu</option>
                  </>
                )}
              </select>
              {category === "bonus" && (
                <p className="text-xs text-muted-foreground">
                  Non retirable : ajoute au solde mais reste bloque pour le retrait.
                </p>
              )}
              {category === "weekly_reward" && (
                <p className="text-xs text-muted-foreground">
                  Retirable : ajoute au solde retirable normalement.
                </p>
              )}
            </div>
            {requiresReference && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Reference (unique)</label>
                <Input
                  placeholder="ex. numero de transaction bancaire"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Empeche de crediter deux fois le meme depot.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Motif (optionnel)</label>
              <Input
                placeholder="ex. approvisionnement bot"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "..." : isCredit ? "Crediter" : "Debiter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
