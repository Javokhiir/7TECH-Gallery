import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/galereya", destination: "/", permanent: true }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
