import type { LucideIcon } from "lucide-react";
import { ENTITY_ICON } from "@/lib/ui/entity-icon";
import {
  BarChart3,
  BookOpen,
  BookOpenText,
  Waypoints,
  MessageCircleQuestion,
  Calculator,
  Database,
  FileUp,
  FolderInput,
  Folders,
  GitCompareArrows,
  Group,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  MessagesSquare,
  Navigation,
  Network,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Stamp,
  Tags,
  Upload,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";

/** Slice #39.78: the three guides to the big map's buttons, under „Instrumente". */
export type MapGuideKey = "measure" | "groups" | "navigation";

export type NavItem = {
  key: string;
  // Undefined = not built yet. Since Slice #38.42 such an item draws NOTHING
  // (`drawnSections`, sidebar-helpers.ts); giving it an href brings it back.
  href?: string;
  icon: LucideIcon;
  // Slice #38.42: a screen that exists but is a „work in progress" page — drawn
  // nothing, like an item with no href, until the flag goes. Its URL still opens.
  wip?: true;
  // Slice #39.78: not a screen but a box about some of the big map's buttons (map-guide-dialog.tsx). Such an item
  // has no href, and is drawn: pressing it opens the box, whose OK may then open the map.
  guide?: MapGuideKey;
  // Slice #32.19 removed the `devOnly` field that used to sit here. Adrian
  // asked for the developer-only screen items to be revealed, so Help
  // information and Settings are ordinary entries now and nothing in this
  // file is gated by the build flag.
};

export type NavSection = {
  key: string;
  icon: LucideIcon;
  items: NavItem[];
  // When set (and items is empty), the section header itself is a direct
  // link — no accordion/chevron, no expandable children. Since #38.20:
  // „Tablou de bord" (and „Setări" until Slice 40.08 made it an item of „Administrare").
  href?: string;
};

/**
 * THE LEFT NAVIGATION IN SEVEN SECTIONS, ALL DRAWN.  (Slice #38.20, #38.42, #39.02, #39.37, 40.08)
 *
 * Slice 40.08: „Setări" is the last item of „Administrare" (Adrian, 2026-10-20: „settings from the left navigation
 * panel must be under administration - the last item under administration"), no longer a section of its own; its
 * URL, /admin/settings, did not move, and who sees it did not change (`USER_HREFS` still does not list it).
 *
 * Slice #39.37: „Ajutor și învățare" replaces the two placeholders „Studiu" and „Ajutor" at the bottom,
 * holding „Informații de ajutor" (from „Administrare", its URL unchanged) and „Manual de utilizare".
 *
 * Slice #39.02: „Rapoarte" is drawn again, between „Import" and „Administrare",
 * holding „Interacțiuni" and „Căutare globală" (and, from #39.11, „Arbori de
 * moștenire"). Their URLs did not move.
 *
 * Slice #38.42: what is not built is not drawn. An item with no `href`, or one
 * marked `wip`, draws nothing, and a section left with nothing to draw draws
 * nothing either (`drawnSections`, sidebar-helpers.ts) — so „Rapoarte" (until
 * #39.02), „Studiu" and „Ajutor" are gone from the sidebar, and „Verificare corelări",
 * „Arbori de moștenire", „Dosare diverse" and „Fișier individual" from their
 * sections. The entries stay here: an href brings one back. „Date de
 * referință" moved from Domeniu to Administrare (it is configuration, not
 * records), and „Funcții" is called „Instrumente" (the key is unchanged).
 *
 * What #38.20 wrote, still true of the config:
 *
 * Top to bottom: Tablou de bord, Domeniu, Funcții, Import, Rapoarte,
 * Administrare, Setări, Studiu, Ajutor. Every screen that exists is reachable
 * from it; an item whose screen does not exist yet has no `href` and is drawn
 * disabled, „În curând" as its tooltip (#38.20's Ask first 3). An item moved,
 * its URL did not. Each section has its own icon — a collapsed sidebar shows
 * section icons only (#37.42).
 *
 * „Informații de ajutor" is the last item of „Administrare" (Ask first 1).
 * „Raport post-import", a placeholder with no screen, is gone; when it is
 * built, its place is under „Rapoarte" (Ask first 2).
 *
 * WHO SEES WHAT — since #38.21 every account with an app_users row sees all of
 * it (`hasFullAccess`); one without a row sees the dashboard and the four lists
 * (`USER_HREFS`, sidebar-helpers.ts), as a `user` did before. The server-side
 * guard on /admin/* (src/app/admin/layout.tsx) asks the same predicate.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    // The home page is the dashboard (#22.01).
    key: "dashboard",
    icon: LayoutDashboard,
    href: "/",
    items: [],
  },
  {
    // The archive's own records, and the lists they are described with.
    key: "domain",
    icon: Database,
    items: [
      { key: "naturalPeople", href: "/natural-persons", icon: ENTITY_ICON.natural }, // 40.61: the kinds' one mark
      { key: "judicialPeople", href: "/judicial-persons", icon: ENTITY_ICON.judicial },
      // Slice #37.92: ONE property item, with the map's icon; the whole map
      // (/properties/map) opens from the list, and this item is active there.
      { key: "propertyList", href: "/properties", icon: ENTITY_ICON.property },
      { key: "document", href: "/documents", icon: ENTITY_ICON.document },
      // Slice #39.02: „Interacțiuni" (#38.84) moved to „Rapoarte"; its URL did not.
    ],
  },
  {
    // What the archive can work out: reading sample documents into a type's
    // form (#29.09 — it imports nothing), the road calculation. Slice #39.02:
    // „Căutare globală" and „Arbori de moștenire" moved to „Rapoarte".
    key: "functions",
    icon: Workflow,
    items: [
      { key: "docTypeEngine", href: "/admin/doc-type-engine", icon: Lightbulb },
      { key: "checkCorrelations", icon: GitCompareArrows },
      { key: "calculation", href: "/admin/calculation", icon: Calculator },
      // Slice #39.78: „Calcul suprafață" (#39.09, /properties/map?area=1 — the address still works) gave way to three
      // guides to the big map's buttons: each opens a box, and the first two's OK opens the map with them pulsing.
      { key: "mapMeasurements", guide: "measure", icon: Ruler },
      { key: "mapGroupings", guide: "groups", icon: Group },
      { key: "mapNavigation", guide: "navigation", icon: Navigation },
    ],
  },
  {
    // ⚠️ One door to the import's own picker (#24.02a): „Dosare de
    // proprietăți" is today's /admin/import wizard. The two others are
    // placeholders for imports that do not exist yet.
    key: "importSection",
    icon: Upload,
    items: [
      { key: "import", href: "/admin/import", icon: FolderInput },
      { key: "miscFolders", icon: Folders },
      { key: "singleFile", icon: FileUp },
    ],
  },
  {
    // Slice #39.02: what the archive reports — the log of contacts (from
    // „Domeniu"), the inheritance trees and the global search (from
    // „Instrumente"), in that order. Each moved item kept its URL (#38.20).
    // „Arbori de moștenire" has no screen until #39.11, so it draws nothing yet.
    // The „În lucru" item (#38.42) left the config: /reports still opens by its
    // address, unlinked, until a report replaces it (#39.02's Ask first 2).
    key: "reports",
    icon: BarChart3,
    items: [
      { key: "interactions", href: "/interactions", icon: MessagesSquare },
      // Slice #39.11: the whole tree (A) — every natural person with a family tie, the whole page.
      { key: "inheritanceTrees", href: "/inheritance-tree", icon: Network },
      { key: "globalSearch", href: "/admin/global-search", icon: Search },
    ],
  },
  {
    key: "administration",
    icon: ShieldCheck,
    items: [
      // Slice #38.42: „Date de referință" moved here from Domeniu — configuration, not records.
      { key: "referenceData", href: "/admin/value-lists", icon: BookOpen },
      { key: "users", href: "/admin/users", icon: UserCog },
      { key: "groups", href: "/admin/groups", icon: Users },
      { key: "stamps", href: "/admin/stamps", icon: Stamp },
      { key: "tags", href: "/admin/tags", icon: Tags },
      // Slice #39.37: „Informații de ajutor" moved to „Ajutor și învățare", its URL unchanged.
      // Slice 40.08: „Setări", last — a section of its own (a flat link) until then; its URL unchanged.
      { key: "settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    // Slice #39.37: „Ajutor și învățare" — the help, the manual and (#39.42) the skills map with its quizzes,
    // in one section at the bottom, where the two placeholders „Studiu" and „Ajutor" stood (Ask first 1).
    // „Harta competențelor" joins in #39.42 and „Întreabă" in #39.45; an item with no screen draws nothing.
    key: "helpLearning",
    icon: LifeBuoy,
    items: [
      // It edits the texts the „?" buttons show (#38.20's Ask first 1). Moved here from „Administrare".
      { key: "helpContent", href: "/admin/help-content", icon: HelpCircle },
      { key: "userManual", href: "/manual", icon: BookOpenText },
      // Slice #39.42: „Harta competențelor” — the skills diagram; an Open box opens its quiz.
      { key: "skillsMap", href: "/skills-map", icon: Waypoints },
      // Slice #39.45: „Întreabă” — a question in plain words, answered from the manual (Ask first 3).
      { key: "ask", href: "/ask", icon: MessageCircleQuestion },
    ],
  },
];

/** Slice 40.37: the four principal lists, by their „Domeniu" item's key. */
export type DomainListKey = "naturalPeople" | "judicialPeople" | "propertyList" | "document";

/**
 * Slice 40.37: a principal list's icon — the one its „Domeniu" item draws in the sidebar. Read from NAV_SECTIONS rather
 * than imported a second time, so the list's „+ Nou" and the sidebar cannot drift apart (40.37's Ask first 2).
 */
export function domainIcon(key: DomainListKey): LucideIcon {
  const item = NAV_SECTIONS.find((s) => s.key === "domain")?.items.find((i) => i.key === key);
  if (!item) throw new Error(`nav-config: no „Domeniu" item ${key}`);
  return item.icon;
}
