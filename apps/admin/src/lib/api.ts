const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export async function adminFetch<T>(path: string, options?: RequestInit & { cookie?: string }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(
      Object.entries(options?.headers ?? {}).map(([k, v]) => [k, String(v)]),
    ),
  };

  if (options?.cookie) {
    headers["cookie"] = options.cookie;
  }

  const res = await fetch(`${apiUrl}/v1${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `API error ${res.status}`);
  }

  return res.json();
}

export function formatHtg(cents: number): string {
  return `${(cents / 100).toFixed(2)} HTG`;
}
