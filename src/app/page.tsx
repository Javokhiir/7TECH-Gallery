import Gallery from "@/components/Gallery";
import data from "@/data/data.json";
import type { Collection } from "@/components/types";

export default function Home() {
  return <Gallery collections={data as Collection[]} />;
}
