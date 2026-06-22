"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, KeyRound } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { createClient } from "@/lib/supabase/client";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
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

async function fetchMe(): Promise<{ username: string; role: string }> {
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
          ? "bg-cta-pale text-cta font-medium"
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
          isSectionActive ? "text-cta" : "text-ink hover:bg-crease",
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
// Used for sections with no expandable children (currently just "document",
// Slice #15.08): no chevron, no accordion toggle — clicking it navigates
// straight to its href, same single-click behaviour as any other page link,
// just rendered with the larger section-header styling/icon size.

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
        isActive ? "text-cta" : "text-ink hover:bg-crease",
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

  function handleLogout() {
    guardedAction(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
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
  // "document" is a flat link (no children, see NavFlatSectionRow) so it has
  // no accordion-open state to track — getActiveSectionKey only needs to
  // resolve sections that actually have expandable items.
  const activeSectionKey = useMemo(
    () => getActiveSectionKey(pathname, NAV_SECTIONS),
    [pathname],
  );

  // "document" highlights as active for the list page and any of its
  // detail/sub-pages (e.g. "/documents/[id]"), independent of the
  // accordion-driven activeSectionKey above.
  const isDocumentActive = pathname === "/documents" || pathname.startsWith("/documents/");

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
    people: t("sections.people"),
    property: t("sections.property"),
    document: t("sections.document"),
    administration: t("sections.administration"),
  };

  const itemLabels: Record<string, string> = {
    naturalPerson:             t("items.naturalPerson"),
    judicialPerson:            t("items.judicialPerson"),
    landList:                  t("items.landList"),
    landMap:                   t("items.landMap"),
    building:                  t("items.building"),
    propertyType3:             t("items.propertyType3"),
    users:                     t("items.users"),
    referenceData:             t("items.referenceData"),
    import:                    t("items.import"),
    export:                    t("items.export"),
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
        {!isCollapsed && <LocaleToggle />}
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


      {/* ── Logged-in username (expanded mode) ────────────────────────── */}
      {!isCollapsed && me?.username && (
        <div className="px-4 py-1.5 text-xs text-fade truncate border-b border-wire">
          {t("signedInAs")} <span className="font-medium text-ink">{me.username}</span>
        </div>
      )}

      {/* ── Nav sections ───────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5"
        aria-label="Main navigation"
      >
        {NAV_SECTIONS.map((section) => {
          // Filter administration items based on role
          const filteredSection =
            section.key === "administration"
              ? {
                  ...section,
                  items: section.items.filter(
                    (item) => item.key !== "users" || isSuperuser,
                  ),
                }
              : section;

          return filteredSection.key === "document" ? (
            <NavFlatSectionRow
              key={filteredSection.key}
              section={filteredSection}
              isActive={isDocumentActive}
              isCollapsed={isCollapsed}
              sectionLabel={sectionLabels[filteredSection.key] ?? filteredSection.key}
              onNavigate={guardedNavigate}
            />
          ) : (
            <NavSectionRow
              key={filteredSection.key}
              section={filteredSection}
              isOpen={openSection === filteredSection.key}
              isCollapsed={isCollapsed}
              activeHref={activeHref}
              sectionLabel={sectionLabels[filteredSection.key] ?? filteredSection.key}
              itemLabels={itemLabels}
              onToggle={() => toggleSection(filteredSection.key)}
              onExpandSidebar={expandSidebar}
            />
          );
        })}
      </nav>

      {/* ── Bottom strip — change password + logout ─────────────────────── */}
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
    </aside>
  );
}
