"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
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
// SidebarNav — main export
// ---------------------------------------------------------------------------

export function SidebarNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // ── Collapsed state — persisted in localStorage ───────────────────────────
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Read from localStorage after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setIsCollapsed(stored === "true");
  }, []);

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
  const activeSectionKey = useMemo(
    () => getActiveSectionKey(pathname, NAV_SECTIONS),
    [pathname],
  );

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(activeSectionKey ? [activeSectionKey] : []),
  );

  // Ensure the active section stays open when the user navigates
  useEffect(() => {
    if (activeSectionKey) {
      setOpenSections((prev) => {
        if (prev.has(activeSectionKey)) return prev;
        return new Set([...prev, activeSectionKey]);
      });
    }
  }, [activeSectionKey]);

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
    naturalPerson: t("items.naturalPerson"),
    judicialPerson: t("items.judicialPerson"),
    landList: t("items.landList"),
    landMap: t("items.landMap"),
    building: t("items.building"),
    propertyType3: t("items.propertyType3"),
    contract: t("items.contract"),
    certificate: t("items.certificate"),
    authorization: t("items.authorization"),
    deed: t("items.deed"),
    extract: t("items.extract"),
    report: t("items.report"),
    users: t("items.users"),
    referenceData: t("items.referenceData"),
    importExport: t("items.importExport"),
    settings: t("items.settings"),
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside
      className={[
        "flex flex-col bg-card border-r border-wire shrink-0",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        isCollapsed ? "w-14" : "w-56",
      ].join(" ")}
    >
      {/* ── App name + collapse toggle ─────────────────────────────────── */}
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
        {NAV_SECTIONS.map((section) => (
          <NavSectionRow
            key={section.key}
            section={section}
            isOpen={openSections.has(section.key)}
            isCollapsed={isCollapsed}
            activeHref={activeHref}
            sectionLabel={sectionLabels[section.key] ?? section.key}
            itemLabels={itemLabels}
            onToggle={() => toggleSection(section.key)}
            onExpandSidebar={expandSidebar}
          />
        ))}
      </nav>

      {/* ── Bottom: locale toggle ──────────────────────────────────────── */}
      <div
        className={[
          "border-t border-wire p-3 shrink-0",
          isCollapsed ? "flex justify-center" : "",
        ].join(" ")}
      >
        {!isCollapsed && <LocaleToggle />}
      </div>
    </aside>
  );
}
