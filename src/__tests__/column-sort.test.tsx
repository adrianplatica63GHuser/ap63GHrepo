/**
 * Slice 40.47 — a sort icon in the name cell of every column that sorts.
 *
 * Adrian, 2026-10-24: a second icon left of the funnel in the cell that holds the column's title; not in use
 * „Interacțiuni"'s two arrows, in use one thick, solid navy arrow in a circle; a press sorts the whole list by the
 * column. His columns: Persoane fizice — Adăugat la, Născut pe, Vârstă, Decedat pe; Persoane juridice — Adăugat la;
 * Proprietăți — Adăugat la, Tarla, Parcelă, Supr. Ofic., Supr. Calc.; Acte (his fourth list, headed „Natural
 * Persons" by a slip — Ask first 1) — Adăugat la, Data, Pagini, Persoane, Proprietăți. The browser half is TC-LAYOUT-10.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { property } from "@/db/schema";
import { ADDED_ON, CHANGED, DEFAULT_LIST_ORDER, LIST_SORTS, firstDirection, readListOrder, sortByColumn } from "@/lib/list/list-order";
import { listOrderBy, naturalOrder, parseListOrderQuery } from "@/lib/list/order-sql";
import { ColumnSort, ariaSortOf } from "@/components/list/column-sort";
import { ListHeadCell } from "@/components/table/list-head";
import { IN_USE_CORNER } from "@/lib/ui/button-styles";
import ro from "../../messages/ro-RO.json";

jest.mock("next-intl", () => {
  const messages = jest.requireActual("../../messages/ro-RO.json");
  return {
    useTranslations: (ns: string) => (key: string, values?: Record<string, string>) => {
      const raw = `${ns}.${key}`.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
      return String(raw ?? key).replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? "");
    },
  };
});

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("the columns that sort — Adrian's list", () => {
  it("each list's, by its chooser keys, after the last change", () => {
    expect([...LIST_SORTS.person]).toEqual([CHANGED, "createdAt", "dateOfBirth", "age", "dateOfDeath"]);
    expect([...LIST_SORTS.company]).toEqual([CHANGED, "createdAt"]);
    expect([...LIST_SORTS.property]).toEqual([CHANGED, "createdAt", "tarlaSola", "parcela", "surfaceAreaMp", "calculatedAreaMp"]);
    expect([...LIST_SORTS.document]).toEqual([CHANGED, "createdAt", "dateDocument", "pageCount", "personCount", "propertyCount"]);
  });

  const VIEWS = [["natural-persons", "person"], ["judicial-persons", "company"], ["properties", "property"], ["documents", "document"]] as const;
  it.each(VIEWS)("%s: every column it sorts by is one its chooser offers", (dir, list) => {
    const keys = [...read("src", "app", dir, "list-view.tsx").matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    for (const k of LIST_SORTS[list].slice(1)) expect([k, keys.includes(k)]).toEqual([k, true]);
  });

  it.each(VIEWS)("%s: the name cells take the sort icon from LIST_SORTS, and the button names the column", (dir, list) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(src).toContain(`(LIST_SORTS.${list} as readonly string[]).includes(c.key)`);
    expect(src).toContain("<ColumnSort sort={c.key} label={c.full ?? c.label} order={listOrder} onChange={changeListOrder} />");
    expect(src).toContain("ariaSort: ariaSortOf(listOrder, c.key)");
    expect(src).toMatch(/drag=\{drag\.headProps\(col\.key\)\}\s+\{\.\.\.sortHead\(col\)\}/);
    expect(src).toContain("<ListSortButton order={listOrder} onChange={changeListOrder} columnName={sortName} />");
  });

  const QUERIES = [["persons", "NATURAL_PERSON_SORTS", "person"], ["properties", "PROPERTY_SORTS", "property"], ["documents", "DOCUMENT_SORTS", "document"]] as const;
  it.each(QUERIES)("%s: the query's sort map names exactly the list's sorts", (lib, map, list) => {
    const src = read("src", "lib", lib, "queries.ts");
    const body = src.slice(src.indexOf(`const ${map} = {`), src.indexOf("};", src.indexOf(`const ${map} = {`)));
    const keys = [...body.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    expect(keys).toEqual([...LIST_SORTS[list]]);
    expect(src).toContain(`.orderBy(...listOrderBy(opts.order, ${map}, `);
  });

  it("Persoane juridice sorts by the last change and „Adăugat la”", () => {
    expect(read("src", "lib", "judicial-persons", "queries.ts")).toContain(
      ".orderBy(...listOrderBy(opts.order, { changed: changedAt(person.updatedAt, person.createdAt), createdAt: sql`${person.createdAt}` }, person.id))",
    );
  });

  it("„Vârstă” by the age shown — the age filter's own expression, at death for the deceased", () => {
    const src = read("src", "lib", "persons", "queries.ts");
    expect(src).toMatch(/import \{ AGE_SQL, personFilterConditions \} from "@\/lib\/persons\/list-filter-sql";/);
    expect(src).toMatch(/age: AGE_SQL,/);
  });
});

describe("the first press and the next (Ask first 3)", () => {
  it("„Adăugat la” starts newest first, every other column ascending; the same column flips; another moves the sort", () => {
    expect(firstDirection(ADDED_ON)).toBe("desc");
    expect(firstDirection(CHANGED)).toBe("desc");
    for (const k of ["dateOfBirth", "age", "tarlaSola", "pageCount"]) expect(firstDirection(k)).toBe("asc");
    expect(sortByColumn(DEFAULT_LIST_ORDER, "createdAt")).toEqual({ sort: "createdAt", order: "desc" });
    expect(sortByColumn(DEFAULT_LIST_ORDER, "dateOfBirth")).toEqual({ sort: "dateOfBirth", order: "asc" });
    expect(sortByColumn({ sort: "dateOfBirth", order: "asc" }, "dateOfBirth")).toEqual({ sort: "dateOfBirth", order: "desc" });
    expect(sortByColumn({ sort: "dateOfBirth", order: "desc" }, "age")).toEqual({ sort: "age", order: "asc" });
  });

  it("a column's order with no direction given takes its first one, in the address and on the route", () => {
    expect(readListOrder((k) => ({ sort: "parcela" })[k as "sort"] ?? null, LIST_SORTS.property)).toEqual({ sort: "parcela", order: "asc" });
    expect(parseListOrderQuery(new URLSearchParams("sort=parcela"), LIST_SORTS.property).data).toEqual({ sort: "parcela", order: "asc" });
    expect(parseListOrderQuery(new URLSearchParams("sort=createdAt"), LIST_SORTS.company).data).toEqual({ sort: "createdAt", order: "desc" });
    expect(parseListOrderQuery(new URLSearchParams("sort=parcela"), LIST_SORTS.company).success).toBe(false);
  });
});

describe("the order on the server (Ask first 4)", () => {
  const text = (s: ReturnType<typeof sql>) => new PgDialect().sqlToQuery(s).sql;

  it("Tarla and Parcelă in natural order: the digits as numbers, then the text; empty last", () => {
    const [nums, words] = naturalOrder(sql`${property.parcela}`).map(text);
    expect(nums).toContain("regexp_split_to_array(btrim(regexp_replace(");
    expect(nums).toContain("::numeric[]");
    expect(nums).toMatch(/when nullif\(btrim\(.*\), ''\) is null then null/);
    expect(words).toMatch(/^lower\(nullif\(btrim\(.*\), ''\)\)$/);
  });

  it("several keys, each the same way and empty last, then the id", () => {
    const order = listOrderBy({ sort: "parcela", order: "desc" }, { changed: sql`x`, parcela: naturalOrder(sql`${property.parcela}`) }, property.id).map(text);
    expect(order).toHaveLength(3);
    expect(order[0]).toMatch(/ desc nulls last$/);
    expect(order[1]).toMatch(/^lower\(.*\) desc nulls last$/);
    expect(order[2]).toMatch(/"id" desc$/);
  });
});

describe("the icon and its cell", () => {
  it("not in use: the two arrows, no circle; named after the column's whole name", () => {
    const onChange = jest.fn();
    render(<ColumnSort sort="dateOfBirth" label="Data nașterii" order={DEFAULT_LIST_ORDER} onChange={onChange} />);
    const b = screen.getByRole("button", { name: "Ordonează după „Data nașterii”" });
    expect(b.querySelector("svg")?.getAttribute("class")).toContain("lucide-arrow-up-down");
    expect(b.className).not.toContain("rounded-full!");
    expect(b.closest("[data-column-sort]")).toHaveAttribute("data-sort-state", "none");
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith({ sort: "dateOfBirth", order: "asc" });
    expect(ro.shared.sort.sortBy).toBe("Ordonează după „{column}”");
  });

  it("in use: one arrow, the direction's, thick and navy in a circle", () => {
    const { rerender } = render(<ColumnSort sort="age" label="Vârstă" order={{ sort: "age", order: "asc" }} onChange={jest.fn()} />);
    let b = screen.getByRole("button", { name: "Ordonează după „Vârstă”" });
    expect(b.querySelector("svg")?.getAttribute("class")).toContain("lucide-arrow-up");
    expect(b.querySelector("svg")?.getAttribute("stroke-width")).toBe("3.25");
    for (const c of IN_USE_CORNER.split(" ")) expect(b.className).toContain(c);
    rerender(<ColumnSort sort="age" label="Vârstă" order={{ sort: "age", order: "desc" }} onChange={jest.fn()} />);
    b = screen.getByRole("button", { name: "Ordonează după „Vârstă”" });
    expect(b.querySelector("svg")?.getAttribute("class")).toContain("lucide-arrow-down");
    expect(IN_USE_CORNER).toContain("text-navy!");
    expect(IN_USE_CORNER).toContain("rounded-full!");
  });

  it("aria-sort follows the list's order", () => {
    expect(ariaSortOf(DEFAULT_LIST_ORDER, "age")).toBe("none");
    expect(ariaSortOf({ sort: "age", order: "asc" }, "age")).toBe("ascending");
    expect(ariaSortOf({ sort: "age", order: "desc" }, "age")).toBe("descending");
  });

  const cell = (props: Partial<Parameters<typeof ListHeadCell>[0]>) =>
    render(<table><thead><tr><ListHeadCell column="listDate" name="Născut pe" full="Data nașterii" {...props} /></tr></thead></table>);

  it("left of the funnel, 2 px from it; where the funnel would be when the column does not filter; the name untouched", () => {
    const { container, unmount } = cell({ funnel: <button type="button">f</button>, sort: <button type="button">s</button>, ariaSort: "ascending" });
    const sortBox = container.querySelector("[data-head-sort]")!;
    expect(sortBox.className).toContain("right-[17px]");
    expect(sortBox.className).toContain("absolute bottom-0.5");
    expect(container.querySelector("[data-head-funnel]")!.className).toContain("right-0.5");
    expect(container.querySelector("th")).toHaveAttribute("aria-sort", "ascending");
    expect(container.querySelector("[data-head-band]")).toHaveAttribute("data-head-band", "filter");
    unmount();
    const plain = cell({ sort: <button type="button">s</button>, ariaSort: "none" }).container;
    expect(plain.querySelector("[data-head-sort]")!.className).toContain("right-0.5");
    expect(plain.querySelector("th")).toHaveAttribute("aria-sort", "none");
  });

  it("a column that does not sort has no icon and no aria-sort", () => {
    const { container } = cell({});
    expect(container.querySelector("[data-head-sort]")).toBeNull();
    expect(container.querySelector("th")?.hasAttribute("aria-sort")).toBe(false);
  });
});
