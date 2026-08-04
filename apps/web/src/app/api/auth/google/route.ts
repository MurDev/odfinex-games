import { NextResponse } from "next/server";
import { signIn } from "@/auth";

/** Only allow same-origin relative paths (open-redirect guard). */
function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/me";
  return raw;
}

export async function GET(req: Request) {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return NextResponse.redirect(new URL("/login?error=Configuration", req.url));
  }

  const returnTo = safeReturnTo(new URL(req.url).searchParams.get("returnTo"));
  await signIn("google", { redirectTo: returnTo });
}
