"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminGameStats } from "@odfinex/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

type GameSettingsProps = {
  game: AdminGameStats;
};

export function GameSettings({ game }: GameSettingsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: game.name,
    launchUrl: game.launchUrl,
    isActive: game.isActive,
    walletEnabled: game.walletEnabled,
  });

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/proxy/admin/games/${game.clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur");
      }

      setSuccess("Modifications enregistrees");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Parametres</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nom du jeu</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label>URL de lancement</Label>
          <Input
            value={form.launchUrl}
            onChange={(e) => setForm((f) => ({ ...f, launchUrl: e.target.value }))}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Jeu actif</p>
            <p className="text-xs text-muted-foreground">Apparait dans le catalogue</p>
          </div>
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Wallet</p>
            <p className="text-xs text-muted-foreground">Autoriser les transactions</p>
          </div>
          <Switch
            checked={form.walletEnabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, walletEnabled: v }))}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
