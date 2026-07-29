import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@odfinex/shared", "@odfinex/games-sdk"],
};

export default nextConfig;
