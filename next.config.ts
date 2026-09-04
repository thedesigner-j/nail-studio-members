import type { NextConfig } from "next";

// Webflow embeds this app in an iframe, so it must be allowed to frame us.
// Set WEBFLOW_SITE_ORIGIN (e.g. https://yourbusiness.webflow.io) in the
// environment; without it, framing is left unrestricted for local dev only.
const frameAncestors = process.env.WEBFLOW_SITE_ORIGIN
  ? `frame-ancestors 'self' ${process.env.WEBFLOW_SITE_ORIGIN}`
  : "frame-ancestors 'self'";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: frameAncestors }],
      },
    ];
  },
};

export default nextConfig;
