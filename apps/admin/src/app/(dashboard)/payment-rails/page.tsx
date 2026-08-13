"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";

type Rail = {
  id: string;
  method: string;
  enabled: boolean;
  withdrawalEnabled: boolean;
  accountName: string;
  accountNumber: string;
  depositMinAmountCents: number;
  depositMaxAmountCents: number;
  withdrawalMinAmountCents: number;
  withdrawalMaxAmountCents: number;
  instructions: string | null;
  environment: string;
};

export default function PaymentRailsPage() {
  const [rails, setRails] = useState<Rail[]>([]);
  const [env, setEnv] = useState<"live" | "sandbox">("live");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/proxy/admin/payment-rails?environment=${env}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      setRails(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  async function save(rail: Rail) {
    setSaving(rail.id);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/proxy/admin/payment-rails/${rail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: rail.enabled,
          withdrawalEnabled: rail.withdrawalEnabled,
          accountName: rail.accountName,
          accountNumber: rail.accountNumber,
          depositMinAmountCents: rail.depositMinAmountCents,
          depositMaxAmountCents: rail.depositMaxAmountCents,
          withdrawalMinAmountCents: rail.withdrawalMinAmountCents,
          withdrawalMaxAmountCents: rail.withdrawalMaxAmountCents,
          instructions: rail.instructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      setSuccess("Configuration enregistree");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment rails</h1>
          <p className="text-sm text-muted-foreground">
            Active/desactive chaque methode, separement pour le depot et le retrait, vue par les jeux clients
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={env === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => setEnv("live")}
          >
            Live
          </Button>
          <Button
            variant={env === "sandbox" ? "default" : "outline"}
            size="sm"
            onClick={() => setEnv("sandbox")}
          >
            Sandbox
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : rails.length === 0 ? (
        <p className="text-muted-foreground">Aucune config (lancez la migration 0006).</p>
      ) : (
        rails.map((rail) => (
          <Card key={rail.id}>
            <CardHeader>
              <CardTitle className="text-base capitalize">{rail.method}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Actif pour depot</p>
                  <p className="text-xs text-muted-foreground">Visible aux joueurs pour depot</p>
                </div>
                <Switch
                  checked={rail.enabled}
                  onCheckedChange={(v) =>
                    setRails((all) =>
                      all.map((r) => (r.id === rail.id ? { ...r, enabled: v } : r)),
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Actif pour retrait</p>
                  <p className="text-xs text-muted-foreground">Visible aux joueurs pour retrait</p>
                </div>
                <Switch
                  checked={rail.withdrawalEnabled}
                  onCheckedChange={(v) =>
                    setRails((all) =>
                      all.map((r) => (r.id === rail.id ? { ...r, withdrawalEnabled: v } : r)),
                    )
                  }
                />
              </div>
              {rail.method === "natcash" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nom du compte</Label>
                    <Input
                      value={rail.accountName}
                      onChange={(e) =>
                        setRails((all) =>
                          all.map((r) =>
                            r.id === rail.id ? { ...r, accountName: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Numero de compte</Label>
                    <Input
                      value={rail.accountNumber}
                      onChange={(e) =>
                        setRails((all) =>
                          all.map((r) =>
                            r.id === rail.id ? { ...r, accountNumber: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Bornes depot</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Min (HTG)</Label>
                    <Input
                      type="number"
                      value={rail.depositMinAmountCents / 100}
                      onChange={(e) =>
                        setRails((all) =>
                          all.map((r) =>
                            r.id === rail.id
                              ? { ...r, depositMinAmountCents: Math.round(Number(e.target.value) * 100) }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max (HTG)</Label>
                    <Input
                      type="number"
                      value={rail.depositMaxAmountCents / 100}
                      onChange={(e) =>
                        setRails((all) =>
                          all.map((r) =>
                            r.id === rail.id
                              ? { ...r, depositMaxAmountCents: Math.round(Number(e.target.value) * 100) }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Bornes retrait</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Min (HTG)</Label>
                    <Input
                      type="number"
                      value={rail.withdrawalMinAmountCents / 100}
                      onChange={(e) =>
                        setRails((all) =>
                          all.map((r) =>
                            r.id === rail.id
                              ? { ...r, withdrawalMinAmountCents: Math.round(Number(e.target.value) * 100) }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max (HTG)</Label>
                    <Input
                      type="number"
                      value={rail.withdrawalMaxAmountCents / 100}
                      onChange={(e) =>
                        setRails((all) =>
                          all.map((r) =>
                            r.id === rail.id
                              ? { ...r, withdrawalMaxAmountCents: Math.round(Number(e.target.value) * 100) }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              {rail.method === "natcash" && (
                <div className="space-y-2">
                  <Label>Instructions</Label>
                  <Input
                    value={rail.instructions ?? ""}
                    onChange={(e) =>
                      setRails((all) =>
                        all.map((r) =>
                          r.id === rail.id ? { ...r, instructions: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </div>
              )}
              <Button onClick={() => void save(rail)} disabled={saving === rail.id}>
                {saving === rail.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
