import { MapView } from "./map-view";

export default async function PropertyMapPage() {
  return (
    // h-full fills the AppShell content area (= viewport height via flex chain).
    // No header here — PropertyMap owns its own header (needed for tab bar state).
    <div className="flex flex-1 flex-col bg-zinc-950 h-full">
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <MapView />
        </div>
      </div>
    </div>
  );
}
