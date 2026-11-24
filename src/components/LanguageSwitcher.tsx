"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import styles from "./LanguageSwitcher.module.css";

/** UZ · RU · EN — switches the page language and keeps the current path */
export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("header");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.switcher} role="group" aria-label={t("language")} aria-busy={pending}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={l === locale ? styles.on : undefined}
          aria-pressed={l === locale}
          onClick={() => l !== locale && startTransition(() => router.replace(pathname, { locale: l }))}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
