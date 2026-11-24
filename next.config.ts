import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // ponytail: cacheComponents (dynamicIO) off — every staff page reads the
  // session, so Suspense-per-page gets no win here. Re-enable if the app
  // grows public, cacheable pages that need the static shell.
  // PDF invoices read DM Sans from node_modules at runtime; make sure
  // it ships with the server bundle.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@fontsource/dm-sans/files/dm-sans-latin-*-normal.woff",
      "./public/tftg-logo.png",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
