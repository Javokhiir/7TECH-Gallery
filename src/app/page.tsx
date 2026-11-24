import Gallery from "@/components/Gallery";
import data from "@/data/data.json";
import type { Collection } from "@/components/types";
import { SITE_URL } from "@/lib/site";

const collections = data as Collection[];

/** structured data: the site and the collections it shows, for search engines */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "7TECH Galereya",
      url: SITE_URL,
      inLanguage: "uz",
      publisher: { "@type": "Organization", name: "7TECH", url: "https://seventech.uz", logo: `${SITE_URL}/logo.svg` },
    },
    {
      "@type": "ItemList",
      name: "7TECH kolleksiyalari",
      itemListElement: collections.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.title, url: c.url })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Gallery collections={collections} />
    </>
  );
}
