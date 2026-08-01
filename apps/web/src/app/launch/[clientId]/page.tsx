import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlatformSessionToken } from "@/lib/session";
import { createLaunch } from "@/lib/api";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function LaunchPage({ params }: PageProps) {
  const { clientId } = await params;

  const sessionToken = await getPlatformSessionToken();
  if (!sessionToken) {
    const login = new URL("/login", process.env.AUTH_URL ?? "http://localhost:3000");
    login.searchParams.set("returnTo", `/launch/${encodeURIComponent(clientId)}`);
    login.searchParams.set("clientId", clientId);
    redirect(login.toString());
  }

  const result = await createLaunch(clientId, sessionToken);

  if (!result.ok) {
    if (result.status === 401) {
      const login = new URL("/login", process.env.AUTH_URL ?? "http://localhost:3000");
      login.searchParams.set("returnTo", `/launch/${encodeURIComponent(clientId)}`);
      login.searchParams.set("clientId", clientId);
      redirect(login.toString());
    }

    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "6rem 1.5rem" }}>
        <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, fontSize: "0.8rem" }}>
          Launch
        </p>
        <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 1rem" }}>Impossible de lancer le jeu</h1>
        <p style={{ color: "#f87171", marginBottom: "0.5rem" }}>{result.message}</p>
        <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>
          code: <code>{result.code}</code> · clientId: <code>{clientId}</code>
        </p>
        <p style={{ marginTop: "2rem" }}>
          <Link href="/" style={{ color: "#60a5fa" }}>
            ← Retour catalogue
          </Link>
        </p>
      </main>
    );
  }

  redirect(result.data.launchUrl);
}
