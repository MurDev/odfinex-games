"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type PlayersSearchProps = {
  defaultValue: string;
  type: "human" | "bot" | "all";
};

export function PlayersSearch({ defaultValue, type }: PlayersSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function push(q: string, t: "human" | "bot" | "all") {
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    if (t !== "all") params.set("type", t);
    const qs = params.toString();
    router.push(qs ? `/players?${qs}` : "/players");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    push(value.trim(), type);
  }

  return (
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
            onClick={() => push(value.trim(), key)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
