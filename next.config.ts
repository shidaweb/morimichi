import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

initOpenNextCloudflareForDev().catch((err) => {
  console.warn("OpenNext Cloudflare dev init:", err);
});

export default nextConfig;
