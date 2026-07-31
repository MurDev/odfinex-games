import NextAuth from "next-auth";
import type { NextAuthConfig, NextAuthResult, Session, User } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  createDb,
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@odfinex/db";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const db = createDb(requireEnv("DATABASE_URL"));

const config = {
  secret: requireEnv("AUTH_SECRET"),
  trustHost: true,
  adapter: DrizzleAdapter(db as any, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as any),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [Google],
  callbacks: {
    session({ session, user }: { session: Session; user: User }): Session {
      if (session.user && user.id) session.user.id = user.id;
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        const allowed = [baseUrl].map((o) => new URL(o).origin);
        if (allowed.includes(target.origin)) return url;
      } catch {}
      return baseUrl;
    },
  },
  logger: {
    error(error) {
      console.error("[admin:auth:error]", error);
      if (error && typeof error === "object" && "cause" in error) {
        console.error("[admin:auth:cause]", (error as { cause: unknown }).cause);
      }
    },
    warn(code) {
      console.warn("[admin:auth:warn]", code);
    },
  },
  debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig;

const _nextAuth: NextAuthResult = NextAuth(config);

export const handlers: NextAuthResult["handlers"] = _nextAuth.handlers;
export const signIn: NextAuthResult["signIn"] = _nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = _nextAuth.signOut;
export const auth: NextAuthResult["auth"] = _nextAuth.auth;
export { db };
