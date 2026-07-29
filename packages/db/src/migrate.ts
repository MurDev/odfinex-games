import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { requireDatabaseUrl } from "./env.js";

const databaseUrl = requireDatabaseUrl();
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "../drizzle");

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

try {
  console.log("[db] applying migrations…");
  await migrate(db, { migrationsFolder });
  console.log("[db] migrations applied successfully");
} catch (e) {
  console.error("[db] migration failed:");
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end();
}
