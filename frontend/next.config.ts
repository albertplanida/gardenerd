import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination:
          process.env.GRAPHQL_ENDPOINT ?? "http://localhost:8000/graphql/",
      },
    ];
  },
};

export default nextConfig;
