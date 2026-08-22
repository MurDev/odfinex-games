import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminLedgerTransaction } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  ledgerLifecycleLabel,
  ledgerMethodLabel,
  ledgerNatureLabel,
  withdrawalStatusLabel,
} from "@/lib/ledger-labels";

const WITHDRAW_STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  processing: "warning",
  successful: "success",
  failed: "destructive",
  cancelled: "secondary",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  let tx: AdminLedgerTransaction | null = null;
  let error: string | null = null;

  try {
    tx = await adminServerFetch<AdminLedgerTransaction>(`/admin/transactions/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load transaction";
  }

  if (error || !tx) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Transaction introuvable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/transactions">Retour aux transactions</Link>
          </Button>
        </div>
      </div>
    );
  }

  const nature = ledgerNatureLabel(tx);
  const method = ledgerMethodLabel(tx.reason);
  const lifecycle = ledgerLifecycleLabel(tx.reason);
  const withdrawLabel = withdrawalStatusLabel(tx.withdrawalStatus);
  const actorLabel = tx.actorName ?? tx.actorEmail ?? tx.actorId ?? "Systeme";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/transactions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{nature}</h1>
            <Badge variant={tx.type === "credit" ? "success" : "outline"}>
              {tx.type === "credit" ? "Credit" : "Debit"}
            </Badge>
            {tx.withdrawalStatus && (
              <Badge variant={WITHDRAW_STATUS_VARIANT[tx.withdrawalStatus] ?? "secondary"}>
                {withdrawLabel ?? tx.withdrawalStatus}
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground">{tx.id}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ecriture de ledger</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Joueur</p>
            <p className="font-medium">{tx.displayName ?? tx.email ?? "Anonyme"}</p>
            {tx.email && <p className="text-xs text-muted-foreground">{tx.email}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Montant</p>
            <p className="font-mono font-medium">{formatHtg(tx.amountCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bonus</p>
            <p className="font-mono font-medium">{formatHtg(tx.bonusCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Solde apres</p>
            <p className="font-mono font-medium">{formatHtg(tx.balanceAfterCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nature</p>
            <p className="font-medium">{nature}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Methode</p>
            <p className="font-medium">{method ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cycle</p>
            <p className="font-medium">{lifecycle ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Statut demande</p>
            <p className="font-medium">{withdrawLabel ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Categorie</p>
            <p className="font-medium">{tx.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Motif brut</p>
            <p className="font-medium">{tx.reason}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jeu / client</p>
            <p className="font-mono font-medium">
              {tx.clientId === "platform" ? "Plateforme" : tx.clientId}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Environnement</p>
            <p className="font-medium">{tx.environment}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Acteur</p>
            <p className="font-medium">{actorLabel}</p>
            {tx.actorId && (tx.actorName || tx.actorEmail) && (
              <p className="font-mono text-xs text-muted-foreground">{tx.actorId}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{new Date(tx.createdAt).toLocaleString()}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Reference</p>
            <p className="font-mono text-xs break-all">{tx.referenceId}</p>
          </div>
          {tx.relatedDepositOrderId && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Ordre de depot MonCash</p>
              <p className="font-mono text-xs break-all">{tx.relatedDepositOrderId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/players/${tx.userId}`}>Voir le joueur</Link>
        </Button>
        {tx.relatedDepositRequestId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/deposit-requests/${tx.relatedDepositRequestId}`}>
              Voir la demande de depot
            </Link>
          </Button>
        )}
        {tx.relatedWithdrawalRequestId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/withdrawal-requests/${tx.relatedWithdrawalRequestId}`}>
              Voir la demande de retrait
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
