"use client";

import { useEffect } from "react";
import { formatPrice, type Product } from "./types";
import styles from "./ProductCard.module.css";

export default function ProductCard({
  product,
  collection,
  onClose,
}: {
  product: Product | null;
  collection: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product, onClose]);

  if (!product) return null;

  return (
    <aside key={product.id} className={styles.card} role="dialog" aria-label={product.title}>
      <button type="button" className={styles.close} aria-label="Yopish" onClick={onClose}>
        ✕
      </button>
      <div className={styles.media}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={"/" + product.img} alt={product.title} className={styles.img} decoding="async" />
      </div>
      <div className={styles.body}>
        <p className={styles.kicker}>{collection}</p>
        <h2 className={styles.title}>{product.title}</h2>
        {product.model ? <p className={styles.model}>{product.model}</p> : null}
        <p className={styles.price}>{formatPrice(product.price)}</p>
      </div>
      <a className={styles.cta} href={product.url} target="_blank" rel="noopener noreferrer">
        Do‘konda ko‘rish →
      </a>
    </aside>
  );
}
