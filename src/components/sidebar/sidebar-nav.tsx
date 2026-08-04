"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, KeyRound, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LocaleToggle } from "@/components/locale-toggle";
import { DevOnly } from "@/components/dev-only";
import { isDevToolsEnabled } from "@/lib/features/dev-tools";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { RecentlyViewedPanel } from "@/components/recently-viewed-panel";
import { clearRecentlyViewed } from "@/components/providers/navigation-history-provider";
import { NAV_SECTIONS, type NavItem, type NavSection } from "./nav-config";
import {
  getActiveHref,
  getActiveSectionKey,
} from "./sidebar-helpers";

// ---------------------------------------------------------------------------
// Click-guard helper — shared by every sidebar link (NavSubItem, change-
// password link). Lets modified clicks (ctrl/cmd/shift/alt, or a non-primary
// mouse button) fall through to the browser's default <Link> behaviour
// (e.g. opening in a new tab), and only intercepts plain left-clicks to
// route them through the unsaved-changes guard instead of navigating
// immediately.
// ---------------------------------------------------------------------------

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function fetchMe(): Promise<{ username: string; role: string; uatMode?: boolean }> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return { username: "", role: "user" };
  return res.json();
}

// ---------------------------------------------------------------------------
// NavSubItem — a single leaf link (or disabled placeholder)
// ---------------------------------------------------------------------------

function NavSubItem({
  item,
  isActive,
  label,
}: {
  item: NavItem;
  isActive: boolean;
  label: string;
}) {
  const Icon = item.icon;
  const base =
    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors";
  const { guardedNavigate } = useUnsavedChanges();

  if (!item.href) {
    return (
      <div
        className={`${base} text-fade cursor-not-allowed opacity-60`}
        aria-disabled="true"
      >
        <Icon size={14} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  const href = item.href;

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!isPlainLeftClick(e)) return;
        e.preventDefault();
        guardedNavigate(href);
      }}
      className={`${base} ${
        isActive
          ? "bg-slate-100 text-slate-700 font-medium dark:bg-slate-800 dark:text-slate-200"
          : "text-ink hover:bg-or-light"
      }`}
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// NavSectionRow — collapsible accordion section header + its sub-items
// ---------------------------------------------------------------------------

function NavSectionRow({
  section,
  isOpen,
  isCollapsed,
  activeHref,
  sectionLabel,
  itemLabels,
  onToggle,
  onExpandSidebar,
}: {
  section: NavSection;
  isOpen: boolean;
  isCollapsed: boolean;
  activeHref: string | null;
  sectionLabel: string;
  itemLabels: Record<string, string>;
  onToggle: () => void;
  onExpandSidebar: () => void;
}) {
  const SectionIcon = section.icon;
  const isSectionActive = section.items.some(
    (i) => i.href && i.href === activeHref,
  );

  return (
    <div>
      <button
        type="button"
        onClick={isCollapsed ? onExpandSidebar : onToggle}
        title={isCollapsed ? sectionLabel : undefined}
        aria-expanded={isCollapsed ? undefined : isOpen}
        className={[
          "w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isCollapsed ? "justify-center" : "justify-between",
          isSectionActive ? "text-slate-700 dark:text-slate-200" : "text-ink hover:bg-crease",
        ].join(" ")}
      >
        <span className={`flex items-center ${isCollapsed ? "" : "gap-2.5"}`}>
          <SectionIcon size={18} className="shrink-0" aria-hidden="true" />
          {!isCollapsed && <span>{sectionLabel}</span>}
        </span>
        {!isCollapsed && (
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {!isCollapsed && isOpen && (
        <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-wire flex flex-col gap-0.5">
          {section.items.map((item) => (
            <NavSubItem
              key={item.key}
              item={item}
              isActive={!!(item.href && item.href === activeHref)}
              label={itemLabels[item.key] ?? item.key}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavFlatSectionRow — a section header that is itself a direct link
// ---------------------------------------------------------------------------
//
// Used for sections with no expandable children — "document" (Slice #15.08),
// "people" (Slice #15.09), and "propertyList"/"propertyMap" (Slice #15.09.2):
// no chevron, no accordion toggle — clicking it navigates straight to its
// href, same single-click behaviour as any other page link, just rendered
// with the larger section-header styling/icon size.

function NavFlatSectionRow({
  section,
  isActive,
  isCollapsed,
  sectionLabel,
  onNavigate,
}: {
  section: NavSection;
  isActive: boolean;
  isCollapsed: boolean;
  sectionLabel: string;
  onNavigate: (href: string) => void;
}) {
  const SectionIcon = section.icon;
  const href = section.href!;

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!isPlainLeftClick(e)) return;
        e.preventDefault();
        onNavigate(href);
      }}
      title={isCollapsed ? sectionLabel : undefined}
      className={[
        "w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isCollapsed ? "justify-center" : "justify-between",
        isActive ? "text-slate-700 dark:text-slate-200" : "text-ink hover:bg-crease",
      ].join(" ")}
    >
      <span className={`flex items-center ${isCollapsed ? "" : "gap-2.5"}`}>
        <SectionIcon size={18} className="shrink-0" aria-hidden="true" />
        {!isCollapsed && <span>{sectionLabel}</span>}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SidebarNav — main export
// ---------------------------------------------------------------------------

export function SidebarNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router   = useRouter();
  const { guardedAction, guardedNavigate } = useUnsavedChanges();

  // ── Auth — username + role for sidebar display ────────────────────────────
  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000, // 5 min — re-fetch in background
  });
  const isSuperuser = me?.role === "superuser";
  // UAT mode (Ciprian's local box) has no real Supabase session — hide the
  // Sign Out / Change Password controls, which would otherwise dead-end at
  // a login screen that can't actually authenticate anyone there.
  const isUatMode = me?.uatMode === true;
  // Slice #23.10.dev. Read as a value here because the nav filter below works
  // on an ARRAY of items, where <DevOnly> cannot reach; the locale toggle in
  // the header is JSX and uses the wrapper instead. Both resolve to the same
  // predicate in src/lib/features/dev-tools.ts.
  const devTools = isDevToolsEnabled();

  function handleLogout() {
    guardedAction(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      clearRecentlyViewed();
      router.push("/login");
      router.refresh();
    });
  }

  // ── Quick-search ──────────────────────────────────────────────────────────
  const [quickSearch, setQuickSearch] = useState("");

  function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = quickSearch.trim();
    if (!q) return;
    setQuickSearch("");
    guardedNavigate(`/admin/global-search?search=${encodeURIComponent(q)}`);
  }

  // ── Collapsed state — persisted in localStorage ───────────────────────────
  // Lazy initializer reads localStorage on the client; returns false on the
  // server (SSR). suppressHydrationWarning on <aside> handles the potential
  // mismatch when the stored value differs from the SSR default.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("sidebar-collapsed");
    return stored !== null ? stored === "true" : false;
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
    localStorage.setItem("sidebar-collapsed", "false");
  }, []);

  // ── Accordion state ───────────────────────────────────────────────────────
  // Flat-link sections (no children, see NavFlatSectionRow — "document" since
  // Slice #15.08, "people" since Slice #15.09) have no accordion-open state
  // to track — getActiveSectionKey only needs to resolve sections that
  // actually have expandable items.
  const activeSectionKey = useMemo(
    () => getActiveSectionKey(pathname, NAV_SECTIONS),
    [pathname],
  );

  // A flat-link section highlights as active for its list page and any of
  // its detail/sub-pages, independent of the accordion-driven
  // activeSectionKey above.
  const FLAT_SECTION_ACTIVE_PREFIXES: Record<string, string[]> = {
    document: ["/documents"],
    naturalPeople: ["/natural-persons"],
    judicialPeople: ["/judicial-persons"],
    propertyMap: ["/properties/map"],
  };
  function isFlatSectionActive(key: string): boolean {
    // "propertyList" and "propertyMap" share the /properties prefix (the map
    // route is nested under it: /properties/map). Check propertyMap's own
    // prefix first and exclude it from propertyList's match so a visit to
    // the map page doesn't light up both buttons at once.
    if (key === "propertyList") {
      return (
        (pathname === "/properties" || pathname.startsWith("/properties/")) &&
        !isFlatSectionActive("propertyMap")
      );
    }
    const prefixes = FLAT_SECTION_ACTIVE_PREFIXES[key] ?? [];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }

  // Single-open accordion — at most one section is open at a time.
  const [openSection, setOpenSection] = useState<string | null>(
    activeSectionKey ?? null,
  );

  // When the user navigates, open the section that owns the active item.
  // React's recommended "derived state during render" pattern — avoids the
  // synchronous setState-in-effect antipattern (react-hooks/set-state-in-effect).
  const [prevActiveSectionKey, setPrevActiveSectionKey] = useState(activeSectionKey);
  if (prevActiveSectionKey !== activeSectionKey && activeSectionKey) {
    setPrevActiveSectionKey(activeSectionKey);
    setOpenSection(activeSectionKey);
  }

  const toggleSection = useCallback((key: string) => {
    setOpenSection((prev) => (prev === key ? null : key));
  }, []);

  const activeHref = useMemo(
    () => getActiveHref(pathname, NAV_SECTIONS),
    [pathname],
  );

  // ── i18n label maps (explicit keys — required for next-intl type safety) ──
  const sectionLabels: Record<string, string> = {
    naturalPeople: t("sections.naturalPeople"),
    judicialPeople: t("sections.judicialPeople"),
    propertyList: t("sections.propertyList"),
    propertyMap: t("sections.propertyMap"),
    document: t("sections.document"),
    // Slice #22.05: the former single "administration" section is now two —
    // see nav-config.ts.
    administrationOperations: t("sections.administrationOperations"),
    administrationSetup: t("sections.administrationSetup"),
  };

  const itemLabels: Record<string, string> = {
    users:                     t("items.users"),
    referenceData:             t("items.referenceData"),
    import:                    t("items.import"),
    preImportVerification:     t("items.preImportVerification"),
    postImportReport:          t("items.postImportReport"),
    calculation:               t("items.calculation"),
    globalSearch:              t("items.globalSearch"),
    helpContent:               t("items.helpContent"),
    settings:                  t("items.settings"),
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside
      suppressHydrationWarning
      className={[
        "flex flex-col bg-card border-r border-wire shrink-0",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        isCollapsed ? "w-14" : "w-56",
      ].join(" ")}
    >
      {/* ── App name + locale toggle + collapse button ────────────────── */}
      <div
        className={[
          "flex items-center h-14 px-3 border-b border-wire shrink-0",
          isCollapsed ? "justify-center" : "justify-between",
        ].join(" ")}
      >
        {!isCollapsed && (
          <span className="text-sm font-bold tracking-tight text-ink select-none">
            GA40
          </span>
        )}
        {/* Slice #23.10.dev — the EN/RO flags are back, exactly where Slice
            #20.10 took them from (the header comment above never stopped
            claiming they were here), but now only on a developer build.
            #20.10 replaced them with a "Use English language" checkbox on the
            Settings page; that checkbox is gone again in this slice, because
            Settings is itself dev-only now and a Romanian user must never have
            a control that can put the whole UI into English.

            Collapsed sidebars still hide them: two flags do not fit a 3rem
            rail, which is why the original carried the same !isCollapsed. */}
        <DevOnly>{!isCollapsed && <LocaleToggle />}</DevOnly>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-md p-1.5 text-fade hover:bg-crease transition-colors"
          aria-label={isCollapsed ? t("expand") : t("collapse")}
          title={isCollapsed ? t("expand") : t("collapse")}
        >
          {isCollapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </button>
      </div>


      {/* ── Logged-in username (expanded mode; hidden in UAT mode) ──────── */}
      {!isCollapsed && !isUatMode && me?.username && (
        <div className="px-4 py-1.5 text-xs text-fade truncate border-b border-wire">
          {t("signedInAs")} <span className="font-medium text-ink">{me.username}</span>
        </div>
      )}

      {/* ── Quick-search bar (expanded mode) ───────────────────────────── */}
      {!isCollapsed && (
        <form
          onSubmit={handleQuickSearch}
          className="px-2 py-2 border-b border-wire shrink-0"
          aria-label={t("quickSearch")}
        >
          <div className="flex items-center gap-1.5 rounded-md border border-wire bg-card px-2 py-1.5 focus-within:border-slate-400 dark:focus-within:border-slate-500 transition-colors">
            <Search size={12} className="shrink-0 text-fade" aria-hidden="true" />
            <input
              type="search"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder={t("quickSearchPlaceholder")}
              className="flex-1 min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-fade"
              aria-label={t("quickSearch")}
            />
          </div>
        </form>
      )}

      {/* ── Nav sections ───────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5"
        aria-label="Main navigation"
      >
        {NAV_SECTIONS
          // Slice #22.01 (extended by #22.05's Operations/Setup split): BOTH
          // "administrationOperations" and "administrationSetup" sections are
          // superuser-only — matched by prefix so this doesn't need updating
          // again if the split changes further. Previously only the "users"
          // item was filtered out for regular users, leaving Reference Data /
          // Import / Calculation / Global Search / Help Content / Settings
          // reachable by anyone. The server-side guard at
          // src/app/admin/layout.tsx enforces the same rule for direct
          // navigation / deep links.
          .filter((section) => !section.key.startsWith("administration") || isSuperuser)
          // Slice #21.11.uat.auth: Users & Access approves Supabase Auth
          // sign-up requests through the Admin API, which does not exist on a
          // UAT box with no Supabase project. Strip the item there rather than
          // let it dead-end — the same reasoning as hiding Sign Out / Change
          // Password below. The server-side guard in
          // src/app/admin/users/page.tsx still catches a hand-typed URL.
          .map((section) =>
            isUatMode && section.items.some((i) => i.key === "users")
              ? { ...section, items: section.items.filter((i) => i.key !== "users") }
              : section,
          )
          // Slice #23.10.dev: strip items marked devOnly in nav-config.ts
          // (Help information, Settings) on a build without developer tools.
          // Unconditional map rather than a guarded one so the common case —
          // a dev build, where nothing is stripped — still produces the same
          // section objects and this stays one readable step in the chain.
          .map((section) =>
            section.items.some((i) => i.devOnly) && !devTools
              ? { ...section, items: section.items.filter((i) => !i.devOnly) }
              : section,
          )
          .map((section) => {
            // Flat-link sections are identified structurally (no items, has a
            // direct href) rather than by a hardcoded key list — "document"
            // (Slice #15.08), "people" (Slice #15.09), and "propertyList" /
            // "propertyMap" (Slice #15.09.2) all qualify.
            const isFlatLinkSection =
              section.items.length === 0 && !!section.href;

            return isFlatLinkSection ? (
              <NavFlatSectionRow
                key={section.key}
                section={section}
                isActive={isFlatSectionActive(section.key)}
                isCollapsed={isCollapsed}
                sectionLabel={sectionLabels[section.key] ?? section.key}
                onNavigate={guardedNavigate}
              />
            ) : (
              <NavSectionRow
                key={section.key}
                section={section}
                isOpen={openSection === section.key}
                isCollapsed={isCollapsed}
                activeHref={activeHref}
                sectionLabel={sectionLabels[section.key] ?? section.key}
                itemLabels={itemLabels}
                onToggle={() => toggleSection(section.key)}
                onExpandSidebar={expandSidebar}
              />
            );
          })}
      </nav>

      {/* ── Recently viewed — Slice #20.17 ────────────────────────────────── */}
      <RecentlyViewedPanel isCollapsed={isCollapsed} />

      {/* ── Bottom strip — change password + logout (hidden in UAT mode, */}
      {/*    which has no real Supabase session to change or sign out of) */}
      {!isUatMode && (
        <div
          className={[
            "border-t border-wire shrink-0 px-2 py-2 flex flex-col gap-0.5",
          ].join(" ")}
        >
          <Link
            href="/account/change-password"
            onClick={(e) => {
              if (!isPlainLeftClick(e)) return;
              e.preventDefault();
              guardedNavigate("/account/change-password");
            }}
            title={t("changePassword")}
            className={[
              "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-fade hover:bg-crease hover:text-ink transition-colors",
              isCollapsed ? "justify-center" : "",
            ].join(" ")}
          >
            <KeyRound size={14} className="shrink-0" aria-hidden="true" />
            {!isCollapsed && <span className="truncate">{t("changePassword")}</span>}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title={t("signOut")}
            className={[
              "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-fade hover:bg-crease hover:text-ink transition-colors w-full",
              isCollapsed ? "justify-center" : "",
            ].join(" ")}
          >
            <LogOut size={14} className="shrink-0" aria-hidden="true" />
            {!isCollapsed && <span className="truncate">{t("signOut")}</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
