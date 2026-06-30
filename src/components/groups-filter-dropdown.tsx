"use client";

/**
 * GroupsFilterDropdown (Slice #18.17)
 *
 * A multi-select dropdown for filtering a list by group codes. Shared across
 * the Properties, Persons, and Documents list views.
 *
 * Semantics (mirrors the Properties Map "Groups" panel):
 *   selectedCodes === undefined → no filter (show all items)
 *   selectedCodes === []        → show only items with NO matching group
 *   selectedCodes === [...]     → show ungrouped items + items in ≥1 of these codes
 *
 * onChange receives the new selectedCodes value:
 *   - undefined when all codes are selected back (removes the filter)
 *   - []        when all codes are unchecked
 *   - [...]     for a partial selection
 */

import { useEffect, useRef } from "react";

export function GroupsFilterDropdown({
  availableCodes,
  selectedCodes,
  label,
  allLabel,
  open,
  onOpenChange,
  onChange,
}: {
  availableCodes: string[];
  selectedCodes: string[] | undefined;
  label: string;
  allLabel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChange: (codes: string[] | undefined) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // selectedCodes undefined → treat as all selected.
  const effectiveCodes = new Set(
    selectedCodes === undefined ? availableCodes : selectedCodes,
  );
  const allChecked =
    selectedCodes === undefined ||
    (availableCodes.length > 0 && effectiveCodes.size === availableCodes.length);
  const someChecked = effectiveCodes.size > 0 && !allChecked;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  function handleSelectAllToggle() {
    if (allChecked) {
      onChange([]);           // uncheck all → show only ungrouped
    } else {
      onChange(undefined);    // check all → remove filter
    }
  }

  function handleToggleCode(code: string) {
    const next = new Set(effectiveCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    // If every available code is now checked, treat as "no filter".
    if (next.size === availableCodes.length) {
      onChange(undefined);
    } else {
      onChange([...next]);
    }
  }

  const triggerText = allChecked
    ? allLabel
    : effectiveCodes.size === 0
    ? "0"
    : `${effectiveCodes.size}/${availableCodes.length}`;

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
        <span aria-hidden="true" className="text-fade text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-56 max-h-72 overflow-y-auto rounded-md border border-wire bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border-b border-crease cursor-pointer hover:bg-cta-pale dark:border-zinc-800 dark:hover:bg-zinc-800/50">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allChecked}
              onChange={handleSelectAllToggle}
              className="h-4 w-4 rounded border-wire accent-cta"
            />
            {allLabel}
          </label>
          {availableCodes.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center text-fade">—</div>
          ) : (
            availableCodes.map((code) => (
              <label
                key={code}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-cta-pale dark:hover:bg-zinc-800/50"
              >
                <input
                  type="checkbox"
                  checked={effectiveCodes.has(code)}
                  onChange={() => handleToggleCode(code)}
                  className="h-4 w-4 rounded border-wire accent-cta"
                />
                <span className="font-mono text-xs font-semibold text-ink dark:text-zinc-100">
                  {code}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
