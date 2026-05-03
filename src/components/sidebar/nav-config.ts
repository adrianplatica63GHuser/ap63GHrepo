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
  FileSignature,
  Award,
  ShieldCheck,
  ScrollText,
  Search,
  BarChart2,
  LayoutDashboard,
  UserCog,
  Database,
  ArrowUpDown,
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
      { key: "judicialPerson", icon: Building2 },
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
    key: "paperwork",
    icon: FileText,
    items: [
      { key: "contract", icon: FileSignature },
      { key: "certificate", icon: Award },
      { key: "authorization", icon: ShieldCheck },
      { key: "deed", icon: ScrollText },
      { key: "extract", icon: Search },
      { key: "report", icon: BarChart2 },
    ],
  },
  {
    key: "administration",
    icon: LayoutDashboard,
    items: [
      { key: "users", icon: UserCog },
      { key: "referenceData", href: "/admin/value-lists", icon: Database },
      { key: "importExport", icon: ArrowUpDown },
      { key: "settings", icon: Settings },
    ],
  },
];
