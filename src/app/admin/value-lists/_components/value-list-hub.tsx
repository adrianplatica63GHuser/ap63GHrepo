"use client";

/**
 * „Date de referință" — one page: the categories on the left, the chosen list
 * on the right.                                                (Slice #38.35)
 *
 * Until #38.35 this was a page of blue buttons, each opening its list as a
 * modal. Now every list is reached from one category (`listsByCategory`,
 * `@/lib/admin/value-lists/categories` — a list in none lands under „Altele"),
 * and the list opens beside them, as a panel: no overlay, no close button. The
 * dialogs that sit ON a list — a delete or „Unește", the Form editor,
 * „Roluri pe Document" — stay dialogs; 38.36 and 38.39 give the last two pages
 * of their own.
 *
 * THE URL CARRIES THE LIST (Ask first 1): `/admin/value-lists?list=<key>`, so a
 * list can be linked to and the browser's Back goes to the previous one. A
 * press pushes the URL; the server page reads it and hands it here, so the
 * panel shown is always the one the address names.
 *
 * KEYBOARD: the lists are buttons in one column — Tab reaches them, ↑ / ↓ move
 * between them, Home / End go to the first and the last.
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LIST_META, isValidListKey, type ListKey } from "@/lib/admin/value-lists/config";
import { categoryOfList, listsByCategory } from "@/lib/admin/value-lists/categories";
import { VALUE_LIST_CARD_UNITS, ValueListModal } from "./value-list-modal";
import { RelationshipTriangle } from "./relationship-triangle";
import { REFERENCE_NAV_REM, rem, unitsRem } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";

/**
 * The categories' column: as wide as its longest name, the gap after it equal to the gap before it — 16rem
 * (`REFERENCE_NAV_REM`, measured in field-widths.ts; Slice #38.65). It was two units (19.5rem) from #38.35 to
 * #38.64. The page title sits above it, at its width, so the list's side can start level with the title, just
 * under the breadcrumbs bar (Ask first #1): the title used to be page.tsx's, above the whole row.
 */

/**
 * The list's side takes the rest of the row, and never less than this: below
 * it (a 1366 px window, six units) the list goes under the categories rather
 * than beside them in a sliver. A list wider than its side scrolls inside it.
 */
const LIST_MIN_UNITS = 6;

export function ValueListHub({
  /**
   * The list the address names — `?list=` — and a name to start adding (`?add=`,
   * Slice #34.10: the import's stop screen carries the name of a type the run
   * would have created).
   *
   * ⚠️ **VALIDATED HERE with `isValidListKey`, and not trusted from the URL.**
   * `?list=` is a string anybody can type, and `in` on a plain object would let
   * `constructor` or `__proto__` through (found by an adversarial round on
   * #34.10). An unrecognised value shows the page with no list open, which is
   * the right failure for a deep link.
   *
   * ⚠️ **`initialAddName` goes to the list the visit ARRIVED on, once.** Moving
   * to another list, or back, opens it without the name: the URL has had its say.
   */
  initialList,
  initialAddName,
  initialFormFilter,
}: {
  initialList?: string;
  initialAddName?: string;
  /** Slice #38.51: `?form=`, for the list the visit arrived on, once — as `initialAddName`. */
  initialFormFilter?: string;
} = {}) {
  const t = useTranslations("valueList");
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);

  const selected: ListKey | null =
    initialList !== undefined && isValidListKey(initialList) ? initialList : null;
  const [arrival] = useState<ListKey | null>(selected);
  const [addNameUsed, setAddNameUsed] = useState(false);

  function open(key: ListKey) {
    if (key === selected) return;
    setAddNameUsed(true);
    router.push(`/admin/value-lists?list=${key}`, { scroll: false });
  }

  function onNavKey(e: KeyboardEvent<HTMLElement>) {
    const buttons = Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>("button[data-list-key]") ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next =
      e.key === "ArrowDown" ? Math.min(at + 1, buttons.length - 1)
      : e.key === "ArrowUp" ? Math.max(at - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? buttons.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    buttons[next].focus();
  }

  return (
    <UnitRow units={[LIST_MIN_UNITS]}>
      {/* Slice #38.65: the title and the column, one above the other; the list's side beside both, from the top. */}
      <div className="flex flex-col gap-6" data-value-list-column="">
        <header>
          <h1 className="whitespace-nowrap text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        </header>
        <nav
          ref={navRef}
          aria-label={t("page.nav")}
          onKeyDown={onNavKey}
          style={{ width: rem(REFERENCE_NAV_REM), minWidth: "max-content" }}
          data-panel="value-lists-nav"
          data-measured-width=""
          className="flex flex-col gap-4 rounded-lg border border-card-rim bg-card p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {listsByCategory().map((category) => (
            <div key={category.id} className="flex flex-col gap-1" data-category={category.id}>
              <h2 className="px-2 text-xs font-semibold uppercase tracking-widest text-ink dark:text-zinc-400">
                {t(`categories.${category.id}`)}
              </h2>
              <ul className="flex flex-col">
                {category.lists.map((key) => {
                  const label = t(`lists.${LIST_META[key].titleKey}`);
                  const current = key === selected;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        data-list-key={key}
                        aria-current={current ? "page" : undefined}
                        onClick={() => open(key)}
                        className={[
                          "w-fit rounded-md px-2 py-1 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-focus",
                          current
                            ? "bg-cta font-medium text-white"
                            : "text-ink hover:bg-cta-pale dark:text-zinc-200 dark:hover:bg-zinc-800",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div
        data-value-list-side=""
        className="flex flex-1 flex-col gap-3 overflow-x-auto"
        style={{ flexBasis: 0, minWidth: rem(unitsRem(LIST_MIN_UNITS)) }}
      >
        {selected === null ? (
          <p className="rounded-lg border border-dashed border-card-rim px-4 py-6 text-sm text-fade dark:border-zinc-800 dark:text-zinc-400">
            {t("page.choose")}
          </p>
        ) : (
          <>
            {/* Slice #38.62: the relationship triangle above every list of „Roluri și legături" (Ask first #1) —
                #34.05's sentence, printed here above the two link lists until now, is its Document – Proprietate
                entry. A corner or side with a list opens it through `open`, as the column on the left does. */}
            {categoryOfList(selected) === "rolesLinks" && (
              <RelationshipTriangle current={selected} onOpen={open} cardUnits={VALUE_LIST_CARD_UNITS} />
            )}
            {/* Keyed on the list: each list starts from its own state — a filter
                ticked on one never filters the next (#27.07). */}
            <ValueListModal
              key={selected}
              listKey={selected}
              initialAddName={selected === arrival && !addNameUsed ? initialAddName : undefined}
              initialFormFilter={selected === arrival && !addNameUsed ? initialFormFilter : undefined}
            />
          </>
        )}
      </div>
    </UnitRow>
  );
}
