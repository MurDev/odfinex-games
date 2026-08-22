"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AdminGameStats } from "@odfinex/shared";

type TransactionsFilterProps = {
  defaultValue: string;
  game: string;
  type: string;
  kind: string;
  page: number;
  total: number;
  perPage: number;
  games: AdminGameStats[];
};

export function TransactionsFilter({
  defaultValue,
  game,
  type,
  kind,
  page,
  total,
  perPage,
  games,
}: TransactionsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function push(updates: {
    search?: string;
    game?: string;
    type?: string;
    kind?: string;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.search !== undefined) {
      if (updates.search) params.set("search", updates.search);
      else params.delete("search");
    }
    if (updates.game !== undefined) {
      if (updates.game !== "all") params.set("game", updates.game);
      else params.delete("game");
    }
    if (updates.type !== undefined) {
      if (updates.type !== "all") params.set("type", updates.type);
      else params.delete("type");
    }
    if (updates.kind !== undefined) {
      if (updates.kind !== "all") params.set("kind", updates.kind);
      else params.delete("kind");
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) params.set("page", String(updates.page));
      else params.delete("page");
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    router.push(qs ? `/transactions?${qs}` : "/transactions");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    push({ search: value.trim() });
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSubmit} className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un joueur (nom ou email)..."
            className="pl-9"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </form>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Jeu</span>
          <select className={selectClass} value={game} onChange={(e) => push({ game: e.target.value })}>
            <option value="all">Tous les jeux</option>
            <option value="platform">Plateforme</option>
            {games.map((g) => (
              <option key={g.clientId} value={g.clientId}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Nature</span>
          <select className={selectClass} value={kind} onChange={(e) => push({ kind: e.target.value })}>
            <option value="all">Toutes</option>
            <option value="deposit">Depots</option>
            <option value="withdraw">Retraits</option>
            <option value="bet">Mises</option>
            <option value="win">Gains</option>
            <option value="grant">Bonus et grants</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sens</span>
          <select className={selectClass} value={type} onChange={(e) => push({ type: e.target.value })}>
            <option value="all">Tous</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </label>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => push({ page: page - 1 })}>
            <ChevronLeft className="h-4 w-4" />
            Precedent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => push({ page: page + 1 })}>
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
