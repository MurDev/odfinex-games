import { redirect } from "next/navigation";

/** Google OAuth crée le compte au premier login — /register renvoie vers /login. */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; clientId?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.returnTo) q.set("returnTo", params.returnTo);
  if (params.clientId) q.set("clientId", params.clientId);
  const qs = q.toString();
  redirect(`/login${qs ? `?${qs}` : ""}`);
}
