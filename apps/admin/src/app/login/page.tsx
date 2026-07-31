import { redirect } from "next/navigation";
import { auth, signIn, db } from "@/auth";
import { eq } from "drizzle-orm";
import { users } from "@odfinex/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();

  if (session?.user?.id) {
    const dbUser = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (dbUser?.isAdmin) redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Admin Odfinex Games</CardTitle>
          <CardDescription>Connectez-vous avec un compte administrateur</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <Button type="submit" className="w-full">
              Continuer avec Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
