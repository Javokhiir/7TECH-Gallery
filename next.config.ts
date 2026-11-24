import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/galereya", destination: "/", permanent: true }];
  },
};

export default nextConfig;
