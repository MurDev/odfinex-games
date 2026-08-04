"use server";

import { signIn } from "@/auth";

function safeReturnTo(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/me";
  return raw;
}

export async function signInWithGoogle(formData: FormData) {
  const returnTo = safeReturnTo(String(formData.get("returnTo") || "/me"));
  await signIn("google", { redirectTo: returnTo });
}
