import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { localeUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, localeUrl(l)]));
  return routing.locales.map((locale) => ({
    url: localeUrl(locale),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === routing.defaultLocale ? 1 : 0.8,
    alternates: { languages },
  }));
}
