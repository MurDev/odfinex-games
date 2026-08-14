import { auth } from "@/auth";
import Link from "next/link";
import { ScrollHeader } from "@/components/scroll-header";

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
    <ScrollHeader>
      <div className="site-header__inner">
        <Link href="/" className="brand-link">
          <span className="brand-link__mark">OG</span>
          <span className="brand-link__text">Odfinex Games</span>
        </Link>

        <nav className="site-nav" aria-label="Navigation principale">
          {user ? (
            <>
              {balanceLabel && (
                <a href="/wallet" className="nav-link nav-link--wallet">
                  {balanceLabel}
                </a>
              )}
              <a href="/wallet" className="nav-link">
                Wallet
              </a>
              <a href="/me" className="nav-link">
                {user.name ?? user.email}
              </a>
            </>
          ) : (
            <>
              <a href="/login" className="nav-link">
                Connexion
              </a>
              <a href="/login" className="nav-link nav-link--primary">
                Continuer avec Google
              </a>
            </>
          )}
        </nav>
      </div>
    </ScrollHeader>
  );
}
