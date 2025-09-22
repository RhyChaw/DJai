import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbopack: {
      // Ensure the root is the app itself to avoid multi-lockfile confusion
      root: __dirname,
    },
  },
};

export default nextConfig;
