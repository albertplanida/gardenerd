import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_ENDPOINT ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: process.env.GRAPHQL_ENDPOINT ?? `${backendUrl}/graphql/`,
      },
      {
        source: "/api/:path*/",
        destination: `${backendUrl}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/admin",
        destination: `${backendUrl}/admin/`,
      },
      {
        source: "/admin/",
        destination: `${backendUrl}/admin/`,
      },
      {
        source: "/admin/:path*/",
        destination: `${backendUrl}/admin/:path*/`,
      },
      {
        source: "/admin/:path*",
        destination: `${backendUrl}/admin/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${backendUrl}/static/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendUrl}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
