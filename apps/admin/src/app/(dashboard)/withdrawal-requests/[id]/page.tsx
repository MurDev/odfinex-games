import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminWithdrawalRequestDetail } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Banknote, Calendar, Landmark } from "lucide-react";
import Link from "next/link";
import { WithdrawalRequestActions } from "./withdrawal-request-actions";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  processing: "warning",
  successful: "success",
  failed: "destructive",
  cancelled: "secondary",
};

export default async function WithdrawalRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  let data: AdminWithdrawalRequestDetail | null = null;
  let error: string | null = null;

  try {
    data = await adminServerFetch<AdminWithdrawalRequestDetail>(`/admin/withdrawal-requests/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load withdrawal request";
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Demande introuvable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/withdrawal-requests">Retour aux retraits</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { request, ledgerEntries } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/withdrawal-requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {request.displayName ?? request.email ?? "Anonyme"}
            </h1>
            <Badge variant={STATUS_VARIANT[request.status] ?? "secondary"}>{request.status}</Badge>
            {request.isSelf && <Badge variant="outline">votre demande</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{request.email}</p>
        </div>
        <WithdrawalRequestActions
          id={request.id}
          status={request.status}
          isSelf={request.isSelf}
          displayName={request.displayName}
          email={request.email}
          amountCents={request.amountCents}
          method={request.method}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Montant</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHtg(request.amountCents)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Methode et compte
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium capitalize">{request.method}</div>
            <div className="text-xs text-muted-foreground">
              {request.account}
              {request.accountName ? ` (${request.accountName})` : ""}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jeu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {request.gameName ?? request.clientId ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Date de creation
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(request.createdAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Revue</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Revu par</p>
            <p className="text-sm font-medium">{request.reviewedByName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date de revue</p>
            <p className="text-sm font-medium">
              {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reference provider</p>
            <p className="text-sm font-medium">{request.providerTxId ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Commentaire</p>
            <p className="text-sm font-medium">{request.adminComment ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ecritures de ledger liees
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ledgerEntries.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aucune ecriture
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Solde apres</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant={entry.type === "credit" ? "success" : "destructive"}>
                        {entry.type === "credit" ? "Credit" : "Debit"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(entry.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatHtg(entry.balanceAfterCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.reason}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.referenceId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
