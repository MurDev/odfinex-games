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
import { formatHtg } from "@/lib/api";

type NatcashFeeDialogProps = {
  withdrawalId: string;
  amountCents: number;
  displayName?: string | null;
  isSelf?: boolean;
};

export function NatcashFeeDialog({
  withdrawalId,
  amountCents,
  displayName,
  isSelf,
}: NatcashFeeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feeHtg, setFeeHtg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const feeCents = Math.round(parseFloat(feeHtg) * 100);
    if (!Number.isFinite(feeCents) || feeCents < 0) {
      setError("Frais invalide");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/proxy/admin/withdrawal-requests/${withdrawalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeCents }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      setOpen(false);
      setFeeHtg("");
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
        <Button size="sm">Approuver</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Approuver le retrait NatCash</DialogTitle>
            <DialogDescription>
              {isSelf && (
                <span className="block font-medium text-destructive">
                  ATTENTION : c&apos;est VOTRE demande de retrait.
                </span>
              )}
              {displayName ? `${displayName} — ` : ""}
              {formatHtg(amountCents)} a envoyer par virement P2P. Saisis le frais NatCash
              reellement paye pour ce virement (obligatoire).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Frais NatCash paye (HTG)</label>
              <Input
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={feeHtg}
                onChange={(e) => setFeeHtg(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "..." : isSelf ? "Approuver quand meme" : "Approuver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
