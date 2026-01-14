import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for OpenNext Cloudflare adapter
  output: "standalone",
};

export default nextConfig;
