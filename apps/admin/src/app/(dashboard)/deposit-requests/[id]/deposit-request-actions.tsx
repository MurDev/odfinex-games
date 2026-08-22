"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/reject-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatHtg } from "@/lib/api";

type DepositRequestActionsProps = {
  id: string;
  status: string;
  isSelf?: boolean;
  displayName: string | null;
  email: string | null;
  amountCents: number;
};

export function DepositRequestActions({
  id,
  status,
  isSelf,
  displayName,
  email,
  amountCents,
}: DepositRequestActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reject(comment: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/proxy/admin/deposit-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      toast.success("Depot rejete");
      router.refresh();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/proxy/admin/deposit-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      toast.success("Depot approuve");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (status !== "pending") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {isSelf ? (
          <ConfirmDialog
            trigger={
              <Button size="sm" disabled={busy}>
                Approuver
              </Button>
            }
            title="Approuver votre propre demande ?"
            description="C'est VOTRE demande de depot. Verifiez la preuve de paiement avant de confirmer."
            confirmLabel="Approuver quand meme"
            onConfirm={() => void approve()}
          />
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void approve()}>
            Approuver
          </Button>
        )}
        <RejectDialog
          busy={busy}
          title="Rejeter la demande de depot"
          description={
            isSelf
              ? `ATTENTION: c'est VOTRE demande. ${displayName ?? email} (${formatHtg(amountCents)})`
              : `${displayName ?? email} (${formatHtg(amountCents)})`
          }
          onConfirm={reject}
          trigger={
            <Button size="sm" variant="outline" disabled={busy}>
              Rejeter
            </Button>
          }
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
