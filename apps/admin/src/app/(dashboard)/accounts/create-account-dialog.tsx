"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import type { AdminGameStats } from "@odfinex/shared";

type CreateAccountDialogProps = {
  games: AdminGameStats[];
};

export function CreateAccountDialog({ games }: CreateAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    type: "bot",
    clientId: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/proxy/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          isBot: form.type === "bot",
          isAdmin: form.type === "operator",
          clientId: form.clientId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur");
      }

      const data = await res.json();
      toast.success(`Compte cree (${data.user.email})`);
      setSuccess(`Compte cree (${data.user.email})`);
      setForm({ name: "", email: "", type: "bot", clientId: "" });
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Une erreur est survenue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau compte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Provisionner un compte</DialogTitle>
            <DialogDescription>
              Creer un bot ou un compte operateur rattache a un jeu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="bot">Bot</option>
                <option value="operator">Operateur</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom</label>
              <Input
                placeholder="Mon bot"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                placeholder="bot@jeu.bots"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Doit etre unique. Pour un bot, utilisez une adresse synthetique (ex.{" "}
                <code className="font-mono">bot.slug@client.bots</code>).
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jeu proprietaire</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                required
              >
                <option value="">Selectionner un jeu...</option>
                {games.map((g) => (
                  <option key={g.clientId} value={g.clientId}>
                    {g.name} ({g.clientId})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Accorde les droits de mutation S2S de ce jeu au compte.
              </p>
            </div>
            {success && <p className="text-xs text-emerald-500">{success}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setSuccess(""); }}>
              {success ? "Fermer" : "Annuler"}
            </Button>
            <Button type="submit" disabled={loading || !!success}>
              {loading ? "Creation..." : success ? "Cree" : "Creer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
