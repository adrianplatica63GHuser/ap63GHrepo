"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { PAPERWORK_TYPES, type PaperworkType } from "@/lib/paperwork/validation";
import { NAV_SECTIONS, type NavItem, type NavSection } from "./nav-config";
import {
  getActiveHref,
  getActiveSectionKey,
} from "./sidebar-helpers";

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

  return (
    <Link
      href={item.href}
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
// PaperworkNavSection — checkbox-based document-type filter
// ---------------------------------------------------------------------------
//
// Replaces the link-based paperwork items with a (Select All) + 19 individual
// checkboxes. Clicking any checkbox navigates to /paperwork?types=... so the
// list page filters in real time.
//
// State resets to all-checked whenever the accordion transitions closed → open.

function PaperworkNavSection({
  section,
  isOpen,
  isCollapsed,
  sectionLabel,
  pathname,
  onToggle,
  onExpandSidebar,
}: {
  section: NavSection;
  isOpen: boolean;
  isCollapsed: boolean;
  sectionLabel: string;
  pathname: string;
  onToggle: () => void;
  onExpandSidebar: () => void;
}) {
  const tPaperwork = useTranslations("paperwork");
  const router = useRouter();
  const SectionIcon = section.icon;

  const isSectionActive = pathname.startsWith("/paperwork");

  // ── Checkbox state ─────────────────────────────────────────────────────────
  const [checkedTypes, setCheckedTypes] = useState<Set<string>>(
    () => new Set(PAPERWORK_TYPES),
  );
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Reset to all-checked when accordion opens (closed → open transition).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setCheckedTypes(new Set(PAPERWORK_TYPES));
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  // Keep the (Select All) native indeterminate state in sync with checkedTypes.
  useEffect(() => {
    if (!selectAllRef.current) return;
    const n = checkedTypes.size;
    selectAllRef.current.indeterminate = n > 0 && n < PAPERWORK_TYPES.length;
  }, [checkedTypes]);

  // ── Navigation helper ───────────────────────────────────────────────────────
  const pushUrl = useCallback(
    (types: Set<string>) => {
      if (types.size === PAPERWORK_TYPES.length) {
        router.push("/paperwork");
      } else if (types.size === 0) {
        router.push("/paperwork?types=");
      } else {
        router.push(`/paperwork?types=${[...types].join(",")}`);
      }
    },
    [router],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    const next: Set<string> =
      checkedTypes.size === PAPERWORK_TYPES.length
        ? new Set()
        : new Set(PAPERWORK_TYPES);
    setCheckedTypes(next);
    pushUrl(next);
  }, [checkedTypes, pushUrl]);

  const handleToggleType = useCallback(
    (typeKey: string) => {
      const next = new Set(checkedTypes);
      if (next.has(typeKey)) next.delete(typeKey);
      else next.add(typeKey);
      setCheckedTypes(next);
      pushUrl(next);
    },
    [checkedTypes, pushUrl],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Section header — same structure as NavSectionRow */}
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

      {/* Checkbox list — only visible when expanded */}
      {!isCollapsed && isOpen && (
        <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-wire flex flex-col gap-0.5">
          {/* (Select All) row */}
          <label className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-ink cursor-pointer hover:bg-or-light select-none">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={checkedTypes.size === PAPERWORK_TYPES.length}
              onChange={handleSelectAll}
              className="h-3.5 w-3.5 shrink-0 cursor-pointer"
            />
            <span className="truncate">{tPaperwork("selectAll")}</span>
          </label>

          {/* Individual type checkboxes */}
          {(PAPERWORK_TYPES as readonly PaperworkType[]).map((typeKey) => (
            <label
              key={typeKey}
              className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-ink cursor-pointer hover:bg-or-light select-none"
            >
              <input
                type="checkbox"
                checked={checkedTypes.has(typeKey)}
                onChange={() => handleToggleType(typeKey)}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer"
              />
              <span className="truncate">
                {tPaperwork(`types.${typeKey}`)}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarNav — main export
// ---------------------------------------------------------------------------

export function SidebarNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

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
  const activeSectionKey = useMemo(() => {
    const computed = getActiveSectionKey(pathname, NAV_SECTIONS);
    if (computed) return computed;
    // Paperwork section has no items in nav-config (checkbox-based), so we
    // detect it by pathname prefix instead.
    if (pathname.startsWith("/paperwork")) return "paperwork";
    return null;
  }, [pathname]);

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
    paperwork: t("sections.paperwork"),
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
    importExport:              t("items.importExport"),
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

      {/* ── Nav sections ───────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5"
        aria-label="Main navigation"
      >
        {NAV_SECTIONS.map((section) =>
          section.key === "paperwork" ? (
            <PaperworkNavSection
              key={section.key}
              section={section}
              isOpen={openSection === section.key}
              isCollapsed={isCollapsed}
              sectionLabel={sectionLabels[section.key] ?? section.key}
              pathname={pathname}
              onToggle={() => toggleSection(section.key)}
              onExpandSidebar={expandSidebar}
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
          ),
        )}
      </nav>
    </aside>
  );
}
