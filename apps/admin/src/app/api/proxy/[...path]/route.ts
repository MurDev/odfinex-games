import { NextRequest, NextResponse } from "next/server";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${apiUrl}/v1/${path.join("/")}${req.nextUrl.search}`;
  return proxy(req, target, "GET");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${apiUrl}/v1/${path.join("/")}`;
  return proxy(req, target, "POST");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${apiUrl}/v1/${path.join("/")}`;
  return proxy(req, target, "PATCH");
}

async function proxy(req: NextRequest, target: string, method: string): Promise<NextResponse> {
  const body = method === "GET" ? undefined : await req.json().catch(() => undefined);

  const cookie = req.headers.get("cookie") ?? "";
  const authToken = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) =>
      ["authjs.session-token=", "__Secure-authjs.session-token=", "next-auth.session-token="].some((p) =>
        c.startsWith(p),
      ),
    );

  if (!authToken) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifie" } }, { status: 401 });
  }

  try {
    const res = await fetch(target, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken.split("=")[1]}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: { code: "PROXY_ERROR", message: e instanceof Error ? e.message : "Proxy error" } },
      { status: 502 },
    );
  }
}
