import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import { routing } from "@/i18n/routing";
import { getCatalog } from "@/lib/catalog";
import { localeUrl, SITE_URL } from "@/lib/site";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const collections = getCatalog(locale);
  const t = await getTranslations("meta");

  // structured data: the site and the collections it shows, for search engines
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: t("siteName"),
        url: localeUrl(locale),
        inLanguage: locale,
        publisher: { "@type": "Organization", name: "7TECH", url: "https://seventech.uz", logo: `${SITE_URL}/logo.svg` },
      },
      {
        "@type": "ItemList",
        name: t("collections"),
        itemListElement: collections.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.title, url: c.url })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Gallery collections={collections} />
    </>
  );
}
