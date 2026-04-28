"use client";

import dynamic from "next/dynamic";

// Leaflet requires browser APIs — must not render on the server.
const PropertyMap = dynamic(() => import("./property-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
      Loading map…
    </div>
  ),
});

export function MapView() {
  return <PropertyMap />;
}
