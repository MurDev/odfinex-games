"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatHtg } from "@/lib/api";
import type { TxItem } from "./page";

export function TransactionRow({ tx }: { tx: TxItem }) {
  const router = useRouter();

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
  );
}
