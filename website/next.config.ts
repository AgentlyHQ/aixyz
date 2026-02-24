import { NextConfig } from "next";

const config: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "https://aixyz.sh",
        permanent: true,
      },
    ];
  },
};

export default config;
