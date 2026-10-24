/**
 * Slice 40.45 — „Adăugat la" in „Câmpuri afișate" on Persoane fizice, Persoane juridice and Proprietăți, exactly as
 * Acte's chooser has offered it since #37.62: the same key, the same width, the same cell, offered last, ticked by
 * nobody by default, and one of the four a list shows at once.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addedOn } from "@/lib/persons/person-age";
import { LIST_COLUMN_CHOICE } from "@/lib/ui/list-columns";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const keysOf = (src: string): string[] => [...src.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);

const LISTS = [
  ["natural-persons", "naturalPerson", "person"],
  ["judicial-persons", "judicialPerson", "company"],
  ["properties", "property", "property"],
] as const;

describe("addedOn — the day a record was added, dd.mm.yyyy in the reader's time zone", () => {
  it("formats a local time as its own day", () => {
    // No zone in the string, so it is read as the reader's local time, whatever zone the run is in.
    expect(addedOn("2026-03-05T23:30:00")).toBe("05.03.2026");
    expect(addedOn("2026-12-31T00:00:00")).toBe("31.12.2026");
  });

  it("takes a UTC timestamp's day in the reader's zone, not the ISO digits", () => {
    const iso = "2026-10-24T03:30:00.000Z";
    const d = new Date(iso);
    const local = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    expect(addedOn(iso)).toBe(local);
  });

  it("is empty for a value that is not a time", () => {
    expect(addedOn("")).toBe("");
    expect(addedOn("not a date")).toBe("");
  });

  it("is the one helper: Acte imports it and keeps no copy of its own", () => {
    const docs = read("src", "app", "documents", "list-view.tsx");
    expect(docs).toContain('import { addedOn, dmyFromIso } from "@/lib/persons/person-age";');
    expect(docs).not.toMatch(/function addedOn\(/);
    expect(docs).toMatch(/case "createdAt":\s+return addedOn\(item\.createdAt\);/);
  });
});

describe("„Adăugat la” on the three lists that lacked it (40.45)", () => {
  it.each(LISTS)("%s offers it last, its whole name its short one, Acte's width", (dir) => {
    const src = read("src", "app", dir, "list-view.tsx");
    const keys = keysOf(src);
    expect(keys[keys.length - 1]).toBe("createdAt");
    expect(src).toMatch(/\{ key: "createdAt",\s+label: tHead\("createdAt"\), full: tHead\("createdAt"\),\s+column: "listDate" \}/);
    expect(src).toMatch(/import \{ [^}]*\baddedOn\b[^}]*\} from "@\/lib\/persons\/person-age";/);
    expect(src).toMatch(/(case "createdAt":\s+return|key === "createdAt" \?) addedOn\(item\.createdAt\)/);
    expect(src).toMatch(/const MAX_OPT\s+= 4;/);
    expect(src).toMatch(/createdAt:\s+string;/); // the list's items already carry it (the „Nou!" badge reads it)
  });

  it.each(LISTS)("%s: no browser opens with it ticked — the defaults did not change", (_dir, _ns, choice) => {
    expect(LIST_COLUMN_CHOICE[choice].defaults).not.toContain("createdAt");
  });

  it.each(LISTS)("%s: „Adăugat la” / „Added on”, as on Acte", (_dir, ns) => {
    const roNs = (ro as unknown as Record<string, { listHeads: Record<string, string> }>)[ns];
    const enNs = (en as unknown as Record<string, { listHeads: Record<string, string> }>)[ns];
    expect(roNs.listHeads.createdAt).toBe(ro.document.listHeads.createdAt);
    expect(roNs.listHeads.createdAt).toBe("Adăugat la");
    expect(enNs.listHeads.createdAt).toBe("Added on");
  });
});
