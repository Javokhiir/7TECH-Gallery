import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { localeUrl, SITE_URL } from "@/lib/site";
import "./globals.css";

const OG_LOCALE: Record<Locale, string> = { uz: "uz_UZ", ru: "ru_RU", en: "en_US" };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");
  const image = { url: `/og/${locale}.png`, width: 1200, height: 630, alt: t("ogAlt") };

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${t("siteName")}` },
    description,
    applicationName: t("siteName"),
    authors: [{ name: "7TECH", url: "https://seventech.uz" }],
    creator: "7TECH",
    publisher: "7TECH",
    alternates: {
      canonical: localeUrl(locale),
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, localeUrl(l)])),
        "x-default": localeUrl(routing.defaultLocale),
      },
    },
    openGraph: {
      type: "website",
      url: localeUrl(locale),
      siteName: t("siteName"),
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    icons: { icon: "/logo.svg" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0e10",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
