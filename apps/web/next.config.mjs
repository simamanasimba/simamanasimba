const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
  // Canonicalize on the apex custom domain — www and the default *.vercel.app
  // domain both still serve this same project, so anything landing there
  // (an old bookmark, a stale QR code, a search result) needs to end up on
  // https://simamanasimba.com instead of a second, CORS-broken origin.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.simamanasimba.com" }],
        destination: "https://simamanasimba.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "simamanasimba.vercel.app" }],
        destination: "https://simamanasimba.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
