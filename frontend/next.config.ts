import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
