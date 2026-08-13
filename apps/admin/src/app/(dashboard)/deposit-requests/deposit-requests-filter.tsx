"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUSES = ["pending", "approved", "rejected", "cancelled", "all"];

type DepositRequestsFilterProps = {
  status: string;
  page: number;
  total: number;
  perPage: number;
};

export function DepositRequestsFilter({ status, page, total, perPage }: DepositRequestsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function push(updates: { status?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.status !== undefined) {
      if (updates.status !== "pending") params.set("status", updates.status);
      else params.delete("status");
    }
    if (updates.page !== undefined && updates.status === undefined) {
      if (updates.page > 1) params.set("page", String(updates.page));
      else params.delete("page");
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    router.push(qs ? `/deposit-requests?${qs}` : "/deposit-requests");
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={status === s ? "default" : "outline"}
          onClick={() => push({ status: s })}
        >
          {s === "all" ? "Tous" : s}
        </Button>
      ))}
      {totalPages > 1 && (
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => push({ page: page - 1 })}>
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
            onClick={() => push({ page: page + 1 })}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
