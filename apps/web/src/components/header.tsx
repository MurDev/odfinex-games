import { auth } from "@/auth";

export default async function Header() {
  const session = await auth();
  const user = session?.user;

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
