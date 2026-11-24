"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/components/types";

/** formats a price in the current locale, e.g. "4 978 000 so‘m" / "4 978 000 сум" / "4,978,000 UZS" */
export function usePrice() {
  const locale = useLocale();
  const t = useTranslations("price");
  return (n: number) => formatPrice(n, locale, t("currency"));
}
