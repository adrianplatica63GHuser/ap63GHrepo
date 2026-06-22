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
    // Items intentionally empty — the sidebar renders this section with
    // checkbox-based filtering (DocumentNavSection in sidebar-nav.tsx).
    key: "document",
    icon: FileText,
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
