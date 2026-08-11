"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SORT_KEYS, SORT_LABELS, type SortKey } from "./constants";

type PlayersSearchProps = {
  defaultValue: string;
  type: "human" | "bot" | "all";
  role: "admin" | "player" | "all";
  sort: SortKey;
  page: number;
  total: number;
  perPage: number;
};

export function PlayersSearch({
  defaultValue,
  type,
  role,
  sort,
  page,
  total,
  perPage,
}: PlayersSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function push(updates: {
    search?: string;
    type?: string;
    role?: string;
    sort?: string;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.search !== undefined) {
      if (updates.search) params.set("search", updates.search);
      else params.delete("search");
    }
    if (updates.type !== undefined) {
      if (updates.type !== "all") params.set("type", updates.type);
      else params.delete("type");
    }
    if (updates.role !== undefined) {
      if (updates.role !== "all") params.set("role", updates.role);
      else params.delete("role");
    }
    if (updates.sort !== undefined) {
      if (updates.sort !== "date_desc") params.set("sort", updates.sort);
      else params.delete("sort");
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) params.set("page", String(updates.page));
      else params.delete("page");
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    router.push(qs ? `/players?${qs}` : "/players");
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
            placeholder="Rechercher par nom ou email..."
            className="pl-9"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </form>
        <div className="flex items-center gap-1">
          {(
            [
              { key: "all", label: "Tous" },
              { key: "human", label: "Joueurs" },
              { key: "bot", label: "Bots" },
            ] as const
          ).map(({ key, label }) => (
            <Button
              key={key}
              variant={type === key ? "default" : "outline"}
              size="sm"
              onClick={() => push({ type: key })}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Role</span>
          <select
            className={selectClass}
            value={role}
            onChange={(e) =>
              push({ role: e.target.value as "admin" | "player" | "all" })
            }
          >
            <option value="all">Tous les roles</option>
            <option value="admin">Admins</option>
            <option value="player">Joueurs</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Trier par</span>
          <select
            className={selectClass}
            value={sort}
            onChange={(e) => push({ sort: e.target.value as SortKey })}
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => push({ page: page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
            Precedent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
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
