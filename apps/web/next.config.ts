import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@odfinex/shared", "@odfinex/db"],
  // Load .env from monorepo root (not apps/web)
  envDir: path.join(__dirname, "../.."),
};

export default nextConfig;
