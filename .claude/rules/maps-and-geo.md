---
paths:
  - "src/components/**/*map*"
  - "src/app/properties/**"
  - "src/app/admin/calculation/**"
  - "src/lib/geo/**"
  - "src/lib/calculation/**"
---

# Google Maps & Stereo 70 geometry

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **`AdvancedMarker` requires `mapId`.** Using `<AdvancedMarker>` without a `mapId` on the parent `<Map>` triggers the "This page can't load Google Maps correctly" error overlay on every render. Always pass `mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}` to any `<Map>` that hosts `AdvancedMarker` children. `"DEMO_MAP_ID"` is Google's official dev placeholder and requires no Cloud Console setup.

- **Google Maps height chain.** `<Map style={{ height: "100%" }}>` only resolves when every ancestor has a concrete pixel height. `flex-1` alone (flex-algorithm height) does not satisfy this — wrap the map container in `<div className="relative flex-1 min-h-0"><div className="absolute inset-0">...</div></div>` to give it a concrete bounding box.

- **`@vis.gl/react-google-maps` event types differ by component.** `Map` component events give `MapMouseEvent` (library type) where `latLng` is a plain literal accessed as `event.detail.latLng?.lat` (property). `AdvancedMarker` drag events give `google.maps.MapMouseEvent` where `latLng` is a `LatLng` object accessed as `e.latLng?.lat()` (method call). Mixing these up is a silent runtime bug.

- **Coordinate axis order in Romanian cadastral text files**: The file columns are labeled `X [m]` (= Northing, ~300 000–850 000) and `Y [m]` (= Easting, ~200 000–800 000). This is the local Romanian geodetic convention where X points North — **opposite** to GDAL/PostGIS standard (X = Easting, Y = Northing). When calling `stereo70ToWgs84(north, east)`: pass the X column as `north` and the Y column as `east`. Valid Stereo70 range for the project area (Bragadiru, Ilfov): Northing ~320 000–325 000, Easting ~575 000–585 000.

## Harvested from the slice log

- **Keep the Calculation working frame rotated to align `u` with the ROAD edge itself — not merely with a long side.** That alignment is what makes both of the road's long sides constant-`v` and the cap at constant-`u` truly perpendicular, so the road's east end (where it meets owner N) is an exact right angle while its west end just follows the polygon's existing slanted side. Every inter-owner border is a constant-`u` line, so the same rotation is what makes them perpendicular to the road too. It also makes the geometry orientation-agnostic across HORIZONTAL and VERTICAL polygons and all four start corners. Preserve this alignment as the Calculation feature is enhanced — do not re-derive the frame from a bounding box or from the longest side.

- **`src/lib/calculation/geometry.ts` is conversion-free Stereo 70 maths; `compute.ts` is where WGS84 conversion happens** via `transdatRO`. Keep new geometry pure and unit-tested, and do not let a lat/lng creep into the geometry layer.

- **`src/components/providers/maps-provider.tsx` holds the `APIProvider` that wraps the whole app,** seeded with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Any map surface is already inside it — never mount a second `APIProvider`, and load extra libraries (geocoding, Street View) lazily from within it rather than by adding a provider.
