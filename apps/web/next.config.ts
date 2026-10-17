import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The parent folder is its own git repo with its own lockfile; pin the trace
  // root so Next does not guess wrong.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Lets the dev server's HMR/asset requests through when demoing over a
  // Cloudflare quick tunnel; without this hydration silently fails and the
  // page renders as empty client components.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
