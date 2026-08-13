import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminDepositRequest } from "@odfinex/shared";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { DepositRequestsFilter } from "./deposit-requests-filter";
import { DepositRequestRowActions } from "./deposit-request-row-actions";

const PER_PAGE = 50;

type DepositRequestsResponse = {
  items: AdminDepositRequest[];
  total: number;
};

export default async function DepositRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: statusParam, page } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const status = statusParam ?? "pending";
  const currentPage = Math.max(1, Number(page) || 1);

  let data: DepositRequestsResponse = { items: [], total: 0 };
  let error: string | null = null;

  try {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    params.set("limit", String(PER_PAGE));
    params.set("offset", String((currentPage - 1) * PER_PAGE));
    data = await adminServerFetch<DepositRequestsResponse>(
      `/admin/deposit-requests?${params.toString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load deposit requests";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demandes de depot NatCash</h1>
        <p className="text-sm text-muted-foreground">Seul Odfinex peut valider ces demandes</p>
      </div>

      <DepositRequestsFilter status={status} page={currentPage} total={data.total} perPage={PER_PAGE} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Ref / preuve</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/deposit-requests/${item.id}`}
                      className="flex flex-col leading-tight hover:text-primary"
                    >
                      <span className="text-sm font-medium">
                        {item.displayName ?? "—"}
                        {item.isSelf && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            votre demande
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.email}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/deposit-requests/${item.id}`}>{formatHtg(item.amountCents)}</Link>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">
                    {item.reference ?? "—"}
                    {item.paymentProofUrl ? (
                      <>
                        <br />
                        <a
                          className="text-primary underline"
                          href={item.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          preuve
                        </a>
                      </>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.gameName ?? item.clientId ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                    {item.adminComment ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DepositRequestRowActions item={item} />
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucune demande
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
