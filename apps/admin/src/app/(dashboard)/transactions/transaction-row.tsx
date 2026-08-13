"use client";

import { useState } from "react";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatHtg } from "@/lib/api";
import type { TxItem } from "./page";

function deriveRequestLink(tx: TxItem): { href: string; label: string } | null {
  if (tx.referenceId.startsWith("mdep_")) {
    return { href: `/deposit-requests/${tx.referenceId.slice(5)}`, label: "Voir la demande de depot" };
  }
  const stripped = tx.referenceId.replace(/^(refund_|reject_)/, "");
  if (stripped.startsWith("wd_")) {
    return { href: `/withdrawal-requests/${stripped}`, label: "Voir la demande de retrait" };
  }
  return null;
}

export function TransactionRow({ tx }: { tx: TxItem }) {
  const [open, setOpen] = useState(false);
  const requestLink = deriveRequestLink(tx);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(true)}>
        <TableCell>
          <Link
            href={`/players/${tx.userId}`}
            className="flex flex-col leading-tight hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-medium">{tx.displayName ?? "Anonyme"}</span>
            {tx.email && <span className="text-xs text-muted-foreground">{tx.email}</span>}
          </Link>
        </TableCell>
        <TableCell>
          <Badge variant={tx.type === "credit" ? "success" : "destructive"}>
            {tx.type === "credit" ? "Credit" : "Debit"}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-sm">{formatHtg(tx.amountCents)}</TableCell>
        <TableCell className="font-mono text-sm">{formatHtg(tx.bonusCents)}</TableCell>
        <TableCell className="font-mono text-sm text-muted-foreground">
          {formatHtg(tx.balanceAfterCents)}
        </TableCell>
        <TableCell className="max-w-[120px] truncate text-muted-foreground">
          {tx.category ?? "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{tx.actorId ?? "—"}</TableCell>
        <TableCell className="max-w-[220px] truncate text-muted-foreground">{tx.reason}</TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{tx.clientId}</TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(tx.createdAt).toLocaleString()}
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ecriture de ledger</DialogTitle>
            <DialogDescription>{tx.id}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Joueur</p>
              <p className="font-medium">{tx.displayName ?? tx.email ?? "Anonyme"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <Badge variant={tx.type === "credit" ? "success" : "destructive"}>
                {tx.type === "credit" ? "Credit" : "Debit"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Montant</p>
              <p className="font-mono font-medium">{formatHtg(tx.amountCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bonus</p>
              <p className="font-mono font-medium">{formatHtg(tx.bonusCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Solde apres</p>
              <p className="font-mono font-medium">{formatHtg(tx.balanceAfterCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Environnement</p>
              <p className="font-medium">{tx.environment}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Categorie</p>
              <p className="font-medium">{tx.category ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acteur</p>
              <p className="font-medium">{tx.actorId ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jeu</p>
              <p className="font-mono font-medium">{tx.clientId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{new Date(tx.createdAt).toLocaleString()}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Motif</p>
              <p className="font-medium">{tx.reason}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-mono text-xs">{tx.referenceId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/players/${tx.userId}`}>Voir le joueur</Link>
            </Button>
            {requestLink && (
              <Button variant="outline" size="sm" asChild>
                <Link href={requestLink.href}>{requestLink.label}</Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
