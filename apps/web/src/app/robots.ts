import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/forgot-password"],
        // Org dashboards are auth-gated anyway, but keep them out of the index —
        // nothing there is meant to be publicly discoverable via search.
        disallow: ["/org/"],
      },
    ],
    sitemap: "https://simamanasimba.com/sitemap.xml",
  };
}
