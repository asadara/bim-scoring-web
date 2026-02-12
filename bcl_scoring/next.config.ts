import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/bcl/index.html", destination: "/" },
      { source: "/js/:path*", destination: "/bcl/js/:path*" },
      { source: "/css/:path*", destination: "/bcl/css/:path*" },
    ];
  },
};

export default nextConfig;
