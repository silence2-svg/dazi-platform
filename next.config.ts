import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // web-push 只在 Node 运行时使用，交给 Node 直接解析，避免 webpack 打包其 ESM 依赖
  serverExternalPackages: ["web-push", "https-proxy-agent", "http_ece", "jws", "asn1.js"],

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
