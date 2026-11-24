"use client";

import { useEffect, useRef } from "react";
import { formatPrice, type Collection, type Product } from "./types";
import styles from "./SearchResults.module.css";

export type SearchHit = { product: Product; collection: Collection };

export const MAX_RESULTS = 8;

/** Case-insensitive substring match; every whitespace-separated word must hit title, model or collection title. */
export function searchProducts(collections: Collection[], query: string): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: SearchHit[] = [];
  for (const collection of collections) {
    for (const product of collection.items) {
      const hay = `${product.title} ${product.model} ${collection.title}`.toLowerCase();
      if (words.every((w) => hay.includes(w))) {
        hits.push({ product, collection });
        if (hits.length >= MAX_RESULTS) return hits;
      }
    }
  }
  return hits;
}

export const optionId = (listId: string, productId: number) => `${listId}-opt-${productId}`;

export default function SearchResults({
  id,
  query,
  hits,
  active,
  onHover,
  onPick,
}: {
  id: string;
  query: string;
  hits: SearchHit[];
  active: number;
  onHover: (index: number) => void;
  onPick: (productId: number) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Native listeners so the 3D view behind never sees wheel / pointerdown from the dropdown.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("pointerdown", stop);
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("pointerdown", stop);
    };
  }, []);

  // Keep the highlighted row in view.
  useEffect(() => {
    const hit = hits[active];
    if (!hit) return;
    document.getElementById(optionId(id, hit.product.id))?.scrollIntoView({ block: "nearest" });
  }, [active, hits, id]);

  return (
    <div
      ref={panel}
      className={styles.panel}
      onMouseDown={(e) => e.preventDefault()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {hits.length ? (
        <ul id={id} role="listbox" aria-label="Qidiruv natijalari" className={styles.list}>
          {hits.map(({ product, collection }, i) => (
            <li
              key={product.id}
              id={optionId(id, product.id)}
              role="option"
              aria-selected={i === active}
              className={i === active ? `${styles.row} ${styles.on}` : styles.row}
              onMouseEnter={() => onHover(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(product.id)}
            >
              <span className={styles.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={"/" + product.img} alt="" loading="lazy" decoding="async" />
              </span>
              <span className={styles.text}>
                <span className={styles.title}>{product.title}</span>
                <span className={styles.meta}>
                  {collection.title} · {formatPrice(product.price)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div id={id} role="listbox" aria-label="Qidiruv natijalari" className={styles.empty}>
          “{query.trim()}” bo‘yicha hech narsa topilmadi.
        </div>
      )}
    </div>
  );
}
