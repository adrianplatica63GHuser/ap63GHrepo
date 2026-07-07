"use client";

// ---------------------------------------------------------------------------
// RecentlyViewedPanel  (Slice #20.17)
// ---------------------------------------------------------------------------
//
// A collapsible "Recente" section rendered at the bottom of the sidebar nav
// (above the change-password / logout strip), shown only when:
//   - the sidebar is expanded (isCollapsed=false), AND
//   - there is at least one recently-viewed entry
//
// Each entry shows:
//   - entity type icon (User / Building2 / List / FileText)
//   - display name (truncated)
//   - code chip (PROP00003, etc.)
//
// Clicking navigates through the unsaved-changes guard (same pattern as all
// sidebar links).  The panel itself is collapsible so it doesn't push the
// nav items too far up.

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { User, Building2, List, FileText, ChevronDown, ChevronRight } from "lucide-react";
import {
  useNavigationHistory,
  type EntityType,
  type RecentlyViewedEntry,
} from "@/components/providers/navigation-history-provider";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";

// ---------------------------------------------------------------------------
// Entity type → icon
// ---------------------------------------------------------------------------

function EntityIcon({ type }: { type: EntityType }) {
  const cls = "shrink-0 text-fade";
  switch (type) {
    case "NATURAL_PERSON":  return <User       size={13} className={cls} aria-hidden="true" />;
    case "JUDICIAL_PERSON": return <Building2  size={13} className={cls} aria-hidden="true" />;
    case "PROPERTY":        return <List       size={13} className={cls} aria-hidden="true" />;
    case "DOCUMENT":        return <FileText   size={13} className={cls} aria-hidden="true" />;
  }
}

// ---------------------------------------------------------------------------
// Single entry row
// ---------------------------------------------------------------------------

function RecentEntry({
  entry,
  onNavigate,
}: {
  entry:      RecentlyViewedEntry;
  onNavigate: (href: string) => void;
}) {
  return (
    <Link
      href={entry.href}
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) return;
        e.preventDefault();
        onNavigate(entry.href);
      }}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-ink hover:bg-or-light transition-colors min-w-0"
      title={`${entry.label} (${entry.code})`}
    >
      <EntityIcon type={entry.entityType} />
      <span className="truncate min-w-0 flex-1">{entry.label}</span>
      <span className="shrink-0 text-[10px] font-mono text-fade bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
        {entry.code}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function RecentlyViewedPanel({ isCollapsed }: { isCollapsed: boolean }) {
  const t                = useTranslations("navigation.recentlyViewed");
  const { recentlyViewed } = useNavigationHistory();
  const { guardedNavigate }  = useUnsavedChanges();
  const [open, setOpen]  = useState(true);

  // Hide when sidebar is collapsed or no entries
  if (isCollapsed || recentlyViewed.length === 0) return null;

  return (
    <div className="border-t border-wire px-2 py-1.5 flex flex-col gap-0.5">
      {/* Section header — collapsible toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-fade uppercase tracking-wider hover:text-ink transition-colors w-full text-left rounded-md hover:bg-crease"
        aria-expanded={open}
      >
        {open
          ? <ChevronDown  size={12} aria-hidden="true" />
          : <ChevronRight size={12} aria-hidden="true" />
        }
        {t("title")}
      </button>

      {open && (
        <div className="flex flex-col gap-0.5">
          {recentlyViewed.map((entry) => (
            <RecentEntry
              key={entry.href}
              entry={entry}
              onNavigate={guardedNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
