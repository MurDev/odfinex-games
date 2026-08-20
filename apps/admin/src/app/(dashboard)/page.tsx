import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminStats } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserRound,
  Bot,
  Gamepad2,
  ArrowLeftRight,
  Wallet,
  Inbox,
  Banknote,
  Landmark,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let stats: AdminStats = {
    totalAccounts: 0,
    totalUsers: 0,
    totalBots: 0,
    totalGames: 0,
    totalTransactions: 0,
    totalWalletBalance: 0,
    totalVolumeCents: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  };
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
    { title: "Total comptes", value: stats.totalAccounts, icon: Users, description: "Joueurs + bots" },
    { title: "Joueurs humains", value: stats.totalUsers, icon: UserRound, description: "Comptes inscrits" },
    { title: "Bots", value: stats.totalBots, icon: Bot, description: "Comptes provisionnes (jeux)" },
    { title: "Jeux", value: stats.totalGames, icon: Gamepad2, description: "Jeux enregistres" },
    { title: "Transactions", value: stats.totalTransactions, icon: ArrowLeftRight, description: "Ecritures ledger" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de la plateforme Odfinex Games</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/deposit-requests?status=pending">
          <Card className="transition-colors hover:bg-sidebar-accent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Depots en attente
              </CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingDeposits}</div>
              <p className="text-xs text-muted-foreground">Demandes NatCash a valider</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/withdrawal-requests?status=pending">
          <Card className="transition-colors hover:bg-sidebar-accent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Retraits en attente
              </CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingWithdrawals}</div>
              <p className="text-xs text-muted-foreground">MonCash / NatCash a traiter</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Volume total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatHtg(stats.totalVolumeCents)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Volume cumule debit + credit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatHtg(stats.totalWalletBalance)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Balance cumulee des portefeuilles</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Raccourcis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/games">
                Jeux
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/accounts">
                Comptes & Bots
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/players">
                Joueurs
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/transactions">
                Transactions
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/payment-rails">
                <Landmark className="mr-1 h-4 w-4" />
                Payment rails
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
