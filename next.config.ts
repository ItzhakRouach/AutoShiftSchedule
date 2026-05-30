import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't pick up an unrelated lockfile
  // from a parent directory (silences the multi-lockfile warning).
  turbopack: { root: __dirname },
};

export default nextConfig;
