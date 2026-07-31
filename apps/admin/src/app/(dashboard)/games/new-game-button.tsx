"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function NewGameButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [form, setForm] = useState({ name: "", launchUrl: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setCreatedId("");

    try {
      const res = await fetch(`/api/proxy/admin/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur");
      }

      const data = await res.json();
      setCreatedId(data.game.clientId);
      setForm({ name: "", launchUrl: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau jeu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un jeu</DialogTitle>
            <DialogDescription>Enregistrer un nouveau jeu sur la plateforme</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom</label>
              <Input
                placeholder="Mon Jeu"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL de lancement</label>
              <Input
                placeholder="https://monjeu.com"
                type="url"
                value={form.launchUrl}
                onChange={(e) => setForm((f) => ({ ...f, launchUrl: e.target.value }))}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Le <code className="font-mono">clientId</code> sera genere automatiquement.
            </p>
            {createdId && (
              <p className="text-xs text-emerald-400">
                Jeu cree avec l&apos;ID <code className="font-mono">{createdId}</code>
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setCreatedId(""); }}>
              {createdId ? "Fermer" : "Annuler"}
            </Button>
            <Button type="submit" disabled={loading || !!createdId}>
              {loading ? "Creation..." : createdId ? "Cree" : "Creer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
