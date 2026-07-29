import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Load monorepo root `.env` (and optional web `.env.local`) for CLI scripts. */
export function loadDbEnv() {
  loadEnv({ path: resolve(root, ".env") });
  loadEnv({ path: resolve(root, "apps/web/.env.local") });
}

export function requireDatabaseUrl(): string {
  loadDbEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env at the repo root.",
    );
  }
  return databaseUrl;
}
