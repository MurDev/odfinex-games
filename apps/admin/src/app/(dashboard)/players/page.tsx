import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminPlayer } from "@odfinex/shared";
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
import { Input } from "@/components/ui/input";
import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { PlayersSearch } from "./players-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  let players: AdminPlayer[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const data = await adminServerFetch<{ players: AdminPlayer[]; total: number }>(
      `/admin/players${query}`,
    );
    players = data.players;
    total = data.total;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load players";
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
        <h1 className="text-2xl font-bold tracking-tight">Joueurs</h1>
        <p className="text-sm text-muted-foreground">{total} joueurs inscrits</p>
      </div>

      <PlayersSearch defaultValue={search ?? ""} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun joueur trouve
                  </TableCell>
                </TableRow>
              ) : (
                players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={player.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(player.displayName ?? player.email ?? "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{player.displayName ?? "Anonyme"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{player.email}</TableCell>
                    <TableCell>
                      {player.isAdmin ? (
                        <Badge variant="default">Admin</Badge>
                      ) : (
                        <Badge variant="secondary">Joueur</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatHtg(player.balanceCents)}</TableCell>
                    <TableCell>{player.transactionCount}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/players/${player.id}`}>
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Voir
                        </Link>
                      </Button>
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
