/** a product as the UI sees it: already resolved to one language */
export type Product = {
  id: number;
  title: string;
  model: string;
  series: string | null;
  price: number;
  img: string;
  url: string;
};

export type Collection = {
  slug: string;
  title: string;
  count: number;
  url: string;
  items: Product[];
};

/** price with locale digit grouping and the localized currency name */
export const formatPrice = (n: number, locale: string, currency: string) =>
  `${new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(n).replace(/\s/g, " ")} ${currency}`;
