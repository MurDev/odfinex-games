"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type PlayersSearchProps = {
  defaultValue: string;
};

export function PlayersSearch({ defaultValue }: PlayersSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/players?search=${encodeURIComponent(q)}` : "/players");
  }

  return (
    <form onSubmit={handleSubmit} className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Rechercher par nom ou email..."
        className="pl-9"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
