import { Anton, Fraunces, Lora, Manrope, Oswald } from "next/font/google";

// Anton and Fraunces have no Cyrillic: Russian pages switch to Oswald and Lora (see :lang(ru) in globals.css)
export const display = Anton({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--f-display" });
export const displayCyr = Oswald({ weight: "600", subsets: ["cyrillic"], variable: "--f-display-cyr" });
export const serif = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  weight: ["400", "600"],
  variable: "--f-serif",
});
export const serifCyr = Lora({ subsets: ["cyrillic"], style: ["normal", "italic"], weight: ["400", "600"], variable: "--f-serif-cyr" });
export const sans = Manrope({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700", "800"], variable: "--f-sans" });

export const fontVariables = [display, displayCyr, serif, serifCyr, sans].map((f) => f.variable).join(" ");
