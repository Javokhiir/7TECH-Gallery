"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { STORE_URL } from "@/lib/site";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";
import SearchResults, { optionId, searchProducts } from "./SearchResults";
import styles from "./SearchResults.module.css";
import type { Collection } from "./types";

export default function Header({
  query,
  onQuery,
  collections,
  onPick,
}: {
  query: string;
  onQuery: (v: string) => void;
  collections: Collection[];
  onPick: (productId: number) => void;
}) {
  const t = useTranslations("header");
  const tBrand = useTranslations("brand");
  const store = STORE_URL[useLocale() as Locale];
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [focused, setFocused] = useState(false);
  // Highlight is tied to the query it was set for, so typing resets it to the first row.
  const [highlight, setHighlight] = useState({ q: query, i: 0 });
  const active = highlight.q === query ? highlight.i : 0;
  const setActive = (i: number) => setHighlight({ q: query, i });

  const hits = useMemo(
    () => searchProducts(collections, query),
    [collections, query],
  );
  const open = focused && query.trim().length > 0;
  const activeHit = open ? hits[active] : undefined;

  const pick = (productId: number) => {
    onPick(productId);
    onQuery("");
    input.current?.blur();
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onQuery("");
      input.current?.blur();
      return;
    }
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((active + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((active - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick((hits[active] ?? hits[0]).product.id);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="top">
      <a className="logo" href={store} aria-label="7TECH">
        <Logo />
      </a>
      <span className="slogan">{tBrand("slogan")}</span>
      <nav className="nav">
        <Link href="/" className="active">
          {t("gallery")}
        </Link>
        <a href={`${store}/market`}>{t("shop")}</a>
        <a href={`${store}/branches`}>{t("branches")}</a>
        <a href={`${store}/delivery-terms`}>{t("delivery")}</a>
        <a href={store}>{t("help")}</a>
      </nav>
      <div className="tools">
        <div className={styles.anchor}>
          <label className="search">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              ref={input}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onInputKey}
              placeholder={t("search")}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={
                activeHit ? optionId(listId, activeHit.product.id) : undefined
              }
              // autofill extensions add field_signature/form_signature attributes before hydration
              suppressHydrationWarning
            />
            <kbd>⌘K</kbd>
          </label>
          {open && (
            <SearchResults
              id={listId}
              query={query}
              hits={hits}
              active={active}
              onHover={setActive}
              onPick={pick}
            />
          )}
        </div>
        <LanguageSwitcher />
        <a className="ico" href={store} aria-label={t("profile")}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </svg>
        </a>
        <a
          className="ico cart"
          href={`${store}/market`}
          aria-label={t("cart")}
        >
          <svg viewBox="0 0 24 24">
            <path d="M3 4h2l2 11h11l2-8H7" />
            <circle cx="9" cy="19" r="1.3" />
            <circle cx="17" cy="19" r="1.3" />
          </svg>
          <span>(0)</span>
        </a>
      </div>
    </header>
  );
}
