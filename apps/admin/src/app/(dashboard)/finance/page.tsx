import { auth } from "@/auth";
import { adminServerFetch } from "@/lib/server-fetch";
import { formatHtg } from "@/lib/api";
import type { AdminBazikBalance, AdminNatcashBalance, AdminRakeStats } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Landmark, PiggyBank } from "lucide-react";
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

  const [bazik, natcash, rake] = await Promise.all([
    safeFetch<AdminBazikBalance>("/admin/finance/bazik-balance"),
    safeFetch<AdminNatcashBalance>("/admin/finance/natcash-balance"),
    safeFetch<AdminRakeStats>("/admin/finance/rake"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground">
          Marge reelle : rake accumule, solde Bazik (MonCash) et solde NatCash estime.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rake accumule
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {rake.error ? (
              <p className="text-sm text-destructive">{rake.error}</p>
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">
                  {formatHtg(rake.data?.totalRakeCents ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">Tous jeux, depuis la mise en place du tracking</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Rake par jeu</CardTitle>
        </CardHeader>
        <CardContent>
          {rake.data && rake.data.byGame.length > 0 ? (
            <div className="space-y-2">
              {rake.data.byGame.map((g) => (
                <div
                  key={g.clientId}
                  className="flex items-center justify-between border-b border-border py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{g.gameName ?? g.clientId}</p>
                    <p className="text-xs text-muted-foreground">{g.eventCount} matchs regles</p>
                  </div>
                  <div className="font-mono text-sm">{formatHtg(g.totalRakeCents)}</div>
                </div>
              ))}
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
