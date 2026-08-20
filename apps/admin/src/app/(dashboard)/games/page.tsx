import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminGameStats } from "@odfinex/shared";
import { Button } from "@/components/ui/button";
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
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { NewGameButton } from "./new-game-button";

export default async function GamesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let games: AdminGameStats[] = [];
  let error: string | null = null;

  try {
    const data = await adminServerFetch<{ games: AdminGameStats[] }>("/admin/games");
    games = data.games;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load games";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jeux</h1>
          <p className="text-sm text-muted-foreground">Jeux enregistres sur la plateforme</p>
        </div>
        <NewGameButton />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client ID</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Environnement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>Joueurs</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Rake</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                  {games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Aucun jeu enregistre
                  </TableCell>
                </TableRow>
              ) : (
                games.map((game) => (
                  <TableRow key={game.clientId}>
                  <TableCell className="font-mono text-xs">{game.clientId}</TableCell>
                  <TableCell className="font-medium">{game.name}</TableCell>
                  <TableCell>
                    <Badge variant={game.environment === "live" ? "default" : "secondary"}>
                      {game.environment === "live" ? "Live" : "Sandbox"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={game.isActive ? "success" : "secondary"}>
                      {game.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={game.walletEnabled ? "success" : "outline"}>
                      {game.walletEnabled ? "Active" : "Desactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={game.hasClientSecret ? "success" : "outline"}>
                      {game.hasClientSecret ? "Configure" : "Absent"}
                    </Badge>
                  </TableCell>
                  <TableCell>{game.playerCount}</TableCell>
                  <TableCell>{formatHtg(game.volumeCents)}</TableCell>
                  <TableCell>{formatHtg(game.totalRakeCents)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/games/${game.clientId}`}>
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Gerer
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
