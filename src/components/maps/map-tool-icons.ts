/**
 * The big map's toolbar buttons — their icons and the message keys of their names, in one place.   (Slice #39.78)
 *
 * The map draws its buttons from here, and so do the „Instrumente" guides that explain them (map-guide-dialog.tsx):
 * a button whose icon or name changes changes in both, so a guide never shows a picture the map no longer has.
 * The names are keys under `property` (`property.map.anglesButton`, …), the namespace the map reads.
 */
import type { ComponentType } from "react";
import { DraftingCompass, Fence, Group, Ruler, SquareDashedMousePointer, type LucideProps } from "lucide-react";

import { AreaDelimitedIcon, AreaFreeIcon } from "@/components/icons/area-icons";
import type { MapTool } from "@/lib/ui/area-pulse";

export const MAP_TOOL_ICON: Record<MapTool, ComponentType<LucideProps>> = {
  angles: DraftingCompass,
  ruler: Ruler,
  areaDelimited: AreaDelimitedIcon,
  areaFree: AreaFreeIcon,
  tarlale: Fence,
  groups: Group,
  select: SquareDashedMousePointer,
};

/** Each button's name, as a key under `property` — what the map's own `t(…)` calls ask for. */
export const MAP_TOOL_LABEL: Record<MapTool, `map.${string}`> = {
  angles: "map.anglesButton",
  ruler: "map.rulerButton",
  areaDelimited: "map.areaDelimitedButton",
  areaFree: "map.areaFreeButton",
  tarlale: "map.tarlaleButton",
  groups: "map.groupsButton",
  select: "map.select",
};
