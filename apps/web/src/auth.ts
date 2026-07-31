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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: DrizzleAdapter(db as Parameters<typeof DrizzleAdapter>[0], {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Database sessions — évite JWTSessionError (cookie JWT signé avec un autre secret)
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
      const playUrl = (process.env.PLAY_URL ?? "http://localhost:3001").replace(
        /\/$/,
        "",
      );
      // Relative path on web
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Absolute URL on web or play
      try {
        const target = new URL(url);
        const allowed = [baseUrl, playUrl].map((o) => new URL(o).origin);
        if (allowed.includes(target.origin)) return url;
      } catch {
        // fall through
      }
      return baseUrl;
    },
  },
  logger: {
    error(error) {
      console.error("[auth:error]", error);
      if (error && typeof error === "object" && "cause" in error) {
        console.error("[auth:cause]", (error as { cause: unknown }).cause);
      }
    },
    warn(code) {
      console.warn("[auth:warn]", code);
    },
  },
  debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig;

const _nextAuth: NextAuthResult = NextAuth(config);

export const handlers: NextAuthResult["handlers"] = _nextAuth.handlers;
export const signIn: NextAuthResult["signIn"] = _nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = _nextAuth.signOut;
export const auth: NextAuthResult["auth"] = _nextAuth.auth;
