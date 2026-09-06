import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Produces a self-contained .next/standalone build (server + only the
  // node_modules it actually needs) so the Docker image doesn't have to
  // ship the full node_modules tree. Purely additive — `npm start` against
  // the regular .next output (e.g. on Render) is unaffected.
  output: "standalone",
};

export default nextConfig;
