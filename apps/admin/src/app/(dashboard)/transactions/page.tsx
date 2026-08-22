import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import type { AdminGameStats } from "@odfinex/shared";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionsFilter } from "./transactions-filter";
import { TransactionRow } from "./transaction-row";

const PER_PAGE = 30;

export type TxItem = {
  id: string;
  userId: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  bonusCents: number;
  category: string | null;
  actorId: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  reason: string;
  clientId: string;
  referenceId: string;
  environment: string;
  createdAt: string;
  displayName: string | null;
  email: string | null;
  withdrawalStatus?: string | null;
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
  const { search, game, type, kind, page } = await searchParams;
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
    if (kind) params.set("kind", kind);
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
        kind={kind ?? "all"}
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
                  <TableHead>Nature</TableHead>
                  <TableHead>Sens</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Solde apres</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
