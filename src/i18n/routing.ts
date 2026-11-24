import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  // Uzbek lives at "/", the others at "/ru" and "/en"
  localePrefix: "as-needed",
  // "/" is always Uzbek; the language changes only when the visitor picks one
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
