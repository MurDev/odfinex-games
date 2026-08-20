import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type {
  AdminBazikBalance,
  AdminFinanceOverview,
  AdminNatcashBalance,
  AdminRakeStats,
} from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Landmark, PiggyBank, TrendingDown, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Link from "next/link";
import { NatcashSnapshotForm } from "./natcash-snapshot-form";

async function safeFetch<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await adminServerFetch<T>(path), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Erreur de chargement" };
  }
}

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [bazik, natcash, rake, overview] = await Promise.all([
    safeFetch<AdminBazikBalance>("/admin/finance/bazik-balance"),
    safeFetch<AdminNatcashBalance>("/admin/finance/natcash-balance"),
    safeFetch<AdminRakeStats>("/admin/finance/rake"),
    safeFetch<AdminFinanceOverview>("/admin/finance/overview"),
  ]);

  const netProfit = overview.data?.netProfitCents ?? 0;
  const isProfit = netProfit >= 0;
  const totalFees =
    (overview.data?.estimatedBazikDepositFeesCents ?? 0) +
    (overview.data?.estimatedBazikWithdrawalFeesCents ?? 0) +
    (overview.data?.totalNatcashFeesCents ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground">
          Marge reelle : rake accumule moins les frais de depot/retrait absorbes.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Profit net (tous jeux, depuis la mise en place du tracking)
          </CardTitle>
          {isProfit ? (
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
        </CardHeader>
        <CardContent>
          {overview.error ? (
            <p className="text-sm text-destructive">{overview.error}</p>
          ) : (
            <>
              <div className={`text-3xl font-bold ${isProfit ? "text-emerald-600" : "text-destructive"}`}>
                {formatHtg(netProfit)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Rake {formatHtg(overview.data?.totalRakeCents ?? 0)} − frais absorbes {formatHtg(totalFees)}{" "}
                (Bazik depot {formatHtg(overview.data?.estimatedBazikDepositFeesCents ?? 0)} · Bazik retrait{" "}
                {formatHtg(overview.data?.estimatedBazikWithdrawalFeesCents ?? 0)} · NatCash{" "}
                {formatHtg(overview.data?.totalNatcashFeesCents ?? 0)})
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Les frais Bazik sont estimes a partir des taux fixes annonces (2,9% depot, 5% retrait) : Bazik
                ne communique pas le montant exact preleve par transaction.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Depots &amp; retraits (tous jeux, portefeuille Odfinex partage)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.error ? (
            <p className="text-sm text-destructive">{overview.error}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowDownToLine className="h-3 w-3" /> MonCash depots
                </div>
                <div className="text-lg font-semibold">
                  {formatHtg(overview.data?.totalMoncashDepositsCents ?? 0)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpFromLine className="h-3 w-3" /> MonCash retraits
                </div>
                <div className="text-lg font-semibold">
                  {formatHtg(overview.data?.totalMoncashWithdrawalsCents ?? 0)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowDownToLine className="h-3 w-3" /> NatCash depots
                </div>
                <div className="text-lg font-semibold">
                  {formatHtg(overview.data?.totalNatcashDepositsCents ?? 0)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpFromLine className="h-3 w-3" /> NatCash retraits
                </div>
                <div className="text-lg font-semibold">
                  {formatHtg(overview.data?.totalNatcashWithdrawalsCents ?? 0)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde Bazik</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {bazik.error ? (
              <p className="text-sm text-destructive">{bazik.error}</p>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatHtg((bazik.data?.available ?? 0) * 100)}</div>
                <p className="text-xs text-muted-foreground">
                  Disponible {bazik.data?.environment ? `(${bazik.data.environment})` : ""} · Reserve{" "}
                  {formatHtg((bazik.data?.reserved ?? 0) * 100)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde NatCash estime
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {natcash.error ? (
              <p className="text-sm text-destructive">{natcash.error}</p>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatHtg(natcash.data?.computedBalanceCents ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Depots {formatHtg(natcash.data?.totalDepositsCents ?? 0)} − retraits{" "}
                  {formatHtg(natcash.data?.totalWithdrawalsCents ?? 0)} − frais{" "}
                  {formatHtg(natcash.data?.totalFeesCents ?? 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Rake par jeu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rake.error ? (
            <p className="text-sm text-destructive">{rake.error}</p>
          ) : rake.data && rake.data.byGame.length > 0 ? (
            <div className="space-y-2">
              {rake.data.byGame.map((g) => (
                <Link
                  key={g.clientId}
                  href={`/games/${g.clientId}`}
                  className="flex items-center justify-between border-b border-border py-2 transition-colors last:border-0 hover:bg-sidebar-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{g.gameName ?? g.clientId}</p>
                    <p className="text-xs text-muted-foreground">{g.eventCount} matchs regles</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{formatHtg(g.totalRakeCents)}</span>
                  </div>
                </Link>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">Total : {formatHtg(rake.data.totalRakeCents)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun rake enregistre pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recalage du solde NatCash
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {natcash.data?.lastSnapshot ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dernier solde declare :</span>
              <span className="font-medium">{formatHtg(natcash.data.lastSnapshot.balanceCents)}</span>
              <span className="text-muted-foreground">
                le {new Date(natcash.data.lastSnapshot.createdAt).toLocaleString()}
              </span>
              {natcash.data.driftCents != null && (
                <Badge variant={natcash.data.driftCents === 0 ? "secondary" : "destructive"}>
                  Ecart {formatHtg(natcash.data.driftCents)}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun solde reel declare pour l&apos;instant.</p>
          )}
          <NatcashSnapshotForm />
        </CardContent>
      </Card>
    </div>
  );
}
