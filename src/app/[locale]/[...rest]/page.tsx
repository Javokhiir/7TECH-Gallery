import { notFound } from "next/navigation";

// unknown paths inside a locale render that locale's not-found page
export default function CatchAll() {
  notFound();
}
