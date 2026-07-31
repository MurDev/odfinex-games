import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/auth";
import { eq } from "drizzle-orm";
import { users } from "@odfinex/db";
import { AdminLayout } from "@/components/admin-layout";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!dbUser?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Acces refuse</h1>
          <p className="mt-2 text-muted-foreground">Vous n&apos;avez pas les droits administrateur.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/auth/signout" className="mt-4 inline-block text-sm text-primary hover:underline">
            Deconnexion
          </a>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      user={{
        id: session.user.id,
        displayName: session.user.name,
        email: session.user.email,
        avatarUrl: session.user.image,
      }}
    >
      {children}
    </AdminLayout>
  );
}
