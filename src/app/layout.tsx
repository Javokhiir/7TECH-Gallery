import type { Metadata, Viewport } from "next";
import { Anton, Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--f-display" });
const sans = Manrope({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700", "800"], variable: "--f-sans" });
const serif = Fraunces({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], weight: ["400", "600"], variable: "--f-serif" });

import { SITE_URL } from "@/lib/site";
const TITLE = "7TECH 3D Galereya | Mahsulotlarni 3D koridorda ko‘ring";
const DESCRIPTION =
  "7TECH mahsulotlari 3D galereyada: smartfonlar, televizorlar, monitorlar, sovutgichlar, konditsionerlar va boshqa maishiy texnikani virtual koridorda aylanib ko‘ring. Kelajak. Bugun.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s | 7TECH Galereya" },
  description: DESCRIPTION,
  applicationName: "7TECH Galereya",
  keywords: [
    "7TECH",
    "7TECH galereya",
    "3D galereya",
    "maishiy texnika",
    "smartfon",
    "televizor",
    "monitor",
    "sovutgich",
    "konditsioner",
    "Toshkent",
    "O‘zbekiston",
  ],
  authors: [{ name: "7TECH", url: "https://seventech.uz" }],
  creator: "7TECH",
  publisher: "7TECH",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "7TECH Galereya",
    title: TITLE,
    description: DESCRIPTION,
    locale: "uz_UZ",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  icons: { icon: "/logo.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0d0e10" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
