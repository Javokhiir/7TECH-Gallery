"use client";

import { useTranslations } from "next-intl";
import Logo from "./Logo";
import styles from "./LoadingVeil.module.css";

export default function LoadingVeil({ progress, done }: { progress: number; done: boolean }) {
  const t = useTranslations("loading");
  const tBrand = useTranslations("brand");
  const p = Math.min(1, Math.max(0, progress || 0));

  return (
    <div className={`${styles.veil} ${done ? styles.done : ""}`} aria-hidden={done}>
      <Logo className={styles.logo} />
      <p className={styles.slogan}>{tBrand("slogan").toUpperCase()}</p>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={t("label")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
      >
        <div className={styles.fill} style={{ transform: `scaleX(${p})` }} />
      </div>
    </div>
  );
}
