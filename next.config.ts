import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence the warning about multiple lockfiles
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
