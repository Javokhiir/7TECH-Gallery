"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Corridor, type Tip } from "./corridor";
import type { Collection, Product } from "./types";
import { usePrice } from "@/i18n/usePrice";
import LoadingVeil from "./LoadingVeil";
import ProductCard from "./ProductCard";
import Header from "./Header";
import { loadLogo } from "@/lib/logo";

export default function Gallery({ collections }: { collections: Collection[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const corridor = useRef<Corridor | null>(null);
  const [col, setCol] = useState(0);
  const [focusItem, setFocusItem] = useState<{ p: Product | null; col: string }>({ p: null, col: "" });
  const focused = !!focusItem.p;
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState<Tip>(null);
  const [shown, setShown] = useState(false);
  const [landed, setLanded] = useState(false);
  const [view, setView] = useState<"gallery" | "list">("gallery");
  const [query, setQuery] = useState("");
  const t = useTranslations("gallery");
  const tHeader = useTranslations("header");
  const slogan = useTranslations("brand")("slogan");
  const price = usePrice();
  const tips: Record<Exclude<Tip, null>, string> = { look: t("tipLook"), print: t("tipBack"), collection: t("openCollection") };

  useEffect(() => {
    let disposed = false;
    const css = getComputedStyle(document.documentElement);
    const fonts = {
      body: css.getPropertyValue("--font-body").trim() || "serif",
      display: css.getPropertyValue("--font-display").trim() || "sans-serif",
      brand: css.getPropertyValue("--f-brand").trim() || "sans-serif",
    };
    Promise.all([
      loadLogo("#1a1a1a"),
      loadLogo("#ffffff"),
      // sample text with Cyrillic too, so the Russian fallback faces are loaded before drawing
      document.fonts.load(`700 64px ${fonts.brand}`, slogan.toUpperCase()),
      document.fonts.load(`600 54px ${fonts.body}`, "Aa Яя"),
      document.fonts.load(`italic 400 52px ${fonts.body}`, "Aa Яя"),
      document.fonts.load(`400 64px ${fonts.display}`, "AA ЯЯ"),
    ])
      .catch(() => {})
      .then(() => {
        if (disposed || !canvasRef.current) return;
        corridor.current = new Corridor(canvasRef.current, collections, fonts, {
          onCollection: setCol,
          onFocus: (p, c) => setFocusItem({ p, col: c }),
          onProgress: setProgress,
          onTip: setTip,
          onShown: () => setShown(true),
          onLanding: () => setLanded(true),
        }, slogan);
      });
    return () => {
      disposed = true;
      corridor.current?.dispose();
      corridor.current = null;
    };
  }, [collections, slogan]);

  useEffect(() => {
    document.documentElement.dataset.view = view;
  }, [view]);

  const current = collections[col] ?? collections[0];
  const closeCard = useCallback(() => corridor.current?.unfocus(), []);

  const q = query.trim().toLowerCase();
  const listCols = collections
    .map((c) => ({
      ...c,
      items: q ? c.items.filter((p) => `${p.title} ${p.model} ${c.title}`.toLowerCase().includes(q)) : c.items,
    }))
    .filter((c) => c.items.length);

  return (
    <>
      <Header
        query={query}
        onQuery={setQuery}
        collections={collections}
        onPick={(id) => {
          setView("gallery");
          corridor.current?.goToProduct(id);
        }}
      />

      <div className="view-toggle" role="tablist">
        <button className={view === "gallery" ? "on" : ""} onClick={() => setView("gallery")}>
          {t("viewGallery").toUpperCase()}
        </button>
        <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
          {t("viewList").toUpperCase()}
        </button>
      </div>

      <div
        className="immersive"
        ref={rootRef}
        onPointerMove={(e) => {
          const r = rootRef.current?.getBoundingClientRect();
          if (tipRef.current && r)
            tipRef.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`;
        }}
      >
        <div className={`immersive-scene${shown ? " shown" : ""}`} aria-hidden="true">
          <canvas ref={canvasRef} />
        </div>

        {landed && (
          <div className={`room-caption${focused ? " lit" : ""}`} key={current.slug}>
            <p className="kicker">{t("passing")}</p>
            <h2 className="room-title">{current.title}</h2>
            <a className="more" href={current.url}>
              {t("openCollection")}
            </a>
          </div>
        )}

        <span className={`cursor-tip${tip && landed ? " on" : ""}`} ref={tipRef} aria-hidden="true">
          <span className="cursor-tip-pill">{tip ? tips[tip] : ""}</span>
        </span>

        <ProductCard product={view === "gallery" ? focusItem.p : null} collection={focusItem.col} onClose={closeCard} />

        <nav aria-label={t("collections")} className="scene-index">
          <ul>
            {collections.map((c) => (
              <li key={c.slug}>
                <a href={c.url}>{c.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <LoadingVeil progress={progress} done={shown} />

      {view === "list" && (
        <section className="list">
          {listCols.length === 0 && <p className="empty">{tHeader("searchEmpty", { query })}</p>}
          {listCols.map((c) => (
            <div key={c.slug}>
              <h3>
                {c.title}
                <small>{t("count", { count: c.count }).toUpperCase()}</small>
              </h3>
              <div className="grid">
                {c.items.map((p) => (
                  <a key={p.id} className="card" href={p.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={"/" + p.img} alt={p.title} loading="lazy" />
                    <div className="t">{p.title}</div>
                    <div className="p">{price(p.price)}</div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
