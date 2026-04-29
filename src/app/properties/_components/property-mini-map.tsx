"use client";

import dynamic from "next/dynamic";
import type { Corner } from "./form-schema";

// Dynamically imported to keep the Maps bundle out of the server render.
const Inner = dynamic(() => import("./property-mini-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-xs dark:bg-zinc-800">
      Loading map…
    </div>
  ),
});

type Props = {
  corners:  Corner[];
  onChange: (next: Corner[]) => void;
};

export function PropertyMiniMap({ corners, onChange }: Props) {
  return <Inner corners={corners} onChange={onChange} />;
}
