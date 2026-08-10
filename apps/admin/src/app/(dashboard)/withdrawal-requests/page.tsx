"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatHtg } from "@/lib/api";

type Item = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  amountCents: number;
  method: string;
  account: string;
  accountName: string | null;
  status: string;
  clientId: string | null;
  createdAt: string;
  isSelf?: boolean;
};

export default function WithdrawalRequestsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = status ? `?status=${status}` : "";
      const res = await fetch(`/api/proxy/admin/withdrawal-requests${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function act(item: Item, action: "approve" | "reject") {
    setBusy(item.id);
    setError("");
    try {
      let comment: string | undefined;
      if (action === "reject") {
        comment = window.prompt("Motif du rejet (obligatoire)") ?? "";
        if (!comment.trim()) {
          setBusy(null);
          return;
        }
      }
      if (item.isSelf) {
        const msg =
          action === "approve"
            ? "C'est VOTRE demande de retrait. Vérifiez le numero et le montant avant de confirmer."
            : "C'est VOTRE demande de retrait. Voulez-vous vraiment la rejeter ?";
        if (!window.confirm(msg)) {
          setBusy(null);
          return;
        }
      }
      const res = await fetch(`/api/proxy/admin/withdrawal-requests/${item.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { comment } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demandes de retrait</h1>
        <p className="text-sm text-muted-foreground">
          MonCash (Bazik) et NatCash (manuel) — validation Odfinex uniquement
        </p>
      </div>

      <div className="flex gap-2">
        {["pending", "processing", "successful", "failed", "cancelled", ""].map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s || "Tous"}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-muted-foreground">Chargement…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Methode</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {item.displayName ?? "—"}
                        {item.isSelf && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            votre demande
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </TableCell>
                    <TableCell>{formatHtg(item.amountCents)}</TableCell>
                    <TableCell className="capitalize">{item.method}</TableCell>
                    <TableCell className="text-xs">
                      {item.account}
                      {item.accountName ? (
                        <>
                          <br />
                          <span className="text-muted-foreground">{item.accountName}</span>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.clientId ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {item.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy === item.id}
                            onClick={() => void act(item, "approve")}
                          >
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === item.id}
                            onClick={() => void act(item, "reject")}
                          >
                            Rejeter
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Aucune demande
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
