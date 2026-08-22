"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatHtg } from "@/lib/api";
import { ledgerNatureLabel, withdrawalStatusLabel } from "@/lib/ledger-labels";
import type { TxItem } from "./page";

const WITHDRAW_STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  processing: "warning",
  successful: "success",
  failed: "destructive",
  cancelled: "secondary",
};

export function TransactionRow({ tx }: { tx: TxItem }) {
  const router = useRouter();
  const nature = ledgerNatureLabel(tx);
  const withdrawLabel = withdrawalStatusLabel(tx.withdrawalStatus);

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/transactions/${tx.id}`)}
    >
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
        <span className="font-medium">{nature}</span>
        {tx.reason && tx.reason !== nature && (
          <span className="block max-w-[180px] truncate text-xs text-muted-foreground" title={tx.reason}>
            {tx.reason}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={tx.type === "credit" ? "success" : "outline"}>
          {tx.type === "credit" ? "Credit" : "Debit"}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-sm">{formatHtg(tx.amountCents)}</TableCell>
      <TableCell className="font-mono text-sm">{formatHtg(tx.bonusCents)}</TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {formatHtg(tx.balanceAfterCents)}
      </TableCell>
      <TableCell>
        {withdrawLabel ? (
          <Badge variant={WITHDRAW_STATUS_VARIANT[tx.withdrawalStatus ?? ""] ?? "secondary"}>
            {withdrawLabel}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {tx.actorName ?? tx.actorEmail ?? tx.actorId ?? "—"}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {tx.clientId === "platform" ? "Plateforme" : tx.clientId}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(tx.createdAt).toLocaleString()}
      </TableCell>
    </TableRow>
  );
}
