import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminGameStats } from "@odfinex/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { TransactionsFilter } from "./transactions-filter";

const PER_PAGE = 30;

type TxItem = {
  id: string;
  userId: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  reason: string;
  clientId: string;
  referenceId: string;
  environment: string;
  createdAt: string;
  displayName: string | null;
  email: string | null;
};

type TxResponse = {
  items: TxItem[];
  total: number;
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { search, game, type, page } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const currentPage = Math.max(1, Number(page) || 1);
  let data: TxResponse = { items: [], total: 0 };
  let games: AdminGameStats[] = [];
  let error: string | null = null;

  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (game) params.set("game", game);
    if (type) params.set("type", type);
    params.set("limit", String(PER_PAGE));
    params.set("offset", String((currentPage - 1) * PER_PAGE));
    data = await adminServerFetch<TxResponse>(`/admin/transactions?${params.toString()}`);
    const gamesData = await adminServerFetch<AdminGameStats[]>("/admin/games");
    games = Array.isArray(gamesData) ? gamesData : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load transactions";
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">{data.total} ecritures dans le ledger</p>
      </div>

      <TransactionsFilter
        defaultValue={search ?? ""}
        game={game ?? "all"}
        type={type ?? "all"}
        page={currentPage}
        total={data.total}
        perPage={PER_PAGE}
        games={games}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Solde apres</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucune transaction
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Link
                        href={`/players/${tx.userId}`}
                        className="flex flex-col leading-tight hover:text-primary"
                      >
                        <span className="font-medium">{tx.displayName ?? "Anonyme"}</span>
                        {tx.email && (
                          <span className="text-xs text-muted-foreground">{tx.email}</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "credit" ? "success" : "destructive"}>
                        {tx.type === "credit" ? "Credit" : "Debit"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(tx.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatHtg(tx.balanceAfterCents)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {tx.reason}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tx.clientId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString()}
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
