import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  // Suppress some build warnings
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
