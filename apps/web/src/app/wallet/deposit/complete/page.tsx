"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

function CompleteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("orderId");
  const [status, setStatus] = useState<"loading" | "ok" | "pending" | "error">("loading");
  const [message, setMessage] = useState("Confirmation du dépôt…");

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      setMessage("orderId manquant");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiUrl}/v1/wallet/deposit/${encodeURIComponent(orderId)}/complete`,
          {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json" },
          },
        );
        const json = (await res.json().catch(() => null)) as {
          status?: string;
          error?: { message?: string };
        } | null;
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(json?.error?.message ?? `Erreur ${res.status}`);
          return;
        }
        if (json?.status === "pending") {
          setStatus("pending");
          setMessage("Paiement encore en cours — rafraîchis dans un instant.");
          return;
        }
        setStatus("ok");
        setMessage("Dépôt confirmé. Redirection…");
        setTimeout(() => router.replace("/wallet?deposit=ok"), 1200);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Erreur");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.5rem" }}>Dépôt MonCash</h1>
      <p style={{ opacity: 0.75, marginTop: "1rem" }}>{message}</p>
      {status === "error" && (
        <a href="/wallet" style={{ color: "#F0C75E", display: "inline-block", marginTop: "1.5rem" }}>
          Retour au wallet
        </a>
      )}
    </main>
  );
}

export default function DepositCompletePage() {
  return (
    <Suspense fallback={<main style={{ padding: "4rem" }}>Chargement…</main>}>
      <CompleteInner />
    </Suspense>
  );
}
