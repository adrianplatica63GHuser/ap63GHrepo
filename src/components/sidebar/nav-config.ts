import type { LucideIcon } from "lucide-react";
import {
  Users,
  User,
  Building2,
  Landmark,
  List,
  Map,
  Building,
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
};

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "people",
    icon: Users,
    items: [
      { key: "naturalPerson", href: "/natural-persons", icon: User },
      { key: "judicialPerson", href: "/judicial-persons", icon: Building2 },
    ],
  },
  {
    key: "property",
    icon: Landmark,
    items: [
      { key: "landList", href: "/properties", icon: List },
      { key: "landMap", href: "/properties/map", icon: Map },
      { key: "building", icon: Building },
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
