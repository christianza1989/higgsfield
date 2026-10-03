import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module and must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
  // X's public video CDN rejects third-party Referer headers. Keep prompt
  // browsing private and allow direct playback without a media proxy.
  async headers() {
    return [{ source: '/prompts', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] }];
  },
};

export default nextConfig;
