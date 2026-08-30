import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-montserrat", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

const SITE_URL = "https://simamanasimba.com";
const SITE_DESCRIPTION = "Simama Nasimba — Tunasimama na Simba. Membership, events, attendance & digital intelligence for the club and its fans.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Simama Nasimba | Tunasimama na Simba",
    template: "%s | Simama Nasimba",
  },
  description: SITE_DESCRIPTION,
  keywords: ["Simama Nasimba", "Tunasimama na Simba", "Simba SC fans"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Simama Nasimba",
    title: "Simama Nasimba | Tunasimama na Simba",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Simama Nasimba | Tunasimama na Simba",
    description: SITE_DESCRIPTION,
  },
};

// Structured data — tells search engines this URL *is* the "Simama Nasimba" entity,
// under every name/spelling someone might actually type (with/without spaces, the
// tagline). This is the real lever for a brand-name query resolving here once Google
// has crawled the site; there's no way to "register" a keyword outside of that.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Simama Nasimba",
  alternateName: ["Simamanasimba", "Tunasimama na Simba"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-surface text-ink antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
