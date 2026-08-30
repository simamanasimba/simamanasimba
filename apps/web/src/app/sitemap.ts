import type { MetadataRoute } from "next";

const SITE_URL = "https://simamanasimba.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/register`, priority: 0.8 },
    { url: `${SITE_URL}/login`, priority: 0.5 },
  ];
}
