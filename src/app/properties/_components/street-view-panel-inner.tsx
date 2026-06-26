"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  centroid: { lat: number; lon: number } | null;
};

// The outcome of a coverage lookup for a specific coordinate. Stored together
// with the coordinate it was resolved for, so we can tell — purely in render —
// whether the latest result matches the current centroid (else: still loading).
type Resolved = {
  lat: number;
  lon: number;
  status: "ok" | "none" | "error";
};

// ---------------------------------------------------------------------------
// Initial-bearing from one WGS84 point to another, in degrees [0, 360).
// Used to face the panorama camera toward the property (Street View snaps to
// the nearest road, which is usually off to one side). Pure maths — no library
// load needed (avoids pulling in the "geometry" library just for this).
// ---------------------------------------------------------------------------

function headingBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dLambda = toRad(to.lng - from.lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ---------------------------------------------------------------------------
// Street View panel — imperative panorama (no <StreetView> component exists in
// @vis.gl/react-google-maps, so we construct google.maps.StreetViewPanorama
// directly). The container has a concrete pixel height supplied by the parent.
// ---------------------------------------------------------------------------

export default function StreetViewPanelInner({ centroid }: Props) {
  const t = useTranslations("property.streetView");

  // Loads the Street View library on mount (i.e. when the panel is opened).
  const streetViewLib = useMapsLibrary("streetView");

  const containerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);

  // Set ONLY from the async getPanorama callback (never synchronously in the
  // effect body) — that keeps this clear of react-hooks/set-state-in-effect.
  const [resolved, setResolved] = useState<Resolved | null>(null);

  // Primitive deps so the effect only re-runs on an actual coordinate change
  // (not on every parent re-render / new centroid object identity).
  const lat = centroid?.lat ?? null;
  const lon = centroid?.lon ?? null;

  useEffect(() => {
    if (lat === null || lon === null) return;
    if (!streetViewLib || !containerRef.current) return;

    let cancelled = false;
    const target = { lat, lng: lon };
    const service = new streetViewLib.StreetViewService();

    // getPanorama is a free coverage check; we only construct the (billed)
    // panorama when imagery actually exists within the radius.
    service.getPanorama(
      { location: target, radius: 120 },
      (data, svStatus) => {
        if (cancelled) return;

        const location = data?.location;
        const container = containerRef.current;

        if (
          svStatus === google.maps.StreetViewStatus.OK &&
          location?.pano &&
          container
        ) {
          const panoId = location.pano;
          const panoLatLng = location.latLng;
          const heading = panoLatLng
            ? headingBetween(
                { lat: panoLatLng.lat(), lng: panoLatLng.lng() },
                target,
              )
            : 0;

          if (!panoRef.current) {
            panoRef.current = new streetViewLib.StreetViewPanorama(container, {
              pano: panoId,
              pov: { heading, pitch: 0 },
              zoom: 0,
              visible: true,
              addressControl: false,
              fullscreenControl: true,
              motionTracking: false,
              motionTrackingControl: false,
              enableCloseButton: false,
            });
          } else {
            panoRef.current.setPano(panoId);
            panoRef.current.setPov({ heading, pitch: 0 });
            panoRef.current.setVisible(true);
          }
          setResolved({ lat, lon, status: "ok" });
        } else if (svStatus === google.maps.StreetViewStatus.ZERO_RESULTS) {
          setResolved({ lat, lon, status: "none" });
        } else {
          setResolved({ lat, lon, status: "error" });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [streetViewLib, lat, lon]);

  // Derive the view purely (no status state set in the effect): no coordinate →
  // "noLocation"; a result that doesn't match the current centroid yet →
  // "loading"; otherwise the resolved outcome.
  const hasLocation = lat !== null && lon !== null;
  const resolvedForCurrent =
    resolved !== null && resolved.lat === lat && resolved.lon === lon;
  const view: "noLocation" | "loading" | "ok" | "noCoverage" | "error" =
    !hasLocation
      ? "noLocation"
      : !resolvedForCurrent
        ? "loading"
        : resolved!.status === "ok"
          ? "ok"
          : resolved!.status === "none"
            ? "noCoverage"
            : "error";

  return (
    <div className="relative h-full w-full bg-zinc-100 dark:bg-zinc-800">
      {/* Panorama mounts here; concrete height comes from the parent wrapper. */}
      <div ref={containerRef} className="absolute inset-0" />

      {view !== "ok" && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {view === "loading"
            ? t("loading")
            : view === "error"
              ? t("error")
              : view === "noLocation"
                ? t("noLocation")
                : t("noCoverage")}
        </div>
      )}
    </div>
  );
}
