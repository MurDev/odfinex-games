import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
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

type TxItem = {
  id: string;
  userId: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  reason: string;
  clientId: string;
  referenceId: string;
  createdAt: string;
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
  const { game, type, player } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  let data: TxResponse = { items: [], total: 0 };
  let error: string | null = null;

  try {
    const params = new URLSearchParams();
    if (game) params.set("game", game);
    if (type) params.set("type", type);
    if (player) params.set("player", player);

    data = await adminServerFetch<TxResponse>(`/admin/transactions?${params.toString()}`);
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
        <p className="text-sm text-muted-foreground">
          {data.total} ecritures dans le ledger
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Solde apres</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead>Reference</TableHead>
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
                      <Badge variant={tx.type === "credit" ? "success" : "destructive"}>
                        {tx.type === "credit" ? "Credit" : "Debit"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(tx.amountCents)}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatHtg(tx.balanceAfterCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.reason}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tx.clientId}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                      {tx.referenceId}
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
