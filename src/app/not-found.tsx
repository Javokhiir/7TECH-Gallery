"use client";

import NextError from "next/error";

// requests that never reach a locale (the proxy normally adds one)
export default function GlobalNotFound() {
  return (
    <html lang="uz">
      <body>
        <NextError statusCode={404} />
      </body>
    </html>
  );
}
