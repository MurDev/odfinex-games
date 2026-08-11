"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RejectDialog } from "@/components/reject-dialog";

const PER_PAGE = 50;

type Item = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  amountCents: number;
  status: string;
  paymentProofUrl: string | null;
  reference: string | null;
  adminComment: string | null;
  clientId: string | null;
  createdAt: string;
  isSelf?: boolean;
};

export default function DepositRequestsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("limit", String(PER_PAGE));
      params.set("offset", String((page - 1) * PER_PAGE));
      const res = await fetch(`/api/proxy/admin/deposit-requests?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reject(item: Item, comment: string) {
    setBusy(item.id);
    setError("");
    try {
      if (item.isSelf) {
        const msg = "C'est VOTRE demande de depot. Voulez-vous vraiment la rejeter ?";
        if (!window.confirm(msg)) return;
      }
      const res = await fetch(`/api/proxy/admin/deposit-requests/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Erreur");
      await load();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function approve(item: Item) {
    setBusy(item.id);
    setError("");
    try {
      if (item.isSelf) {
        const msg = "C'est VOTRE demande de depot. Vérifiez la preuve de paiement avant de confirmer.";
        if (!window.confirm(msg)) return;
      }
      const res = await fetch(`/api/proxy/admin/deposit-requests/${item.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demandes de depot NatCash</h1>
        <p className="text-sm text-muted-foreground">Seul Odfinex peut valider ces demandes</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["pending", "approved", "rejected", "cancelled", ""].map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s || "Tous"}
          </Button>
        ))}
        {totalPages > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Precedent
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} sur {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
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
                  <TableHead>Ref / preuve</TableHead>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Commentaire</TableHead>
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
                    <TableCell className="max-w-[180px] truncate text-xs">
                      {item.reference ?? "—"}
                      {item.paymentProofUrl ? (
                        <>
                          <br />
                          <a
                            className="text-primary underline"
                            href={item.paymentProofUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            preuve
                          </a>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.clientId ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                      {item.adminComment ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {item.status === "pending" && (
                        <>
                          <Button size="sm" disabled={busy === item.id} onClick={() => void approve(item)}>
                            Approuver
                          </Button>
                          <RejectDialog
                            busy={busy === item.id}
                            title="Rejeter la demande de depot"
                            description={`${item.displayName ?? item.email} (${formatHtg(item.amountCents)})`}
                            onConfirm={(comment) => reject(item, comment)}
                            trigger={
                              <Button size="sm" variant="outline" disabled={busy === item.id}>
                                Rejeter
                              </Button>
                            }
                          />
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
