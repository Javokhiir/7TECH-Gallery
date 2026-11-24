import type { Metadata, Viewport } from "next";
import { Anton, Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--f-display" });
const sans = Manrope({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700", "800"], variable: "--f-sans" });
const serif = Fraunces({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], weight: ["400", "600"], variable: "--f-serif" });

export const metadata: Metadata = {
  title: "7TECH | Galereya",
  description: "7TECH galereyasi: mahsulotlarni 3D koridorda aylanib ko‘ring. Kelajak. Bugun",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
