import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // Source of the service worker and where the compiled output is written.
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The service worker is only generated for production builds.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The live preview and local development may be accessed from other
  // origins (e.g. the sandbox preview host). Allow them in dev.
  allowedDevOrigins: ["*.e2b.app"],
};

export default withSerwist(nextConfig);
