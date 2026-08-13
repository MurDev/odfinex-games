import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminDepositRequestDetail } from "@odfinex/shared";
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
import { ArrowLeft, Wallet, Calendar } from "lucide-react";
import Link from "next/link";
import { DepositRequestActions } from "./deposit-request-actions";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
};

export default async function DepositRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  let data: AdminDepositRequestDetail | null = null;
  let error: string | null = null;

  try {
    data = await adminServerFetch<AdminDepositRequestDetail>(`/admin/deposit-requests/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load deposit request";
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Demande introuvable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/deposit-requests">Retour aux depots</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { request, ledgerEntry } = data;
  const isImage = request.paymentProofUrl ? /\.(jpe?g|png|webp|gif)(\?|$)/i.test(request.paymentProofUrl) : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/deposit-requests">
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
        <DepositRequestActions
          id={request.id}
          status={request.status}
          isSelf={request.isSelf}
          displayName={request.displayName}
          email={request.email}
          amountCents={request.amountCents}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Montant</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHtg(request.amountCents)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{request.reference ?? "—"}</div>
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
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Preuve de paiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {request.paymentProofUrl ? (
            <a
              href={request.paymentProofUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block"
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={request.paymentProofUrl}
                  alt="Preuve de paiement"
                  className="max-h-80 rounded-md border border-border"
                />
              ) : (
                <span className="text-sm text-primary underline">
                  {request.paymentProofUrl}
                </span>
              )}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune preuve fournie</p>
          )}
        </CardContent>
      </Card>

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
            <p className="text-xs text-muted-foreground">Commentaire</p>
            <p className="text-sm font-medium">{request.adminComment ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ecriture de credit</p>
            <p className="text-sm font-medium">
              {ledgerEntry ? formatHtg(ledgerEntry.amountCents) : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {ledgerEntry && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ecriture de ledger liee
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Montant</TableHead>
                  <TableHead>Solde apres</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">{formatHtg(ledgerEntry.amountCents)}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {formatHtg(ledgerEntry.balanceAfterCents)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {ledgerEntry.referenceId}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(ledgerEntry.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
