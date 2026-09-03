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
  ClipboardList,
  Wrench,
  Settings,
  HelpCircle,
  Calculator,
  Search,
  Lightbulb,
  Users,
  Stamp,
  Tags,
} from "lucide-react";

export type NavItem = {
  key: string;
  href?: string;  // undefined = coming soon (rendered disabled)
  icon: LucideIcon;
  // Slice #32.19 removed the `devOnly` field that used to sit here. Adrian
  // asked for the developer-only screen items to be revealed, so Help
  // information and Settings are ordinary Admin-Setup entries now and nothing
  // in this file is gated by the build flag. Both routes also dropped the
  // matching server-side redirect in their own page.tsx in the same commit —
  // a nav entry whose route still refuses is a dead link, which is the shape
  // Groups/Stamps/Tags were in before this slice.
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
      // "Post-import report" doesn't have a page yet — rendered as a disabled
      // "coming soon" placeholder (no href), same convention the old "export"
      // item used, until a future slice builds it out.
      //
      // Slice #24.02a removed the "pre-import verification" placeholder that
      // used to sit above /admin/import. Verification is not a screen you can
      // visit beside the import; it IS the import's first phase, and a second
      // nav entry would have been a second door to a picker that must have
      // exactly one.
      //
      // ⚠️ **Slice #29.09 adds a SECOND folder picker to this section, and it
      // does not break the rule above — but only because that rule is about the
      // IMPORT.** „Distilare Tipizate" picks a folder of sample documents,
      // reads them, and writes `template_fields` onto one document type. It
      // imports nothing: no `document` row is created, no page is uploaded,
      // nothing reaches the archive, and there is no path from it into the
      // import. The thing #24.02a forbade was a second DOOR TO THE IMPORT'S OWN
      // PICKER — a user who could start the same run from two places. This is a
      // different run with a different output, and the import's stop screen
      // (#29.08's `typesBlocked.whatNext`) is what sends people to it. Said
      // here because the comment above, left alone, reads as forbidding this
      // entry.
      { key: "import", href: "/admin/import", icon: Upload },
      { key: "docTypeEngine", href: "/admin/doc-type-engine", icon: Lightbulb },
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
      // ⚠️ **Slice #32.19: these three pages existed for slices and appeared in
      // NO nav at all.** Item 17 of the 32.11 report read their absence as a
      // consequence of Settings being developer-only, and that was wrong twice
      // over: /admin/groups, /admin/stamps and /admin/tags carry no dev-tools
      // guard of their own, and they were never listed here, so removing the
      // `devOnly` flags reveals Help information and Settings and does nothing
      // whatever for them. Typing the URL was the only way in; Settings' own
      // "Related screens" links were the only pointer to them.
      //
      // They sit in "administrationSetup" rather than Operations because each
      // one configures a vocabulary the rest of the archive then uses. The
      // superuser gate they need is the one this section already has —
      // sidebar-nav.tsx filters every key starting "administration", and
      // src/app/admin/layout.tsx redirects the same set server-side — so a
      // non-superuser sees neither these entries nor the routes behind them,
      // and no per-item role field was added.
      { key: "groups", href: "/admin/groups", icon: Users },
      { key: "stamps", href: "/admin/stamps", icon: Stamp },
      { key: "tags", href: "/admin/tags", icon: Tags },
      // Slice #23.10.dev made these two developer-only; Slice #32.19 took that
      // back at Adrian's request. Help information authors the Background/
      // How-To copy the "?" buttons show; Settings holds the time-frame
      // thresholds and the developer options panel.
      { key: "helpContent", href: "/admin/help-content", icon: HelpCircle },
      { key: "settings", href: "/admin/settings", icon: Settings },
    ],
  },
];
