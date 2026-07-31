import { cookies } from "next/headers";
import { adminFetch } from "./api";

export async function adminServerFetch<T>(path: string): Promise<T> {
  const jar = await cookies();
  const parts: string[] = [];
  for (const c of jar.getAll()) {
    parts.push(`${c.name}=${c.value}`);
  }
  const cookieHeader = parts.length ? parts.join("; ") : undefined;
  return adminFetch<T>(path, { cookie: cookieHeader });
}
