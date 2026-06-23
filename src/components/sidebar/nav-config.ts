import type { LucideIcon } from "lucide-react";
import {
  Users,
  Landmark,
  List,
  Map,
  FileText,
  LayoutDashboard,
  UserCog,
  Database,
  Upload,
  Download,
  Settings,
} from "lucide-react";

export type NavItem = {
  key: string;
  href?: string;  // undefined = coming soon (rendered disabled)
  icon: LucideIcon;
};

export type NavSection = {
  key: string;
  icon: LucideIcon;
  items: NavItem[];
  // When set (and items is empty), the section header itself is a direct
  // link — no accordion/chevron, no expandable children. Used by "document"
  // (Slice #15.08): the type-filter checkboxes moved from a sidebar
  // accordion into a dropdown on the Documents list page itself, so the
  // sidebar entry is now a single plain link like any other page link.
  href?: string;
  // When true, the section's sub-items are always shown (no accordion
  // toggle, no chevron) — used by "property" (Slice #15.09): with only two
  // real sub-items (List / Map) left after removing the disabled "Building"
  // placeholder, there's no value in hiding them behind a click.
  alwaysOpen?: boolean;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    // Plain direct link (Slice #15.09) — mirrors "document" (Slice #15.08):
    // the Natural/Judicial split now lives in the "Person type:" dropdown
    // on the unified /persons list page itself, not in the sidebar.
    key: "people",
    icon: Users,
    href: "/persons",
    items: [],
  },
  {
    key: "property",
    icon: Landmark,
    alwaysOpen: true,
    items: [
      { key: "landList", href: "/properties", icon: List },
      { key: "landMap", href: "/properties/map", icon: Map },
    ],
  },
  {
    // Plain direct link (Slice #15.08) — the per-type checkbox filter now
    // lives on the Documents list page itself, not in the sidebar.
    key: "document",
    icon: FileText,
    href: "/documents",
    items: [],
  },
  {
    key: "administration",
    icon: LayoutDashboard,
    items: [
      { key: "users", href: "/admin/users", icon: UserCog },
      { key: "referenceData", href: "/admin/value-lists", icon: Database },
      { key: "import", href: "/admin/import", icon: Upload },
      { key: "export", icon: Download },
      { key: "settings", icon: Settings },
    ],
  },
];
