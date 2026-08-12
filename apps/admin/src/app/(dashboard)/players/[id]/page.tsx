import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminPlayer } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { CreditDebitDialog } from "@/components/credit-debit-dialog";

type PlayerDetail = {
  player: AdminPlayer & { sandboxBalanceCents: number };
  transactions: Array<{
    id: string;
    type: string;
    amountCents: number;
    balanceAfterCents: number;
    bonusCents: number;
    category: string | null;
    actorId: string | null;
    reason: string;
    clientId: string;
    environment: string;
    referenceId: string;
    createdAt: string;
  }>;
};

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  let data: PlayerDetail | null = null;
  let error: string | null = null;

  try {
    data = await adminServerFetch<PlayerDetail>(`/admin/players/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load player";
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Joueur introuvable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/players">Retour aux joueurs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { player, transactions } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/players">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-12 w-12">
          <AvatarImage src={player.avatarUrl ?? undefined} />
          <AvatarFallback>
            {(player.displayName ?? player.email ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{player.displayName ?? "Anonyme"}</h1>
            {player.isAdmin && <Badge>Admin</Badge>}
            {player.isBot && <Badge variant="secondary">Bot</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{player.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <CreditDebitDialog
            userId={player.id}
            displayName={player.displayName}
            email={player.email}
            balanceCents={player.balanceCents}
            direction="credit"
          />
          <CreditDebitDialog
            userId={player.id}
            displayName={player.displayName}
            email={player.email}
            balanceCents={player.balanceCents}
            direction="debit"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHtg(player.balanceCents)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bonus</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHtg(player.bonusCents)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde sandbox
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHtg(player.sandboxBalanceCents)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{player.transactionCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inscription
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(player.createdAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Historique des transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aucune transaction
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Environnement</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Solde apres</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant={tx.type === "credit" ? "success" : "destructive"}>
                        {tx.type === "credit" ? "Credit" : "Debit"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tx.environment}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(tx.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(tx.bonusCents)}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatHtg(tx.balanceAfterCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.category ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.actorId ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{tx.reason}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tx.clientId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
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
