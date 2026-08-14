import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function MePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { user } = session;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "6rem 1.5rem" }}>
      <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, fontSize: "0.8rem" }}>
        Mon compte
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 0.25rem" }}>
        {user.name ?? "Joueur"}
      </h1>
      <p style={{ opacity: 0.6, marginBottom: "2rem" }}>{user.email}</p>

      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "1.25rem 1.5rem",
          marginBottom: "2rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.55 }}>ID joueur</p>
        <p style={{ margin: "0.25rem 0 0", fontFamily: "monospace", fontSize: "0.9rem" }}>
          {user.id}
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            color: "#e8eef3",
            padding: "0.75rem 1.2rem",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
