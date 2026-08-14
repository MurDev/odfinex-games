import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GrantButton } from "./grant-button";
import { DepositForm } from "./deposit-form";
import { WithdrawForm } from "./withdraw-form";

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

function formatHtg(cents: number) {
  return `${(cents / 100).toFixed(2)} HTG`;
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams?: Promise<{ deposit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?returnTo=/wallet");

  const sp = searchParams ? await searchParams : {};
  const cookieHeader = await getCookieHeader();

  const [balanceRes, txRes] = await Promise.all([
    fetch(`${apiUrl}/v1/wallet`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    }),
    fetch(`${apiUrl}/v1/wallet/transactions?limit=20`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    }),
  ]);

  const balance = balanceRes.ok
    ? ((await balanceRes.json()) as { balanceCents: number; bonusCents: number })
    : { balanceCents: 0, bonusCents: 0 };
  const txs = txRes.ok
    ? ((await txRes.json()) as {
        items: Array<{
          id: string;
          type: string;
          amountCents: number;
          reason: string;
          clientId: string;
          createdAt: string;
        }>;
        total: number;
      })
    : { items: [], total: 0 };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <p
        style={{
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.6,
          fontSize: "0.8rem",
        }}
      >
        Wallet
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 0.25rem" }}>Mon solde</h1>
      <p style={{ opacity: 0.65, marginBottom: "1.5rem" }}>
        Ledger Odfinex Games — dépôts et retraits MonCash.
      </p>

      {sp.deposit === "ok" && (
        <p style={{ color: "#34d399", marginBottom: "1rem" }}>Dépôt confirmé.</p>
      )}
      {sp.deposit === "error" && (
        <p style={{ color: "#f87171", marginBottom: "1rem" }}>
          Le paiement MonCash a échoué ou a été annulé.
        </p>
      )}

      <div
        style={{
          background: "rgba(20,184,166,0.12)",
          border: "1px solid rgba(20,184,166,0.35)",
          borderRadius: 14,
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.7 }}>Solde jouable</p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "2rem", fontWeight: 700 }}>
          {formatHtg(balance.balanceCents - balance.bonusCents)}
        </p>
        {balance.bonusCents > 0 && (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            Bonus non retirable : {formatHtg(balance.bonusCents)}
          </p>
        )}
      </div>

      <DepositForm />
      <WithdrawForm />
      <GrantButton />

      <h2 style={{ fontSize: "1.1rem", margin: "2rem 0 0.75rem" }}>Transactions</h2>
      {txs.items.length === 0 ? (
        <p style={{ opacity: 0.55 }}>Aucune transaction pour le moment.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {txs.items.map((tx) => (
            <li
              key={tx.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "0.35rem 1rem",
                padding: "0.85rem 0",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ minWidth: 0, overflowWrap: "break-word" }}>
                <strong style={{ textTransform: "capitalize" }}>{tx.type}</strong>
                <span style={{ opacity: 0.55, marginLeft: 8 }}>{tx.reason}</span>
                <br />
                <span style={{ fontSize: "0.75rem", opacity: 0.45 }}>
                  {tx.clientId} · {new Date(tx.createdAt).toLocaleString()}
                </span>
              </span>
              <span
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  color: tx.type === "credit" ? "#34d399" : "#f87171",
                }}
              >
                {tx.type === "credit" ? "+" : "−"}
                {formatHtg(tx.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

async function getCookieHeader(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const parts: string[] = [];
  for (const c of jar.getAll()) {
    parts.push(`${c.name}=${c.value}`);
  }
  return parts.length ? parts.join("; ") : undefined;
}
