"use client";

import dynamic from "next/dynamic";

// Dynamically imported to keep the Maps bundle out of the server render.
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
