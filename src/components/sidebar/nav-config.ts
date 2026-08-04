import type { LucideIcon } from "lucide-react";
import {
  User,
  Building2,
  List,
  Map,
  FileText,
  LayoutDashboard,
  UserCog,
  Database,
  Upload,
  ClipboardCheck,
  ClipboardList,
  Wrench,
  Settings,
  HelpCircle,
  Calculator,
  Search,
} from "lucide-react";

export type NavItem = {
  key: string;
  href?: string;  // undefined = coming soon (rendered disabled)
  icon: LucideIcon;
  /**
   * Slice #23.10.dev — hidden unless the build has developer tools enabled.
   *
   * Declared here rather than as a key list in sidebar-nav.tsx so the decision
   * sits beside the item it describes and cannot drift away from it. The
   * filter that reads it calls isDevToolsEnabled() from
   * src/lib/features/dev-tools.ts; a nav item is an array entry, so <DevOnly>
   * cannot wrap it.
   *
   * Hiding the item is only half the gate — each of these routes also refuses
   * server-side in its own page.tsx, the same division of labour Slice #22.01
   * set up between this filter and src/app/admin/layout.tsx.
   */
  devOnly?: boolean;
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
    // Plain direct link (Slice #18.18): dedicated Natural Persons list.
    key: "naturalPeople",
    icon: User,
    href: "/natural-persons",
    items: [],
  },
  {
    // Plain direct link (Slice #18.18): dedicated Judicial Persons list.
    key: "judicialPeople",
    icon: Building2,
    href: "/judicial-persons",
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
    // Slice #22.05: the former single "Administration" accordion is now two
    // — "Administration Operations" (the day-to-day workflows: search,
    // import pipeline, road calculation) and "Administration Setup" (the
    // configuration/reference screens, below). Both stay gated by the exact
    // same superuser-only rule "administration" used — see the
    // isSuperuser filter in sidebar-nav.tsx and the server-side guard in
    // src/app/admin/layout.tsx (route-based, so it needs no change here).
    key: "administrationOperations",
    icon: LayoutDashboard,
    items: [
      { key: "globalSearch", href: "/admin/global-search", icon: Search },
      // "Pre-import verification" and "post-import report" don't have pages
      // yet — rendered as disabled "coming soon" placeholders (no href),
      // same convention the old "export" item used, until a future slice
      // builds them out.
      { key: "preImportVerification", icon: ClipboardCheck },
      { key: "import", href: "/admin/import", icon: Upload },
      { key: "postImportReport", icon: ClipboardList },
      { key: "calculation", href: "/admin/calculation", icon: Calculator },
    ],
  },
  {
    key: "administrationSetup",
    icon: Wrench,
    items: [
      { key: "users", href: "/admin/users", icon: UserCog },
      { key: "referenceData", href: "/admin/value-lists", icon: Database },
      // Slice #23.10.dev: both are developer surfaces. Help information
      // authors the Background/How-To copy the "?" buttons show; Settings
      // holds the time-frame thresholds and the developer options panel.
      // A business user configures neither.
      { key: "helpContent", href: "/admin/help-content", icon: HelpCircle, devOnly: true },
      { key: "settings", href: "/admin/settings", icon: Settings, devOnly: true },
    ],
  },
];
