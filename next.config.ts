import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Mastra runs on the server only and should not be bundled.
  serverExternalPackages: ["@mastra/*"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
