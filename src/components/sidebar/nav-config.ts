import type { LucideIcon } from "lucide-react";
import {
  Users,
  List,
  Map,
  FileText,
  LayoutDashboard,
  UserCog,
  Database,
  Upload,
  Download,
  Settings,
  HelpCircle,
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
  // (Slice #15.08), "people" (Slice #15.09), and "propertyList"/"propertyMap"
  // (Slice #15.09.2): each of these is a single plain link, styled exactly
  // like any other top-level page link.
  href?: string;
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
    // Plain direct link (Slice #15.09.2). Property used to be a single
    // accordion-shaped section (header + 2 always-visible sub-items); this
    // is now two independent flat-link buttons — "Properties List" and
    // "Properties Map" — with no enclosing "Property" header at all,
    // mirroring the "people"/"document" flat-link pattern exactly.
    key: "propertyList",
    icon: List,
    href: "/properties",
    items: [],
  },
  {
    key: "propertyMap",
    icon: Map,
    href: "/properties/map",
    items: [],
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
      { key: "helpContent", href: "/admin/help-content", icon: HelpCircle },
      { key: "settings", icon: Settings },
    ],
  },
];
