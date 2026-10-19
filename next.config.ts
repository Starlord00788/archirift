import type { NextConfig } from "next";

// Archirift ships as a static site (see PRD: "Static export check").
// Anything that needs a request-time server is out of scope until v1.x.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
