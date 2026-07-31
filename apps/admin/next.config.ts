import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@odfinex/shared", "@odfinex/db"],
};

export default nextConfig;
