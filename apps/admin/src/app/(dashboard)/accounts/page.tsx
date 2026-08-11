import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminAccount, AdminGameStats } from "@odfinex/shared";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { AccountsSearch } from "./accounts-search";
import { CreateAccountDialog } from "./create-account-dialog";
import { CreditDebitDialog } from "@/components/credit-debit-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PER_PAGE = 20;

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; game?: string; page?: string }>;
}) {
  const { search, game, page } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const currentPage = Math.max(1, Number(page) || 1);

  let accounts: AdminAccount[] = [];
  let games: AdminGameStats[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (game) params.set("game", game);
    params.set("limit", String(PER_PAGE));
    params.set("offset", String((currentPage - 1) * PER_PAGE));
    const qs = params.toString();
    const data = await adminServerFetch<{ accounts: AdminAccount[]; total: number }>(
      `/admin/accounts${qs ? `?${qs}` : ""}`,
    );
    accounts = data.accounts;
    total = data.total;
    const gamesData = await adminServerFetch<AdminGameStats[]>("/admin/games");
    games = Array.isArray(gamesData) ? gamesData : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load accounts";
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comptes & Bots</h1>
          <p className="text-sm text-muted-foreground">{total} comptes provisionnes</p>
        </div>
        <CreateAccountDialog games={games} />
      </div>

      <AccountsSearch
        defaultValue={search ?? ""}
        game={game ?? "all"}
        page={currentPage}
        total={total}
        perPage={PER_PAGE}
        games={games}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun compte provisionne
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={undefined} />
                          <AvatarFallback className="text-xs">
                            {(account.displayName ?? account.email ?? "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{account.displayName ?? "Anonyme"}</span>
                          <span className="text-xs text-muted-foreground">{account.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isBot ? "secondary" : "default"}>
                        {account.isBot ? "Bot" : account.isAdmin ? "Operateur" : "Compte"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.gameName ?? account.clientId ?? "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(account.balanceCents)}</TableCell>
                    <TableCell>{account.transactionCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CreditDebitDialog
                          userId={account.id}
                          displayName={account.displayName}
                          email={account.email}
                          balanceCents={account.balanceCents}
                          direction="credit"
                        />
                        <CreditDebitDialog
                          userId={account.id}
                          displayName={account.displayName}
                          email={account.email}
                          balanceCents={account.balanceCents}
                          direction="debit"
                        />
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/players/${account.id}`}>
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Voir
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
