import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlatformSessionToken } from "@/lib/session";
import { createLaunch } from "@/lib/api";

type PageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ src?: string }>;
};

function googleStartUrl(clientId: string, src?: string) {
  const url = new URL("/api/auth/google", process.env.AUTH_URL ?? "http://localhost:3000");
  const returnTo = new URL(`/launch/${encodeURIComponent(clientId)}`, url);
  if (src) returnTo.searchParams.set("src", src);
  url.searchParams.set("returnTo", returnTo.pathname + returnTo.search);
  return url.toString();
}

export default async function LaunchPage({ params, searchParams }: PageProps) {
  const { clientId } = await params;
  const { src } = await searchParams;

  const sessionToken = await getPlatformSessionToken();
  if (!sessionToken) {
    redirect(googleStartUrl(clientId, src));
  }

  const result = await createLaunch(clientId, sessionToken);

  if (!result.ok) {
    if (result.status === 401) {
      redirect(googleStartUrl(clientId, src));
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

  if (src === "play") {
    const launchUrl = new URL(result.data.launchUrl);
    launchUrl.searchParams.set("from", "play");
    redirect(launchUrl.toString());
  }

  redirect(result.data.launchUrl);
}
