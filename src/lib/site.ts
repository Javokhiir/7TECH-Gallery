import type { Locale } from "@/i18n/routing";

export const SITE_URL = "https://7tech-gallery.vercel.app";

/** the 7TECH store in each language (Russian is the store's default, unprefixed) */
export const STORE_URL: Record<Locale, string> = {
  uz: "https://seventech.uz/uz",
  ru: "https://seventech.uz",
  en: "https://seventech.uz/en",
};

/** absolute URL of a page of this site in a locale ("/" for Uzbek, "/ru", "/en") */
export const localeUrl = (locale: Locale, path = "") =>
  `${SITE_URL}${locale === "uz" ? "" : `/${locale}`}${path}` || SITE_URL;
