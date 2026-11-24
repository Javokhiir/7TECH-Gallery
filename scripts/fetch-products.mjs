// Pulls products from the seventech.uz API into src/data/data.json and downloads their images to public/img.
// Usage: npm run fetch-products
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.seventech.uz/api/products";
const PER_COLLECTION = 10;
const ORDER = [
  "smartfony", "televizory", "monitory", "xolodilniki", "kondicionery", "ctiralnye-masiny", "kofemasiny",
  "pylesosy", "ocistiteli-vozduxa", "duxovye-skafy", "varocnye-paneli", "vytiazki", "posudomoecnye-masiny",
  "mikrovolnovye-peci", "aerogrili", "blendery", "dispenser-dlia-vody", "videonabliudenie", "domofoniia",
];

const LOCALES = ["uz", "ru", "en"];
/** collections shown as one piece per colour (e.g. the same phone in black and in white) */
const BY_COLOUR = new Set(["smartfony"]);

/** { uz, ru, en } from the API's per-language records, falling back to the base (Russian) text */
const localized = (records, base) => Object.fromEntries(LOCALES.map((l) => [l, records?.[l]?.title || base]));

const exists = (p) => access(p).then(() => true, () => false);

async function fetchAll() {
  const all = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}?page=${page}&per_page=100`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    all.push(...json.data);
    if (page >= json.meta.last_page) break;
  }
  return all;
}

const products = (await fetchAll()).filter((p) => p.is_active && p.media?.images?.length);
const bySlug = new Map();
for (const p of products) {
  const c = p.category;
  if (!bySlug.has(c.slug)) bySlug.set(c.slug, { title: localized(c.locale, c.title), items: [] });
  bySlug.get(c.slug).items.push(p);
}

const collections = [];
const downloads = [];
for (const slug of ORDER.filter((s) => bySlug.has(s))) {
  const c = bySlug.get(slug);
  const seen = new Set();
  const items = [];
  for (const p of [...c.items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))) {
    const title = localized(p.locales, p.title);
    // one piece per model (colour variants dropped); for these collections, one per colour instead
    const colour = title.uz.match(/,\s*([^,]+)$/)?.[1].trim().toLowerCase() ?? "";
    const stem = BY_COLOUR.has(slug) ? colour : title.uz.replace(/,\s*[^,]+$/, "").trim().toLowerCase();
    if (seen.has(stem)) continue;
    seen.add(stem);
    const img = `img/${p.id}.webp`;
    downloads.push([`${p.media.images[0].original_url}&w=768`, join(ROOT, "public", img)]);
    items.push({
      id: p.id,
      title,
      model: p.model,
      series: p.series ? String(p.series).toUpperCase() : null,
      price: p.price,
      img,
      slug: p.slug,
    });
    if (items.length === PER_COLLECTION) break;
  }
  collections.push({ slug, title: c.title, count: c.items.length, items });
}

await mkdir(join(ROOT, "public", "img"), { recursive: true });
let fetched = 0;
for (let i = 0; i < downloads.length; i += 12) {
  await Promise.all(
    downloads.slice(i, i + 12).map(async ([url, file]) => {
      if (await exists(file)) return;
      const res = await fetch(url);
      if (!res.ok) return console.warn("skip", url, res.status);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      fetched++;
    }),
  );
}
await writeFile(join(ROOT, "src", "data", "data.json"), JSON.stringify(collections, null, 1));
console.log(`${collections.length} collections, ${downloads.length} products, ${fetched} new images`);
