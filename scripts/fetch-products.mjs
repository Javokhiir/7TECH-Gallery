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

// categories the API has not translated yet
const CATEGORY_UZ = { "morozilnye-kamery": "Muzlatgich kameralari" };

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
  if (!bySlug.has(c.slug)) bySlug.set(c.slug, { title: c.locale?.uz?.title ?? c.title, items: [] });
  bySlug.get(c.slug).items.push(p);
}

const collections = [];
const downloads = [];
for (const slug of ORDER.filter((s) => bySlug.has(s))) {
  const c = bySlug.get(slug);
  const seen = new Set();
  const items = [];
  for (const p of [...c.items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))) {
    const title = p.locales?.uz?.title ?? p.title;
    const stem = title.replace(/,\s*[^,]+$/, "").trim().toLowerCase(); // drop colour variants
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
      url: `https://seventech.uz/market/product-page/${p.slug}`,
    });
    if (items.length === PER_COLLECTION) break;
  }
  collections.push({ slug, title: c.title, count: c.items.length, url: `https://seventech.uz/market?category=${slug}`, items });
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
