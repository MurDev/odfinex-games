import { Hono } from "hono";

import { requirePlatformSession, type AuthVariables } from "../middleware/auth.js";

export const meRoutes = new Hono<{ Variables: AuthVariables }>();

meRoutes.get("/me", requirePlatformSession, (c) => {
  return c.json({ user: c.get("user") });
});
