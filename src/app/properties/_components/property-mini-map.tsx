"use client";

import dynamic from "next/dynamic";
import type { Corner } from "./form-schema";

const Inner = dynamic(() => import("./property-mini-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-xs dark:bg-zinc-800">
      Loading map…
    </div>
  ),
});

export function PropertyMiniMap({ corners }: { corners: Corner[] }) {
  return <Inner corners={corners} />;
}
