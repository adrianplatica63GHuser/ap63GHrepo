"use client";

// ---------------------------------------------------------------------------
// RecentlyViewedPanel  (Slice #20.17; one folded bar since #38.28; the bar on top since #38.63)
// ---------------------------------------------------------------------------
//
// „Recente" at the bottom of the sidebar nav, directly above the
// change-password / logout strip, takes the space of ONE bar: the history
// icon, the word „Recente" and a chevron. It is FOLDED by default (#38.28 —
// Adrian: „by default it should not be expanded … it should be one bar").
// A click unfolds the recently viewed records UNDER the bar, like an
// accordion, and a second click folds it back. #38.28 drew the list above the
// bar, so that it „grows upwards and the footer does not move"; Slice #38.63,
// Adrian: „I would like this bar to be at the top of this list so it looks
// like it opens the accordion under the bar". The bar is the panel's top line
// now, the list (max-h-64, which scrolls) under it — and the footer still does
// not move: the panel sits at the bottom of the sidebar and grows upwards as a
// whole, bar and list together. The chevron behaves like a sidebar section's:
// down while folded, up while unfolded.
//
// The panel lives in the layout, so it stays as the user left it while moving
// between screens; a reload or a new sign-in folds it again (no storage).
// With nothing visited yet the bar is still there, so it never appears under
// the user's mouse, and unfolded it says „Niciun element vizitat recent".
// With the sidebar collapsed to icons it is the history icon alone, with its
// tooltip; a click expands the sidebar with the list unfolded — the way a
// section's icon behaves there.
//
// Each entry shows its entity type icon and its name, and navigates through
// the unsaved-changes guard (same pattern as every sidebar link).
//
// ⚠️ Ten e2e specs paint over this panel in their pictures with
// `aside div.border-t` filtered by a button named /Recente/ — keep the outer
// div's border-t and the button's name.

import { useId, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { User, Building2, List, FileText, History, ChevronDown } from "lucide-react";
import { IconTooltip } from "@/lib/ui/icon-button";
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
      title={entry.label}
    >
      <EntityIcon type={entry.entityType} />
      {/* Slice #37.57: the name only — a record's system ID is shown on its own screen. */}
      <span className="truncate min-w-0 flex-1">{entry.label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function RecentlyViewedPanel({
  isCollapsed,
  onExpandSidebar,
}: {
  isCollapsed: boolean;
  /** Collapsed to icons, the bar's click expands the sidebar (#38.28). */
  onExpandSidebar?: () => void;
}) {
  const t                    = useTranslations("navigation.recentlyViewed");
  const { recentlyViewed }   = useNavigationHistory();
  const { guardedNavigate }  = useUnsavedChanges();
  // #38.28: folded by default; only this page load remembers an unfold.
  const [open, setOpen]      = useState(false);
  const listId               = useId();

  if (isCollapsed) {
    // The history icon alone, its name in the tooltip; a click expands the
    // sidebar with the list unfolded.
    return (
      <div className="border-t border-wire shrink-0 px-2 py-1 flex flex-col items-center">
        <IconTooltip label={t("title")} fill>
          <button
            type="button"
            aria-label={t("title")}
            onClick={() => {
              setOpen(true);
              onExpandSidebar?.();
            }}
            className="w-full flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-crease transition-colors"
          >
            <History size={18} className="shrink-0" aria-hidden="true" />
          </button>
        </IconTooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-wire shrink-0 px-2 py-1 flex flex-col gap-0.5" data-recent-panel>
      {/* The bar: one row, the height of a section row (#38.28) — and, since
          #38.63, the panel's top line, the list opening under it. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        data-recent-bar
        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-crease transition-colors"
      >
        <History size={18} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left ml-2.5">{t("title")}</span>
        {/* #38.28 pointed it up while folded (the list opened above); #38.63: a sidebar section's chevron. */}
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* #38.28 had „Unfolded, the records sit ABOVE the bar: the list grows upwards and the footer
          under the bar does not move." #38.63: they sit UNDER it, like an accordion; the panel as a
          whole grows upwards, so the footer still does not move. */}
      {open && (
        <div id={listId} className="flex flex-col gap-0.5 max-h-64 overflow-y-auto pb-1">
          {recentlyViewed.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-fade">{t("empty")}</p>
          ) : (
            recentlyViewed.map((entry) => (
              <RecentEntry
                key={entry.href}
                entry={entry}
                onNavigate={guardedNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
