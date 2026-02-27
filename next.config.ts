import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow webpack config from @serwist/next alongside Turbopack (Next.js 16 default)
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'aroundaplanet.odoo.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
};

// Dynamic import avoids CJS/ESM mismatch warning:
// Next.js 16 compiles next.config.ts to CJS internally, but @serwist/next is ESM-only.
// Using async config + dynamic import resolves this cleanly.
export default async () => {
  const withSerwistInit = (await import("@serwist/next")).default;
  const withSerwist = withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
  });
  return withSerwist(nextConfig);
};
