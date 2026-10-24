/**
 * Slice 40.46 — a sort button on the four principal lists; the default stays the record changed last first.
 *
 * Adrian, 2026-10-24: a button with „Interacțiuni"'s icon after „Câmpuri afișate" (on Acte after „Câmp specific"'s ⓘ);
 * at 11:51, „Let's keep what it was before (and modify the caption of the button accordingly)"; at 11:56, the words
 * „Recente întâi" / „Vechi întâi". The order is the server's — `sort` and `order` on the four routes, whitelisted —
 * and it is kept in the list's address like its filters. The browser half is TC-LAYOUT-09.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { PgDialect } from "drizzle-orm/pg-core";
import { document as documentTable, person, property } from "@/db/schema";
import {
  CHANGED,
  DEFAULT_LIST_ORDER,
  LIST_SORTS,
  ORDER_KEYS,
  appendOrderParams,
  flipListOrder,
  isDefaultOrder,
  orderAddressPatch,
  orderSignature,
  readListOrder,
  type ListOrder,
} from "@/lib/list/list-order";
import { changedAt, listOrderBy, parseListOrderQuery } from "@/lib/list/order-sql";
import { readListAddress, writeListAddress } from "@/lib/ui/list-address";
import { ListSortButton } from "@/components/list/list-sort-button";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

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
const at = (map: Record<string, string>) => (k: string) => map[k] ?? null;

describe("the order model (list-order.ts)", () => {
  it("the default is today's order: the record changed last first", () => {
    expect(DEFAULT_LIST_ORDER).toEqual({ sort: "changed", order: "desc" });
    expect(isDefaultOrder({ sort: CHANGED, order: "desc" })).toBe(true);
    expect(isDefaultOrder({ sort: CHANGED, order: "asc" })).toBe(false);
  });

  it("every list may be ordered by `changed`, and — until 40.47 — by nothing else", () => {
    expect(Object.keys(LIST_SORTS).sort()).toEqual(["company", "document", "person", "property"]);
    for (const sorts of Object.values(LIST_SORTS)) expect([...sorts]).toEqual([CHANGED]);
  });

  it("reads an address: nothing is the default, a malformed one is the default whole", () => {
    const s = LIST_SORTS.person;
    expect(readListOrder(at({}), s)).toEqual(DEFAULT_LIST_ORDER);
    expect(readListOrder(at({ sort: "changed", order: "asc" }), s)).toEqual({ sort: "changed", order: "asc" });
    expect(readListOrder(at({ order: "asc" }), s)).toEqual({ sort: "changed", order: "asc" });
    expect(readListOrder(at({ sort: "changed" }), s)).toEqual(DEFAULT_LIST_ORDER);
    expect(readListOrder(at({ sort: "createdAt", order: "asc" }), s)).toEqual(DEFAULT_LIST_ORDER);
    expect(readListOrder(at({ sort: "changed", order: "up" }), s)).toEqual(DEFAULT_LIST_ORDER);
  });

  it("the button's press: newest ⇄ oldest by the last change; any other order back to the default", () => {
    const older = flipListOrder(DEFAULT_LIST_ORDER);
    expect(older).toEqual({ sort: "changed", order: "asc" });
    expect(flipListOrder(older)).toEqual(DEFAULT_LIST_ORDER);
    expect(flipListOrder({ sort: "dateOfBirth", order: "asc" })).toEqual(DEFAULT_LIST_ORDER);
  });

  it("the address says the order only when it is not the default, and reads it back", () => {
    const base = new URLSearchParams("q=ion");
    expect(writeListAddress(base, { filters: orderAddressPatch(DEFAULT_LIST_ORDER) }).toString()).toBe("q=ion");
    const older = writeListAddress(base, { filters: orderAddressPatch({ sort: CHANGED, order: "asc" }) });
    expect(older.toString()).toBe("q=ion&sort=changed&order=asc");
    // Back to the default: both words go.
    expect(writeListAddress(older, { filters: orderAddressPatch(DEFAULT_LIST_ORDER) }).toString()).toBe("q=ion");
    const back = readListAddress(older, ORDER_KEYS);
    expect(readListOrder((k) => back.filters[k], LIST_SORTS.document)).toEqual({ sort: CHANGED, order: "asc" });
  });

  it("a request carries the order only when it is not the default", () => {
    const p = new URLSearchParams();
    appendOrderParams(p, DEFAULT_LIST_ORDER);
    expect(p.toString()).toBe("");
    appendOrderParams(p, { sort: CHANGED, order: "asc" });
    expect(p.toString()).toBe("sort=changed&order=asc");
    expect(orderSignature({ sort: CHANGED, order: "asc" })).not.toBe(orderSignature(DEFAULT_LIST_ORDER));
  });
});

describe("the order on the server (order-sql.ts)", () => {
  const sorts = LIST_SORTS.property;
  const q = (s: string) => parseListOrderQuery(new URLSearchParams(s), sorts);

  it("no words is today's order; the two words whitelisted; anything else refused", () => {
    expect(q("").data).toEqual({ sort: "changed", order: "desc" });
    expect(q("sort=changed&order=asc").data).toEqual({ sort: "changed", order: "asc" });
    expect(q("order=asc").data).toEqual({ sort: "changed", order: "asc" });
    for (const bad of ["sort=createdAt", "sort=changed&order=up", "sort=", "sort=changed;drop"]) {
      expect([bad, q(bad).success]).toEqual([bad, false]);
    }
  });

  const orderSql = (o: ListOrder | undefined, table: typeof person | typeof property | typeof documentTable) =>
    listOrderBy(o, { changed: changedAt(table.updatedAt, table.createdAt) }, table.id).map((s) => new PgDialect().sqlToQuery(s).sql);

  it("orders by greatest(updatedAt, createdAt), then by the id the same way — no swaps between pages", () => {
    const [p1, p2] = orderSql(undefined, person);
    expect(p1).toMatch(/^greatest\((?:"person"\.)?"updated_at", (?:"person"\.)?"created_at"\) desc nulls last$/);
    expect(p2).toMatch(/^(?:"person"\.)?"id" desc$/);
    const [a1, a2] = orderSql({ sort: CHANGED, order: "asc" }, property);
    expect(a1).toMatch(/^greatest\((?:"property"\.)?"updated_at", (?:"property"\.)?"created_at"\) asc nulls last$/);
    expect(a2).toMatch(/^(?:"property"\.)?"id" asc$/);
    expect(orderSql(DEFAULT_LIST_ORDER, documentTable)[0]).toMatch(/^greatest\((?:"document"\.)?"updated_at", (?:"document"\.)?"created_at"\) desc nulls last$/);
  });

  it("an expression the list does not have falls back to `changed`", () => {
    expect(orderSql({ sort: "nothing", order: "desc" }, person)[0]).toContain("greatest(");
  });
});

describe("the four routes and their queries", () => {
  const ROUTES = [
    ["people", "person", "persons", "listPersons", "person"],
    ["judicial-persons", "company", "judicial-persons", "listJudicialPersons", "person"],
    ["properties", "property", "properties", "listProperties", "property"],
    ["documents", "document", "documents", "listDocument", "document"],
  ] as const;

  it.each(ROUTES)("/api/%s reads the order against LIST_SORTS.%s and refuses a bad one as it refuses any bad parameter", (route, list) => {
    const src = read("src", "app", "api", route, "route.ts");
    expect(src).toContain(`const order = parseListOrderQuery(url.searchParams, LIST_SORTS.${list});`);
    expect(src).toMatch(/if \(!order\.success\) \{\s+return zodErrorToResponse\(order\.error\);/);
    expect(src).toContain("order: order.data");
  });

  it.each(ROUTES)("/api/%s: its query orders through listOrderBy, the id last", (_r, _l, lib, fn, table) => {
    const src = read("src", "lib", lib, "queries.ts");
    const body = src.slice(src.indexOf(`export async function ${fn}(`));
    const head = body.slice(0, body.indexOf("\n}\n"));
    expect(head).toContain(`order?: ListOrder`);
    expect(head).toContain(`.orderBy(...listOrderBy(opts.order, { changed: changedAt(${table}.updatedAt, ${table}.createdAt) }, ${table}.id))`);
    expect(head).not.toMatch(/\.orderBy\(sql`greatest/);
  });
});

describe("the button on the four lists", () => {
  it("„Recente întâi” ⇄ „Vechi întâi”, Adrian's words, in both languages; „Interacțiuni”'s words untouched", () => {
    expect(ro.shared.sort.recent).toBe("Recente întâi");
    expect(ro.shared.sort.older).toBe("Vechi întâi");
    expect(en.shared.sort.recent).toBe("Recent first");
    expect(en.shared.sort.older).toBe("Older first");
    expect(ro.interactions.toolbar.newest).toBe("Cele mai noi întâi");
  });

  it("shows the order and flips it; its hover says what the order is by", () => {
    const onChange = jest.fn();
    const { rerender } = render(<ListSortButton order={DEFAULT_LIST_ORDER} onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Recente întâi" });
    expect(button).toHaveAttribute("data-sort-control", "");
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("lucide-arrow-down-wide-narrow");
    expect(document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent).toBe(ro.shared.sort.changedHint);
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({ sort: "changed", order: "asc" });
    rerender(<ListSortButton order={{ sort: "changed", order: "asc" }} onChange={onChange} />);
    const older = screen.getByRole("button", { name: "Vechi întâi" });
    expect(older.querySelector("svg")?.getAttribute("class")).toContain("lucide-arrow-up-narrow-wide");
    rerender(<ListSortButton order={{ sort: "dateOfBirth", order: "asc" }} onChange={onChange} columnName={() => "Născut pe"} />);
    expect(screen.getByRole("button", { name: "Ordonat după „Născut pe”" })).toBeInTheDocument();
  });

  const LISTS = ["natural-persons", "judicial-persons", "properties"] as const;
  it.each(LISTS)("%s: right after „Câmpuri afișate”, and the order in the address, the request and the query key", (dir) => {
    const src = read("src", "app", dir, "list-view.tsx");
    const chooser = src.indexOf("<FieldChooser");
    const button = src.indexOf("<ListSortButton order={listOrder} onChange={changeListOrder} />");
    expect(button).toBeGreaterThan(chooser);
    expect(src.slice(chooser, button).match(/<[A-Z]\w+/g)).toEqual(["<FieldChooser"]);
    expect(src).toMatch(/ORDER_KEYS\]/);
    expect(src).toContain("...orderAddressPatch(listOrder) }");
    expect(src).toContain("appendOrderParams(url.searchParams, order);");
    expect(src).toMatch(/filterSig, orderSig\]/);
    expect(src).toMatch(/function changeListOrder\(next: ListOrder\) \{\s+setListOrder\(next\);\s+setCurrentPage\(0\);/);
  });

  it("Acte: right after „Câmp specific”'s ⓘ, inside the group that never wraps apart — after „Tip document:” when no ⓘ is drawn", () => {
    const src = read("src", "app", "documents", "list-view.tsx");
    const group = src.slice(src.indexOf('data-filter-fixed=""'), src.indexOf('className="ml-auto flex shrink-0 items-center gap-2"'));
    const end = group.lastIndexOf("</HintBubble>");
    const button = group.indexOf("<ListSortButton order={listOrder} onChange={changeListOrder} />");
    expect(end).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(end);
    // Outside the `typeOptions.length > 0 &&` block, so it is drawn with no types too.
    expect(group.slice(end, button)).toMatch(/<\/div>\s+\)\}/);
    expect(src).toContain("const FILTER_KEYS = [...DOCUMENT_ADDRESS_FILTERS, ...DOCUMENT_FILTER_KEYS, ...ORDER_KEYS];");
    expect(src).toContain("...orderAddressPatch(listOrder),");
  });
});
