/**
 * Slice 40.55 — „Modificat la” in „Câmpuri afișate” on the four principal lists.
 *
 * Adrian, 2026-10-24: „I have made a mistake by asking you to add the field "added on" to the field chooser; The
 * field I was looking for was "Last Modified On" and the label can be shorter: "modified on"". So on Persoane fizice,
 * Persoane juridice and Proprietăți it takes the place 40.45 gave „Adăugat la”, and Acte — whose „Adăugat la” is
 * #37.62's and stays — offers it too. Its key is the default order's (`changed`): the cell shows the day the list is
 * ordered by — the later of `createdAt` and `updatedAt`, as `changedAt` sorts — and its sort icon is that order's.
 * This file was added-on-field.test.ts (40.45); its „Adăugat la” assertions are inverted here, the old ones quoted.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addedOn, modifiedOn } from "@/lib/persons/person-age";
import { CHANGED, LIST_SORTS, MODIFIED_ON } from "@/lib/list/list-order";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const keysOf = (src: string): string[] => [...src.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
const day = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/** The three lists 40.45 gave „Adăugat la”, and Acte. */
const LISTS = [
  ["natural-persons", "naturalPerson", "person"],
  ["judicial-persons", "judicialPerson", "company"],
  ["properties", "property", "property"],
  ["documents", "document", "document"],
] as const;
const THREE = LISTS.slice(0, 3);

describe("addedOn — the day a record was added, dd.mm.yyyy in the reader's time zone (Acte's „Adăugat la”)", () => {
  it("formats a local time as its own day", () => {
    // No zone in the string, so it is read as the reader's local time, whatever zone the run is in.
    expect(addedOn("2026-03-05T23:30:00")).toBe("05.03.2026");
    expect(addedOn("2026-12-31T00:00:00")).toBe("31.12.2026");
  });

  it("takes a UTC timestamp's day in the reader's zone, not the ISO digits", () => {
    const iso = "2026-10-24T03:30:00.000Z";
    expect(addedOn(iso)).toBe(day(iso));
  });

  it("is empty for a value that is not a time", () => {
    expect(addedOn("")).toBe("");
    expect(addedOn("not a date")).toBe("");
  });
});

describe("modifiedOn — the day of the last change, its adding counting as one (40.55)", () => {
  it("is the later of the two days", () => {
    expect(modifiedOn("2026-03-05T10:00:00", "2026-10-24T09:00:00")).toBe("24.10.2026");
    // An update older than the row (a clock moved, a restore) does not win: the order takes the greatest too.
    expect(modifiedOn("2026-10-24T09:00:00", "2026-03-05T10:00:00")).toBe("24.10.2026");
  });

  it("is the adding's day when the record was never changed", () => {
    expect(modifiedOn("2026-03-05T10:00:00", null)).toBe("05.03.2026");
    expect(modifiedOn("2026-03-05T10:00:00", undefined)).toBe("05.03.2026");
    expect(modifiedOn("2026-03-05T10:00:00", "")).toBe("05.03.2026");
  });

  it("is the reader's day of a UTC timestamp", () => {
    const iso = "2026-10-24T03:30:00.000Z";
    expect(modifiedOn("2026-01-01T00:00:00.000Z", iso)).toBe(day(iso));
  });

  it("is empty when neither is a time", () => {
    expect(modifiedOn("", null)).toBe("");
    expect(modifiedOn("not a date", "nor this")).toBe("");
  });

  it("is what the default order sorts by — greatest(updatedAt, createdAt)", () => {
    expect(read("src", "lib", "list", "order-sql.ts")).toContain("return sql`greatest(${updatedAt}, ${createdAt})`;");
    expect(MODIFIED_ON).toBe(CHANGED);
  });
});

describe("„Modificat la” on the four lists (40.55)", () => {
  it.each(LISTS)("%s offers it, its whole name its short one, the date's width, the day of the last change", (dir, ns) => {
    const src = read("src", "app", dir, "list-view.tsx");
    const keys = keysOf(src);
    expect(keys[keys.length - 1]).toBe("changed");
    const full = ns === "document" ? 't\\("table\\.changed"\\)' : 'tHead\\("changed"\\)';
    expect(src).toMatch(new RegExp(`\\{ key: "changed",\\s+label: tHead\\("changed"\\), full: ${full},\\s+column: "listDate" \\}`));
    expect(src).toMatch(/import \{ [^}]*\bmodifiedOn\b[^}]*\} from "@\/lib\/persons\/person-age";/);
    expect(src).toMatch(/(case "changed":\s+return|key === "changed" \?) modifiedOn\(item\.createdAt, item\.updatedAt\)/);
    expect(src).toMatch(/const MAX_OPT\s+= 4;/);
    expect(src).toMatch(/updatedAt:\s+string;/); // the list's items already carry it (the „Nou!” badge reads it)
  });

  it.each(LISTS)("%s: its sort icon is the default order's — `changed` is the list's first sort", (_dir, _ns, list) => {
    expect(LIST_SORTS[list][0]).toBe(CHANGED);
  });

  // 40.45 read: `expect(keys[keys.length - 1]).toBe("createdAt")` and `{ key: "createdAt", label: tHead("createdAt"),
  // full: tHead("createdAt"), column: "listDate" }` on these three — „Adăugat la”, the field asked for by mistake.
  it.each(THREE)("%s: „Adăugat la” is gone from its chooser, and from its sorts", (dir, _ns, list) => {
    const src = read("src", "app", dir, "list-view.tsx");
    expect(keysOf(src)).not.toContain("createdAt");
    expect(src).not.toMatch(/\baddedOn\b/);
    expect([...LIST_SORTS[list]]).not.toContain("createdAt");
  });

  it("Acte keeps its own „Adăugat la” (#37.62), just before „Modificat la”, and still sorts by it", () => {
    const keys = keysOf(read("src", "app", "documents", "list-view.tsx"));
    expect(keys.slice(-2)).toEqual(["createdAt", "changed"]);
    expect([...LIST_SORTS.document]).toContain("createdAt");
  });

  it.each(LISTS)("%s: no browser opens with it ticked — the defaults did not change", (_dir, _ns, choice) => {
    expect(LIST_COLUMN_CHOICE[choice].defaults).not.toContain("changed");
  });

  it.each(LISTS)("%s: „Modificat la” / „Modified on”", (_dir, ns) => {
    const roNs = (ro as unknown as Record<string, { listHeads: Record<string, string> }>)[ns];
    const enNs = (en as unknown as Record<string, { listHeads: Record<string, string> }>)[ns];
    expect(roNs.listHeads.changed).toBe("Modificat la");
    expect(enNs.listHeads.changed).toBe("Modified on");
  });

  // 40.45 read: `expect(roNs.listHeads.createdAt).toBe("Adăugat la")` on the three — the key is gone from them.
  it.each(THREE)("%s: no „Adăugat la” short name left", (_dir, ns) => {
    const roNs = (ro as unknown as Record<string, { listHeads: Record<string, string> }>)[ns];
    expect(roNs.listHeads).not.toHaveProperty("createdAt");
  });

  it("Acte's whole name for it is in its table's labels, beside „Adăugat la”", () => {
    expect(ro.document.table.changed).toBe("Modificat la");
    expect(en.document.table.changed).toBe("Modified on");
    expect(ro.document.table.createdAt).toBe("Adăugat la");
  });
});
