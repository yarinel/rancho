import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM server deps must not be bundled by Turbopack/webpack
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
