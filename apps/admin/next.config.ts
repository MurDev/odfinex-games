import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@odfinex/shared"],
};

export default nextConfig;
