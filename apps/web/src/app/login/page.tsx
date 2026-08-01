import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; clientId?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    redirect(params.returnTo ?? "/me");
  }

  const returnTo = params.returnTo ?? "/me";
  const clientId = params.clientId ?? "";
  const googleConfigured = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "6rem 1.5rem" }}>
      <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, fontSize: "0.8rem" }}>
        Odfinex Games
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 0.5rem" }}>Connexion</h1>
      <p style={{ opacity: 0.7, marginBottom: "2rem", fontSize: "0.95rem" }}>
        Compte unique pour tous les jeux — via Google.
      </p>

      {params.error && (
        <p style={{ color: "#f87171", marginBottom: "1rem", fontSize: "0.9rem" }}>
          Connexion Google impossible
          {params.error !== "1" ? ` (${params.error})` : ""}. Vérifie la configuration
          OAuth Google et l&apos;accès à la base de données, puis réessaie.
        </p>
      )}

      {!googleConfigured && (
        <p
          style={{
            color: "#fbbf24",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            background: "rgba(251,191,36,0.1)",
            padding: "0.75rem 1rem",
            borderRadius: 8,
          }}
        >
          Configure <code>AUTH_GOOGLE_ID</code> et <code>AUTH_GOOGLE_SECRET</code> dans{" "}
          <code>apps/web/.env.local</code>.
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: returnTo });
        }}
      >
        <button
          type="submit"
          disabled={!googleConfigured}
          style={{
            ...buttonStyle,
            opacity: googleConfigured ? 1 : 0.5,
            cursor: googleConfigured ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            width: "100%",
          }}
        >
          <GoogleIcon />
          Continuer avec Google
        </button>
      </form>

      {clientId ? (
        <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", opacity: 0.45 }}>
          Retour jeu : <code>{clientId}</code>
        </p>
      ) : null}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.1 7.1l.1.1 6.2 5.2C37.2 38.9 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#1f2937",
  border: "none",
  borderRadius: 8,
  padding: "0.85rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
};
