import { MapView } from "./map-view";
import { canConfigureRoles } from "@/lib/auth/can-configure-roles";

export default async function PropertyMapPage() {
  // Slice #39.73 (Ask first 4): „Adaugă la grup…" is greyed, with the reason, for an account without full access —
  // PATCH /api/groups/[id] refuses it. `canConfigureRoles` is that guard's own predicate (`hasFullAccess`), answered
  // on the server; it decides a button's look, and the route still decides the add.
  const canEditGroups = await canConfigureRoles();
  return (
    // h-full fills the AppShell content area (= viewport height via flex chain).
    // No header here — PropertyMap owns its own header (needed for tab bar state).
    <div className="flex flex-1 flex-col bg-zinc-950 h-full">
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <MapView canEditGroups={canEditGroups} />
        </div>
      </div>
    </div>
  );
}
