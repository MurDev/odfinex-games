"use server";

import { signIn } from "@/auth";

export async function signInWithGoogle(formData: FormData) {
  const returnTo = String(formData.get("returnTo") || "/me");
  await signIn("google", { redirectTo: returnTo });
}
