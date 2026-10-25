/**
 * „Câmpuri afișate" as a spec needs it.                                                             (Slice 40.66)
 *
 * Since 40.66 a browser with no choice of its own opens each principal list on four default columns
 * (`LIST_COLUMN_CHOICE`, src/lib/ui/list-columns.ts; TC-LAYOUT-03 is their case). A spec whose subject is something
 * else — a filter, a search, a toolbar's edge — and whose steps were written against the lists as they opened before
 * (Proprietăți on Tip proprietate alone, the other three on their fixed columns only) stores that choice first, through
 * this, so its steps read as written.
 *
 * An init script, so it is in place before the list's first paint — and it writes only a key that is not there yet, so
 * a choice the spec makes itself survives its own reloads.
 */
import type { Page } from "@playwright/test";
import { LIST_COLUMN_CHOICE } from "../../src/lib/ui/list-columns";

/** What each list opened on before 40.66. */
export const COLUMNS_BEFORE_40_66: Readonly<Record<keyof typeof LIST_COLUMN_CHOICE, readonly string[]>> = {
  property: ["propertyType"],
  document: [],
  person: [],
  company: [],
};

export async function listsOnTheirEarlierColumns(page: Page): Promise<void> {
  const entries = (Object.keys(LIST_COLUMN_CHOICE) as (keyof typeof LIST_COLUMN_CHOICE)[]).map(
    (list) => [LIST_COLUMN_CHOICE[list].storageKey, JSON.stringify(COLUMNS_BEFORE_40_66[list])] as const,
  );
  await page.addInitScript((pairs) => {
    try {
      for (const [key, value] of pairs) if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    } catch {
      // No storage (a page that forbids it): the list opens on its defaults.
    }
  }, entries);
}
