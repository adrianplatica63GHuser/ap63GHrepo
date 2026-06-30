"use client";

/**
 * GroupsFilterDropdown (Slice #18.17)
 *
 * Multi-select dropdown for filtering a list by group membership. Shared by
 * the Properties, Persons, and Documents list views.
 *
 * Items (in order):
 *   [*] All (in groups or not)   <- master; indeterminate when partial
 *   --------------------------------
 *   [*] Not in a group           <- special item (italic)
 *   [*] PROP-AA                  <- one row per available code
 *   [*] PROP-AB
 *
 * Filter semantics (GroupsFilter):
 *   undefined                              -> no filter (show all)
 *   { includeUngrouped: true,  codes: [] } -> ungrouped items only
 *   { includeUngrouped: false, codes: [.]} -> only items in those groups
 *   { includeUngrouped: true,  codes: [.]} -> ungrouped + items in those groups
 *   { includeUngrouped: false, codes: [] } -> nothing (0 results)
 */

import { useEffect, useRef } from "react";

export type GroupsFilter =
  | undefined
  | { includeUngrouped: boolean; codes: string[] };

export function GroupsFilterDropdown({
  availableCodes,
  selectedFilter,
  label,
  allLabel,
  ungroupedLabel,
  open,
  onOpenChange,
  onChange,
}: {
  availableCodes:  string[];
  selectedFilter:  GroupsFilter;
  label:           string;
  allLabel:        string;
  ungroupedLabel:  string;
  open:            boolean;
  onOpenChange:    (v: boolean) => void;
  onChange:        (filter: GroupsFilter) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive effective state from selectedFilter.
  const isAll            = selectedFilter === undefined;
  const includeUngrouped = isAll ? true : selectedFilter.includeUngrouped;
  const checkedCodes     = new Set(isAll ? availableCodes : selectedFilter.codes);

  const totalItems   = 1 + availableCodes.length; // 1 = "Not in a group"
  const checkedCount = (includeUngrouped ? 1 : 0) + checkedCodes.size;
  const allChecked   = isAll || checkedCount === totalItems;
  const someChecked  = !allChecked && checkedCount > 0;

  // Indeterminate state on the master checkbox.
  const masterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someChecked;
  }, [someChecked]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onOpenChange]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleMasterToggle() {
    if (allChecked) {
      onChange({ includeUngrouped: false, codes: [] }); // uncheck all
    } else {
      onChange(undefined); // check all -> no filter
    }
  }

  function handleUngroupedToggle() {
    const newInclude = !includeUngrouped;
    const newCodes   = [...checkedCodes];
    if (newInclude && newCodes.length === availableCodes.length) {
      onChange(undefined); // all selected -> upgrade to "no filter"
    } else {
      onChange({ includeUngrouped: newInclude, codes: newCodes });
    }
  }

  function handleCodeToggle(code: string) {
    const next = new Set(checkedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    if (includeUngrouped && next.size === availableCodes.length) {
      onChange(undefined); // all selected -> upgrade to "no filter"
    } else {
      onChange({ includeUngrouped, codes: [...next] });
    }
  }

  // ---------------------------------------------------------------------------
  // Trigger label
  // ---------------------------------------------------------------------------

  const triggerText = (() => {
    if (allChecked) return allLabel;
    // Build "CODE1; CODE2; Not in a group" in availableCodes order, ungrouped last.
    const parts: string[] = availableCodes.filter((c) => checkedCodes.has(c));
    if (includeUngrouped) parts.push(ungroupedLabel);
    return parts.length === 0 ? "—" : parts.join("; ");
  })();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <span className="text-fade">{label}</span>
        <span className="font-medium text-ink dark:text-zinc-100">{triggerText}</span>
        <span aria-hidden="true" className="text-fade text-xs">&#9660;</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-80 overflow-y-auto rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">

          {/* Master: All (in groups or not) */}
          <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border-b border-crease cursor-pointer hover:bg-cta-pale dark:border-zinc-800 dark:hover:bg-zinc-800/50">
            <input
              ref={masterRef}
              type="checkbox"
              checked={allChecked}
              onChange={handleMasterToggle}
              className="h-4 w-4 rounded border-wire accent-cta"
            />
            {allLabel}
          </label>

          {/* Not in a group */}
          <label className="flex items-center gap-2 px-3 py-2 text-sm border-b border-crease cursor-pointer hover:bg-cta-pale dark:border-zinc-800 dark:hover:bg-zinc-800/50">
            <input
              type="checkbox"
              checked={includeUngrouped}
              onChange={handleUngroupedToggle}
              className="h-4 w-4 rounded border-wire accent-cta"
            />
            <span className="italic text-fade">{ungroupedLabel}</span>
          </label>

          {/* Individual codes */}
          {availableCodes.map((code) => (
            <label
              key={code}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-cta-pale dark:hover:bg-zinc-800/50"
            >
              <input
                type="checkbox"
                checked={checkedCodes.has(code)}
                onChange={() => handleCodeToggle(code)}
                className="h-4 w-4 rounded border-wire accent-cta"
              />
              <span className="font-mono text-xs font-semibold text-ink dark:text-zinc-100">
                {code}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
