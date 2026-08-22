"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, Loader2, Copy, Check } from "lucide-react";

type Props = {
  clientId: string;
  hasSecret: boolean;
};

export function ClientSecretManager({ clientId, hasSecret }: Props) {
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setSecret(null);
    setCopied(false);

    try {
      const res = await fetch(`/api/proxy/admin/games/${clientId}/rotate-secret`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur");
      }

      const data = await res.json();
      setSecret(data.clientSecret);
      toast.success("Cle secrete generee");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Une erreur est survenue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Cle copiee");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cle secrete (S2S)
          </CardTitle>
          <Badge variant={hasSecret || secret ? "success" : "outline"}>
            {hasSecret || secret ? "Configuree" : "Non configuree"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Utilisee par le serveur du jeu pour signer les transactions wallet (debit/credit).
        </p>

        {secret && (
          <div className="rounded-lg border bg-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <code className="break-all text-xs">{secret}</code>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-400">
              Copiez cette cle maintenant. Elle ne sera plus jamais affichee.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleGenerate} disabled={loading} variant={hasSecret ? "outline" : "default"}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Key className="mr-2 h-4 w-4" />
          )}
          {hasSecret ? "Regenerer la cle" : "Generer une cle"}
        </Button>
      </CardContent>
    </Card>
  );
}
