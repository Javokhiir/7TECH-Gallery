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

export const formatPrice = (n: number) => `${n.toLocaleString("ru-RU").replace(/ /g, " ")} so‘m`;
