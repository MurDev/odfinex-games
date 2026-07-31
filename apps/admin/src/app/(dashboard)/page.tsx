import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminStats } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Gamepad2, ArrowLeftRight, Wallet } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let stats: AdminStats = { totalUsers: 0, totalGames: 0, totalTransactions: 0, totalWalletBalance: 0, totalVolumeCents: 0 };
  let error: string | null = null;

  try {
    stats = await adminServerFetch<AdminStats>("/admin/stats");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load stats";
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Erreur de chargement</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const cards = [
    { title: "Joueurs", value: stats.totalUsers, icon: Users, description: "Comptes inscrits" },
    { title: "Jeux", value: stats.totalGames, icon: Gamepad2, description: "Jeux enregistres" },
    { title: "Transactions", value: stats.totalTransactions, icon: ArrowLeftRight, description: "Ecritures ledger" },
    { title: "Solde total", value: formatHtg(stats.totalWalletBalance), icon: Wallet, description: "Balance cumulee" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de la plateforme Odfinex Games</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Volume total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{formatHtg(stats.totalVolumeCents)}</div>
          <p className="mt-1 text-xs text-muted-foreground">Volume cumule debit + credit</p>
        </CardContent>
      </Card>
    </div>
  );
}
