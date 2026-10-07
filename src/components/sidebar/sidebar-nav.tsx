"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, KeyRound, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { IconButton, IconTooltip } from "@/lib/ui/icon-button";
import { createClient } from "@/lib/supabase/client";
import { LocaleToggle } from "@/components/locale-toggle";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { RecentlyViewedPanel } from "@/components/recently-viewed-panel";
import { clearRecentlyViewed } from "@/components/providers/navigation-history-provider";
import {
  AUTH_ME_QUERY_KEY,
  AUTH_ME_STALE_TIME_MS,
  clearSessionCache,
  fetchMe,
} from "@/lib/auth/me-query";
import { NAV_SECTIONS, type NavItem, type NavSection } from "./nav-config";
import {
  getActiveHref,
  getActiveSectionKey,
  isFlatSectionActive as flatActive,
  sectionsFor,
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
// NavSubItem — a single leaf link (or disabled placeholder)
// ---------------------------------------------------------------------------

function NavSubItem({
  item,
  isActive,
  label,
  comingSoon,
}: {
  item: NavItem;
  isActive: boolean;
  label: string;
  /** Slice #38.20: a placeholder's tooltip, „În curând". */
  comingSoon: string;
}) {
  const Icon = item.icon;
  const base =
    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors";
  const { guardedNavigate } = useUnsavedChanges();

  if (!item.href) {
    // Slice #38.20: a screen that does not exist yet — drawn disabled, „În curând" as its
    // tooltip (on hover and on keyboard focus), so the items Adrian listed are seen.
    return (
      <IconTooltip label={comingSoon} fill>
        <div
          className={`${base} w-full text-fade cursor-not-allowed opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
          aria-disabled="true"
          tabIndex={0}
          data-nav-placeholder={item.key}
        >
          <Icon size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </div>
      </IconTooltip>
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
      // Slice #38.20: the active item says so, not only by its colour (as #37.92's flat link did).
      aria-current={isActive ? "page" : undefined}
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
  comingSoon,
  onToggle,
  onExpandSidebar,
}: {
  section: NavSection;
  isOpen: boolean;
  isCollapsed: boolean;
  activeHref: string | null;
  sectionLabel: string;
  itemLabels: Record<string, string>;
  comingSoon: string;
  onToggle: () => void;
  onExpandSidebar: () => void;
}) {
  const SectionIcon = section.icon;
  const isSectionActive = section.items.some(
    (i) => i.href && i.href === activeHref,
  );

  const row = (
      <button
        type="button"
        onClick={isCollapsed ? onExpandSidebar : onToggle}
        // #37.42 (A001): collapsed, the row is its icon alone — its name is the
        // section's, and the shared tooltip shows it (no `title` any more).
        aria-label={isCollapsed ? sectionLabel : undefined}
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
  );

  return (
    <div>
      {isCollapsed ? <IconTooltip label={sectionLabel} fill>{row}</IconTooltip> : row}

      {!isCollapsed && isOpen && (
        <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-wire flex flex-col gap-0.5">
          {section.items.map((item) => (
            <NavSubItem
              key={item.key}
              item={item}
              isActive={!!(item.href && item.href === activeHref)}
              label={itemLabels[item.key] ?? item.key}
              comingSoon={comingSoon}
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
// "people" (Slice #15.09), and "propertyList" (Slice #15.09.2):
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

  const row = (
    <Link
      href={href}
      onClick={(e) => {
        if (!isPlainLeftClick(e)) return;
        e.preventDefault();
        onNavigate(href);
      }}
      // #37.42 (A001): collapsed, the name is the section's and the shared
      // tooltip shows it.
      aria-label={isCollapsed ? sectionLabel : undefined}
      // Slice #37.92: the active item says so, not only by its colour — the
      // one „Proprietăți" is active on the whole map too.
      aria-current={isActive ? "page" : undefined}
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

  return isCollapsed ? <IconTooltip label={sectionLabel} fill>{row}</IconTooltip> : row;
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
  // Slice #37.01: `fetchMe` throws on an answer that is not ok, so a 401 or a
  // 500 is a failed, retried query with no role — never a cached `user`. While
  // the answer is unknown `fullAccess` is false. `@/lib/auth/me-query` says why.
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: AUTH_ME_STALE_TIME_MS, // re-fetch in background
  });
  // Slice #38.21: one kind of user — every account with an app_users row has the whole
  // application (`hasFullAccess` on the server); only an account without one sees less.
  const fullAccess = me?.fullAccess === true;
  // Slice #38.20: what this account's sidebar shows — everything with full access; for an
  // account without an app_users row the dashboard and the four lists (`USER_HREFS`).
  const sections = useMemo(() => sectionsFor(NAV_SECTIONS, fullAccess), [fullAccess]);
  // UAT mode (Ciprian's local box) has no real Supabase session — hide the
  // Sign Out / Change Password controls, which would otherwise dead-end at
  // a login screen that can't actually authenticate anyone there.
  const isUatMode = me?.uatMode === true;
  // Slice #32.19 removed `const devTools = isDevToolsEnabled()` from here along
  // with the nav filter that was its only reader. The locale toggle further
  // down still uses <DevOnly>, which reaches the same predicate through the
  // wrapper — so this component no longer imports the predicate itself.
  //
  // ⚠️ Nothing in the verification sequence would have reported the leftover:
  // @typescript-eslint/no-unused-vars is "warn" (eslint.config.mjs), `npm run
  // lint` passes no --max-warnings so it exits 0, tsconfig sets no
  // noUnusedLocals, and this Next version no longer runs ESLint during `next
  // build`. The constant and its import went in the same commit as the filter.

  function handleLogout() {
    guardedAction(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      clearRecentlyViewed();
      // Slice #37.01: nothing this account's session fetched — its role, its
      // lists, its records — may be shown to whoever signs in next.
      clearSessionCache(queryClient);
      router.push("/login");
      router.refresh();
    });
  }

  // ── Quick-search ──────────────────────────────────────────────────────────
  const [quickSearch, setQuickSearch] = useState("");

  // Slice #37.38's „Proprietăți — Hartă", which opened the map on the
  // Property whose form was open, left the sidebar in Slice #37.92 (FU-306):
  // the whole map opens from the list's „Hartă completă" now.

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
  // Slice #38.20: the flat sections are „Tablou de bord" (/ alone) and „Setări". The four lists
  // are items of „Domeniu" now; „Proprietăți" stays active on every /properties page — the map's
  // included (#37.92) — by the item's own prefix match.
  function isFlatSectionActive(section: NavSection): boolean {
    return flatActive(section, pathname);
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
  // Slice #38.20: the nine sections (nav-config.ts).
  const sectionLabels: Record<string, string> = {
    dashboard:      t("sections.dashboard"),
    domain:         t("sections.domain"),
    functions:      t("sections.functions"),
    importSection:  t("sections.importSection"),
    reports:        t("sections.reports"),
    administration: t("sections.administration"),
    settings:       t("sections.settings"),
    study:          t("sections.study"),
    helpSection:    t("sections.helpSection"),
  };

  const itemLabels: Record<string, string> = {
    // Slice #38.20: the four lists are items of „Domeniu".
    naturalPeople:             t("items.naturalPeople"),
    judicialPeople:            t("items.judicialPeople"),
    propertyList:              t("items.propertyList"),
    document:                  t("items.document"),
    users:                     t("items.users"),
    referenceData:             t("items.referenceData"),
    import:                    t("items.import"),
    // Slice #29.09. ⚠️ This map is not derived from NAV_SECTIONS: an item added
    // to nav-config without a line here renders its raw key in the sidebar, in
    // both languages, with no tsc error and no lint error. It used to say
    // "and nothing tests that the two agree"; since Slice #32.19 something
    // does — src/__tests__/sidebar-nav-items.test.ts — which is what that
    // sentence was asking for.
    docTypeEngine:             t("items.docTypeEngine"),
    calculation:               t("items.calculation"),
    // Slice #38.20 — the new items; those with no href are placeholders.
    checkCorrelations:         t("items.checkCorrelations"),
    inheritanceTrees:          t("items.inheritanceTrees"),
    miscFolders:               t("items.miscFolders"),
    singleFile:                t("items.singleFile"),
    reportsInProgress:         t("items.reportsInProgress"),
    courses:                   t("items.courses"),
    quizzes:                   t("items.quizzes"),
    score:                     t("items.score"),
    userManual:                t("items.userManual"),
    askAi:                     t("items.askAi"),
    globalSearch:              t("items.globalSearch"),
    // Slice #32.19 — the three screens that had no sidebar entry at all.
    groups:                    t("items.groups"),
    stamps:                    t("items.stamps"),
    tags:                      t("items.tags"),
    helpContent:               t("items.helpContent"),
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
        {/* Slice #38.22: the language toggle is shown on every build (it was developer-only). */}
        {!isCollapsed && <LocaleToggle />}
        {/* #37.42 (A002): PanelLeftOpen / PanelLeftClose. */}
        <IconButton
          icon={isCollapsed ? PanelLeftOpen : PanelLeftClose}
          label={isCollapsed ? t("expand") : t("collapse")}
          variant="bare"
          size="sm"
          onClick={toggleCollapsed}
        />
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
        // Slice #38.20: its name in the user's language (it was „Main navigation" in both).
        aria-label={t("mainNavigation")}
        data-sidebar-nav
      >
        {sections
          // Slice #38.20: `sections` is already this user's (`sectionsFor`) — the
          // „administration" key prefix it used to filter by no longer exists; the
          // server-side guard at src/app/admin/layout.tsx still refuses every /admin/
          // address to anyone else.
          // Slice #38.22: „Utilizatori & Acces" stays on UAT too — its page says why it cannot work there.
          .map((section) => {
            // Flat-link sections are identified structurally (no items, has a
            // direct href) rather than by a hardcoded key list — "document"
            // (Slice #15.08), "people" (Slice #15.09), and "propertyList"
            // (Slice #15.09.2) all qualify.
            const isFlatLinkSection =
              section.items.length === 0 && !!section.href;

            return isFlatLinkSection ? (
              <NavFlatSectionRow
                key={section.key}
                section={section}
                isActive={isFlatSectionActive(section)}
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
                comingSoon={t("comingSoon")}
                onToggle={() => toggleSection(section.key)}
                onExpandSidebar={expandSidebar}
              />
            );
          })}
      </nav>

      {/* ── Recently viewed — Slice #20.17 ────────────────────────────────── */}
      {/* #38.28: one folded bar above the footer; collapsed, its icon expands the sidebar. */}
      <RecentlyViewedPanel isCollapsed={isCollapsed} onExpandSidebar={expandSidebar} />

      {/* ── UAT (Slice #38.22): no Supabase session to change or sign out of — said, not hidden ── */}
      {isUatMode && !isCollapsed && (
        <p className="border-t border-wire shrink-0 px-3 py-2 text-xs text-fade" role="note" data-uat-no-accounts="sidebar">
          {t("uatNoAccounts")}
        </p>
      )}

      {/* ── Bottom strip — change password + logout ── */}
      {!isUatMode && (
        // #37.42 (A003, A004): „Schimbă parola" and „Ieșire" are KeyRound and
        // LogOut, side by side when the sidebar is open and one above the other
        // on the collapsed rail; their words are the names and the tooltips.
        <div
          className={[
            "border-t border-wire shrink-0 px-2 py-2 flex gap-1",
            isCollapsed ? "flex-col items-center" : "items-center px-3",
          ].join(" ")}
        >
          <IconButton
            href="/account/change-password"
            icon={KeyRound}
            label={t("changePassword")}
            variant="bare"
            size="sm"
            onClick={(e) => {
              if (!isPlainLeftClick(e)) return;
              e.preventDefault();
              guardedNavigate("/account/change-password");
            }}
          />
          <IconButton
            icon={LogOut}
            label={t("signOut")}
            variant="bare"
            size="sm"
            onClick={handleLogout}
          />
        </div>
      )}
    </aside>
  );
}
