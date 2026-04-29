"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

/**
 * Wraps the app in the Google Maps JS API provider.
 * Must be a Client Component because APIProvider uses createContext internally.
 * The API key is a NEXT_PUBLIC_ variable, so it is safely inlined at build time.
 */
export function MapsProvider({ children }: { children: React.ReactNode }) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}>
      {children}
    </APIProvider>
  );
}
