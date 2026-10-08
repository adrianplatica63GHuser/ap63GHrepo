import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  BookOpen,
  BookOpenText,
  Building2,
  Calculator,
  ClipboardCheck,
  Construction,
  Database,
  FileText,
  FileUp,
  FolderInput,
  Folders,
  GitCompareArrows,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  Map,
  Network,
  Search,
  Settings,
  ShieldCheck,
  Stamp,
  Tags,
  Trophy,
  Upload,
  User,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";

export type NavItem = {
  key: string;
  // Undefined = not built yet. Since Slice #38.42 such an item draws NOTHING
  // (`drawnSections`, sidebar-helpers.ts); giving it an href brings it back.
  href?: string;
  icon: LucideIcon;
  // Slice #38.42: a screen that exists but is a „work in progress" page — drawn
  // nothing, like an item with no href, until the flag goes. Its URL still opens.
  wip?: true;
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
  // „Tablou de bord" and „Setări".
  href?: string;
};

/**
 * THE LEFT NAVIGATION IN NINE SECTIONS — SIX OF THEM DRAWN.     (Slice #38.20, #38.42)
 *
 * Slice #38.42: what is not built is not drawn. An item with no `href`, or one
 * marked `wip`, draws nothing, and a section left with nothing to draw draws
 * nothing either (`drawnSections`, sidebar-helpers.ts) — so „Rapoarte",
 * „Studiu" and „Ajutor" are gone from the sidebar, and „Verificare corelări",
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
      { key: "naturalPeople", href: "/natural-persons", icon: User },
      { key: "judicialPeople", href: "/judicial-persons", icon: Building2 },
      // Slice #37.92: ONE property item, with the map's icon; the whole map
      // (/properties/map) opens from the list, and this item is active there.
      { key: "propertyList", href: "/properties", icon: Map },
      { key: "document", href: "/documents", icon: FileText },
    ],
  },
  {
    // What the archive can work out: search, reading sample documents into a
    // type's form (#29.09 — it imports nothing), the road calculation.
    key: "functions",
    icon: Workflow,
    items: [
      { key: "globalSearch", href: "/admin/global-search", icon: Search },
      { key: "docTypeEngine", href: "/admin/doc-type-engine", icon: Lightbulb },
      { key: "checkCorrelations", icon: GitCompareArrows },
      { key: "calculation", href: "/admin/calculation", icon: Calculator },
      { key: "inheritanceTrees", icon: Network },
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
    key: "reports",
    icon: BarChart3,
    // Slice #38.42 (Ask first 1): its one item is a placeholder page, so it is hidden too.
    items: [{ key: "reportsInProgress", href: "/reports", icon: Construction, wip: true }],
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
      // It edits the texts the „?" buttons show (#38.20's Ask first 1).
      { key: "helpContent", href: "/admin/help-content", icon: HelpCircle },
    ],
  },
  {
    key: "settings",
    icon: Settings,
    href: "/admin/settings",
    items: [],
  },
  {
    key: "study",
    icon: GraduationCap,
    items: [
      { key: "courses", icon: BookOpenText },
      { key: "quizzes", icon: ClipboardCheck },
      { key: "score", icon: Trophy },
    ],
  },
  {
    key: "helpSection",
    icon: LifeBuoy,
    items: [
      { key: "userManual", icon: BookOpen },
      { key: "askAi", icon: Bot },
    ],
  },
];
