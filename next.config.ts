import type { NextConfig } from "next";
import { webpack } from "next/dist/compiled/webpack/webpack";

const nextConfig: NextConfig = {
  // Disable ESLint during builds and development
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Add webpack config to handle punycode deprecation
  webpack: (config, { isServer }) => {
    // Replace punycode with a fallback if it's being used
    config.resolve.fallback = {
      ...config.resolve.fallback,
      punycode: false,
    };

    return config;
  },
  async headers() {
    return [
      {
        // Apply CORS headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Allow all origins
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
