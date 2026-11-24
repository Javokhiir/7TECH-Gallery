import "server-only";
import raw from "@/data/data.json";
import type { Locale } from "@/i18n/routing";
import type { Collection } from "@/components/types";
import { STORE_URL } from "./site";

type Text = Record<Locale, string>;
type RawProduct = { id: number; title: Text; model: string; series: string | null; price: number; img: string; slug: string };
type RawCollection = { slug: string; title: Text; count: number; items: RawProduct[] };

const data = raw as RawCollection[];

/** the catalogue in one language, with store links pointing at that language's store */
export function getCatalog(locale: Locale): Collection[] {
  const store = STORE_URL[locale];
  return data.map((c) => ({
    slug: c.slug,
    title: c.title[locale],
    count: c.count,
    url: `${store}/market?category=${c.slug}`,
    items: c.items.map((p) => ({
      id: p.id,
      title: p.title[locale],
      model: p.model,
      series: p.series,
      price: p.price,
      img: p.img,
      url: `${store}/market/product-page/${p.slug}`,
    })),
  }));
}
