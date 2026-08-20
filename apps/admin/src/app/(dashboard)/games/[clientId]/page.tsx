import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminGameStats } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Gamepad2, Users, DollarSign, Activity, PiggyBank } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GameSettings } from "./game-settings";
import { ClientSecretManager } from "./client-secret-manager";

export default async function GameDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  let game: AdminGameStats | null = null;
  let error: string | null = null;

  try {
    game = await adminServerFetch<AdminGameStats>(`/admin/games/${clientId}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load game";
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Jeu introuvable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/games">Retour aux jeux</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const stats = [
    { label: "Joueurs", value: game.playerCount, icon: Users },
    { label: "Debits", value: formatHtg(game.totalDebits), icon: DollarSign },
    { label: "Credits", value: formatHtg(game.totalCredits), icon: Activity },
    { label: "Volume", value: formatHtg(game.volumeCents), icon: DollarSign },
    { label: "Rake accumule", value: formatHtg(game.totalRakeCents), icon: PiggyBank },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/games">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{game.name}</h1>
            <Badge variant={game.environment === "live" ? "default" : "secondary"}>
              {game.environment === "live" ? "Live" : "Sandbox"}
            </Badge>
            <Badge variant={game.isActive ? "success" : "secondary"}>
              {game.isActive ? "Actif" : "Inactif"}
            </Badge>
            <Badge variant={game.walletEnabled ? "success" : "outline"}>
              Wallet {game.walletEnabled ? "Active" : "Desactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{game.clientId}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <GameSettings game={game} />
      <ClientSecretManager clientId={game.clientId} hasSecret={game.hasClientSecret} />
    </div>
  );
}
