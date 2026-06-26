"use client";

import dynamic from "next/dynamic";

// Dynamically imported (ssr: false) so the Street View library and panorama
// only load on the client when the panel is actually shown — never on property
// open. This keeps the (billed) Dynamic Street View panorama out of the initial
// render; see Slice #18.03b.
const Inner = dynamic(() => import("./street-view-panel-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-xs dark:bg-zinc-800">
      Street View…
    </div>
  ),
});

type Props = {
  // Arithmetic-mean centroid of the property's corners (WGS84). Null when the
  // property has no corners yet — the panel shows an "add a corner" message.
  centroid: { lat: number; lon: number } | null;
};

export function StreetViewPanel({ centroid }: Props) {
  return <Inner centroid={centroid} />;
}
