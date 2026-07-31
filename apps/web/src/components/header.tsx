import { auth } from "@/auth";

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

export default async function Header() {
  const session = await auth();
  const user = session?.user;

  let balanceLabel: string | null = null;
  if (user) {
    try {
      const { cookies } = await import("next/headers");
      const jar = await cookies();
      const cookie = jar
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      const res = await fetch(`${apiUrl}/v1/wallet`, {
        headers: cookie ? { cookie } : {},
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { balanceCents: number };
        balanceLabel = `${(data.balanceCents / 100).toFixed(2)} HTG`;
      }
    } catch {
      balanceLabel = null;
    }
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 2rem",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "sticky",
        top: 0,
        background: "rgba(7,11,16,0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 10,
      }}
    >
      <a
        href="/"
        style={{ fontWeight: 700, letterSpacing: "0.05em", color: "#e8eef3", textDecoration: "none" }}
      >
        Odfinex Games
      </a>

      <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.9rem" }}>
        {user ? (
          <>
            {balanceLabel && (
              <a
                href="/wallet"
                style={{
                  ...navLink,
                  background: "rgba(20,184,166,0.15)",
                  border: "1px solid rgba(20,184,166,0.35)",
                  padding: "0.35rem 0.75rem",
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                {balanceLabel}
              </a>
            )}
            <a href="/wallet" style={navLink}>
              Wallet
            </a>
            <a href="/me" style={navLink}>
              {user.name ?? user.email}
            </a>
          </>
        ) : (
          <>
            <a href="/login" style={navLink}>
              Connexion
            </a>
            <a
              href="/login"
              style={{
                ...navLink,
                background: "#2563eb",
                padding: "0.4rem 0.9rem",
                borderRadius: 7,
                color: "#fff",
              }}
            >
              Continuer avec Google
            </a>
          </>
        )}
      </nav>
    </header>
  );
}

const navLink: React.CSSProperties = {
  color: "#e8eef3",
  textDecoration: "none",
  opacity: 0.85,
};
