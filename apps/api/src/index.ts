import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HealthResponse } from "@odfinex/shared";

import { checkDbConnection } from "./db.js";
import { meRoutes } from "./routes/me.js";
import { launchRoutes } from "./routes/launch.js";
import { sessionRoutes } from "./routes/session.js";
import { gamesRoutes } from "./routes/games.js";
import { walletRoutes } from "./routes/wallet.js";
import { adminRoutes } from "./routes/admin.js";

const app = new Hono();
const port = Number(process.env.PORT ?? 4000);
const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const playUrl = process.env.PLAY_URL ?? "http://localhost:3001";
/** External game origins (comma-separated), e.g. DUELPION on :3002 */
const gameOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3002")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: [webUrl, playUrl, "http://localhost:5173", ...gameOrigins],
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-client-secret",
      "x-timestamp",
      "x-client-signature",
    ],
  }),
);

app.get("/health", async (c) => {
  const dbOk = await checkDbConnection();
  const body: HealthResponse = {
    ok: dbOk,
    service: "odfinex-games-api",
    version: "0.1.0",
    db: dbOk ? "connected" : "disconnected",
  };
  return c.json(body, dbOk ? 200 : 503);
});

app.get("/", (c) =>
  c.json({
    name: "Odfinex Games API",
    version: "0.1.0",
    endpoints: [
      "GET /health",
      "GET /v1/me",
      "POST /v1/launch",
      "GET /v1/session",
      "GET /v1/games",
      "GET /v1/wallet",
      "POST /v1/wallet/debit",
      "POST /v1/wallet/credit",
      "GET /v1/wallet/transactions",
      "POST /v1/wallet/grant",
      "GET /v1/admin/stats",
      "GET /v1/admin/games",
      "POST /v1/admin/games",
      "PATCH /v1/admin/games/:clientId",
      "GET /v1/admin/players",
      "GET /v1/admin/players/:id",
      "GET /v1/admin/transactions",
    ],
  }),
);

const v1 = new Hono();
v1.route("/", meRoutes);
v1.route("/", launchRoutes);
v1.route("/", sessionRoutes);
v1.route("/", gamesRoutes);
v1.route("/", walletRoutes);
v1.route("/", adminRoutes);
app.route("/v1", v1);

export { app };

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});
