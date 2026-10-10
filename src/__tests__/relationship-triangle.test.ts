/**
 * Slice #38.62 — the relationship triangle above the lists of „Roluri și legături".
 *
 * Six relationships, each with a status; each configured one opens a list that exists; the tile
 * describes the code as it is — the tables and the role columns it names are held against the schema
 * dump — and #34.05's note moved into it, in Adrian's words.
 */
import fs from "node:fs";
import path from "node:path";

import { VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import { RELATIONSHIPS, isCorner, linksOfList, listOfLink, markedLinks } from "@/lib/admin/value-lists/relationships";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const SCHEMA = read("src/db/supabase_schema_full.sql");
const HUB = read("src/app/admin/value-lists/_components/value-list-hub.tsx");
const TILE = read("src/app/admin/value-lists/_components/relationship-triangle.tsx");
type Msg = { valueList: Record<string, unknown> & { triangle: Record<string, unknown> } };
const MSG = { ro: JSON.parse(read("messages/ro-RO.json")) as Msg, en: JSON.parse(read("messages/en-GB.json")) as Msg };
const tri = (l: "ro" | "en") => MSG[l].valueList.triangle as {
  relations: Record<string, { name: string; text: string; where: string }>;
  status: { configured: string; notConfigured: string };
  objects: Record<string, string>;
};

describe("the six relationships (#38.62)", () => {
  it("are three corners and three sides, one for every pair of the three objects", () => {
    expect(RELATIONSHIPS).toHaveLength(6);
    expect(RELATIONSHIPS.filter(isCorner).map((r) => r.ends[0])).toEqual(["person", "property", "document"]);
    const pairs = RELATIONSHIPS.filter((r) => !isCorner(r)).map((r) => [...r.ends].sort().join("+"));
    expect(pairs.sort()).toEqual(["document+person", "document+property", "person+property"]);
  });

  it("each say whether they are configured; only Document – Proprietate is not, and it opens nothing", () => {
    expect(RELATIONSHIPS.map((r) => [r.id, r.configured])).toEqual([
      ["personPerson", true], ["propertyProperty", true], ["documentDocument", true],
      ["personProperty", true], ["personDocument", true], ["documentProperty", false],
    ]);
    for (const r of RELATIONSHIPS) expect([r.id, r.list === null]).toEqual([r.id, !r.configured]);
  });

  it("each configured one opens a list that exists", () => {
    for (const r of RELATIONSHIPS.filter((x) => x.list !== null)) {
      expect([r.id, (VALID_LIST_KEYS as readonly string[]).includes(r.list as string)]).toEqual([r.id, true]);
    }
    expect(RELATIONSHIPS.find((r) => r.id === "propertyProperty")?.list).toBe("property-property-roles");
    expect(RELATIONSHIPS.find((r) => r.id === "documentDocument")?.list).toBe("document-document-roles");
  });

  it("name tables that exist — and the one with no role has no role column", () => {
    for (const r of RELATIONSHIPS) expect([r.id, SCHEMA.includes(`CREATE TABLE public.${r.table} (`)]).toEqual([r.id, true]);
    const pd = SCHEMA.slice(SCHEMA.indexOf("CREATE TABLE public.property_document ("));
    expect(/role/.test(pd.slice(0, pd.indexOf(");")))).toBe(false);
  });

  it("match the role list's two flags: „Persoană → Persoană” is valid_for_person, „Persoană → Proprietate” valid_for_property", () => {
    const role = SCHEMA.slice(SCHEMA.indexOf("CREATE TABLE public.lookup_person_role ("));
    const cols = role.slice(0, role.indexOf(");"));
    expect(cols).toContain("valid_for_person boolean");
    expect(cols).toContain("valid_for_property boolean");
    expect(cols).not.toContain("valid_for_document");
  });
});

describe("the six texts (#38.62)", () => {
  it.each(["ro", "en"] as const)("%s: a name, a text and a where for each, and both statuses", (l) => {
    for (const r of RELATIONSHIPS) {
      const e = tri(l).relations[r.id];
      expect([l, r.id, typeof e?.name, typeof e?.text, typeof e?.where]).toEqual([l, r.id, "string", "string", "string"]);
    }
    expect(Object.keys(tri(l).relations).sort()).toEqual(RELATIONSHIPS.map((r) => r.id).sort());
    expect(Object.keys(tri(l).objects).sort()).toEqual(["document", "person", "property"]);
  });

  it("say the status in words", () => {
    expect(tri("ro").status).toEqual({ configured: "configurat în aplicație", notConfigured: "neconfigurat, intenționat" });
    expect(tri("en").status).toEqual({ configured: "configured in the application", notConfigured: "not configured, by design" });
    expect(TILE).toContain('t(r.configured ? "triangle.status.configured" : "triangle.status.notConfigured")');
    // …and the drawing does not rely on colour either: the side that is not configured is dashed.
    expect(TILE).toContain('strokeDasharray={r.configured ? undefined : "6 5"}');
  });

  it("carry #34.05's note as Document – Proprietate's text, in Adrian's words", () => {
    expect(tri("ro").relations.documentProperty.text).toBe(
      "Nu există o listă „Document → Proprietate”: relația dintre un document și o proprietate este definită de tipul documentului (de exemplu: plan cadastral, extras de carte funciară). Nu este necesară configurarea separată a unui tip de relație.",
    );
    expect(tri("en").relations.documentProperty.text).toContain("There is no “Document → Property” list");
  });

  it("say that Persoană – Document has no column in the roles list", () => {
    expect(tri("ro").relations.personDocument.where).toContain("Nu are o coloană în lista „Roluri Persoane”");
    expect(tri("en").relations.personDocument.where).toContain("No column in the “Person Roles” list");
  });
});

describe("the tile on the page (#38.62)", () => {
  it("is drawn above every list of „Roluri și legături” (Ask first #1), and the old note is gone", () => {
    expect(HUB).toContain('categoryOfList(selected) === "rolesLinks" && (');
    expect(HUB).toContain("<RelationshipTriangle");
    expect(HUB).not.toContain("rolesObjectNote");
    for (const m of [MSG.ro, MSG.en]) expect(m.valueList.sections).toBeUndefined();
  });

  // #38.62 pinned `onOpen={open}` and `press(e, r.list as ListKey)`: a press opened the list and nothing else.
  // #38.68: a press is a link (`pressLink`) — marked in yellow in four places — and still opens its list through `open`.
  it("opens a list from a corner or side through the page's own `open` (Ask first #2)", () => {
    expect(HUB).toContain("onPress={pressLink}");
    expect(HUB).toMatch(/function pressLink\(id: RelationshipId\) \{\s*const list = listOfLink\(id\);\s*setPressed\(\{ id, on: list \?\? selected \}\);\s*if \(list !== null\) open\(list\);\s*\}/);
    expect(TILE).toContain("onClick={(e) => press(e, r.id)}");
    expect(TILE).toContain("href={`/admin/value-lists?list=${r.list}`}");
  });
});

describe("the tile's layout (Slice #38.67)", () => {
  it("draws one unit to one pixel, about 20 % smaller than #38.62's 416 px, the words not under 12 px", () => {
    expect(TILE).toContain("viewBox={`0 0 ${DRAWING.w} ${DRAWING.h}`}");
    expect(TILE).toContain("style={{ width: rem(DRAWING.w / 16) }}");
    expect(TILE).not.toContain("w-[26rem]");
    // 94 + 146 + 94: Proprietate's centre, the side, Document's margin — every coordinate comes from the constants.
    expect(TILE).toMatch(/const SIDE = 146;/);
    expect(TILE).toMatch(/const BOX = \{ w: 96, h: 32 \};/);
    const w = 2 * (1 + 11 + 34 + 96 / 2) + 146;
    expect(w).toBe(334);
    expect(1 - w / 416).toBeGreaterThan(0.17);
    expect(1 - w / 416).toBeLessThan(0.23);
    expect(TILE).toContain("fontSize={13} fontWeight={600}");
    expect(TILE).toContain("fontSize={12} fontWeight={600}");
    expect(TILE).not.toMatch(/fontSize=\{(?:[0-9]|1[01])\}/);
  });

  it("puts the title over the drawing, in a column as wide as it, and no full-width divider under the title", () => {
    const column = TILE.slice(TILE.indexOf('data-triangle-column=""'), TILE.indexOf("</svg>"));
    expect(column).toContain('<div style={{ width: rem(DRAWING.w / 16) }} data-triangle-heading="">');
    expect(column.indexOf('t("triangle.title")')).toBeLessThan(column.indexOf("<svg"));
    expect(TILE).not.toContain('className="border-b border-card-rim px-5 py-4');
  });

  it("puts the six beside the column from the top, a full-height divider between — and under it, a horizontal one, when they wrap", () => {
    expect(TILE).toContain('className="@container rounded-xl');
    expect(TILE).toContain('<div className="flex flex-col @min-[42rem]:flex-row">');
    const ol = TILE.slice(TILE.indexOf("<ol"), TILE.indexOf('data-triangle-list=""'));
    for (const c of ["border-t", "@min-[42rem]:border-t-0", "@min-[42rem]:border-l", "@min-[42rem]:pt-1.5", "min-w-[18rem]", "flex-1"]) expect(ol).toContain(c);
  });
});

describe("one link, marked in four places (Slice #38.68)", () => {
  it("maps each list to its links and each link to its list — all six; 6 to none", () => {
    expect(linksOfList("person-roles")).toEqual(["personPerson", "personProperty", "personDocument"]);
    expect(linksOfList("property-property-roles")).toEqual(["propertyProperty"]);
    expect(linksOfList("document-document-roles")).toEqual(["documentDocument"]);
    expect(linksOfList("citizenships")).toEqual([]);
    expect(linksOfList(null)).toEqual([]);
    expect(RELATIONSHIPS.map((r) => [r.id, listOfLink(r.id)])).toEqual([
      ["personPerson", "person-roles"],
      ["propertyProperty", "property-property-roles"],
      ["documentDocument", "document-document-roles"],
      ["personProperty", "person-roles"],
      ["personDocument", "person-roles"],
      ["documentProperty", null],
    ]);
  });

  it("a list chosen marks every link it configures, and itself (Ask first #1)", () => {
    expect(markedLinks("person-roles", null)).toEqual({ links: ["personPerson", "personProperty", "personDocument"], list: "person-roles" });
    expect(markedLinks("document-document-roles", null)).toEqual({ links: ["documentDocument"], list: "document-document-roles" });
    // A list outside the group marks nothing.
    expect(markedLinks("citizenships", null)).toEqual({ links: [], list: null });
  });

  it("a link pressed marks that link only, and its list (Ask first #2)", () => {
    expect(markedLinks("person-roles", { id: "personProperty", on: "person-roles" })).toEqual({ links: ["personProperty"], list: "person-roles" });
  });

  it("6 marks alone, the open list unmarked (Ask first #3)", () => {
    expect(markedLinks("person-roles", { id: "documentProperty", on: "person-roles" })).toEqual({ links: ["documentProperty"], list: null });
  });

  it("a press counts only while its list is open — Back or the column fall back to the list's set (Ask first #4)", () => {
    expect(markedLinks("property-property-roles", { id: "personProperty", on: "person-roles" })).toEqual({ links: ["propertyProperty"], list: "property-property-roles" });
  });

  it("the column's chosen list in „Roluri și legături” is the yellow, the other groups keep the navy", () => {
    expect(HUB).toContain('const linkGroup = category.id === "rolesLinks";');
    expect(HUB).toContain("const marked = linkGroup && key === marking.list;");
    expect(HUB).toMatch(/marked\s*\? LINK_MARK_BOX\s*: current && !linkGroup\s*\? "bg-cta font-medium text-white"/);
    expect(HUB).toContain("titleMarked={marking.list === selected}");
  });

  it("is #facc15 with #111827 text and rim — the side-road calculation's yellow — and says itself without colour too", () => {
    const mark = read("src/lib/ui/link-mark.ts");
    expect(mark).toContain('export const LINK_MARK_FILL = "#facc15";');
    expect(mark).toContain('export const LINK_MARK_INK = "#111827";');
    expect(read("src/app/admin/calculation/_components/preview-map.tsx")).toContain('"#facc15"');
    expect(TILE).toContain('aria-current={on ? "true" : undefined}');
    expect(TILE).toContain("aria-pressed={on}");
    expect(TILE).toContain('aria-current={isMarked(r) ? "true" : undefined}');
    expect(read("src/app/admin/value-lists/_components/value-list-modal.tsx")).toContain('aria-current={titleMarked ? "true" : undefined}');
  });
});


describe("notes 5 and 6 in magenta, each with an ⓘ (Slice #38.69)", () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it("reads at 4.5 : 1 or more on the card, light and dark", () => {
    expect(TILE).toContain('export const NOTE_MAGENTA = { light: "#a21caf", dark: "#f0abfc" } as const;');
    expect(TILE).toContain('const NOTE_MAGENTA_CLASS = "text-[#a21caf] dark:text-[#f0abfc]";');
    expect(read("src/app/globals.css")).toContain("--color-card:      #EEF4FA;");
    expect(contrast("#a21caf", "#EEF4FA")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#f0abfc", "#18181b")).toBeGreaterThanOrEqual(4.5); // zinc-900, the card in dark mode
  });

  it("only 5's and 6's notes are magenta and italic; their words did not change", () => {
    expect(TILE).toContain('const INFO_NOTES: readonly RelationshipId[] = ["personDocument", "documentProperty"];');
    expect(TILE).toContain("<div className={`text-xs italic leading-relaxed ${NOTE_MAGENTA_CLASS}`} data-note={r.id}>");
    expect(tri("ro").relations.personDocument.where).toBe("Nu are o coloană în lista „Roluri Persoane”: se configurează pe fiecare rol, la „Act”, sau pe pagina tipului de document.");
    expect(tri("ro").relations.documentProperty.where).toBe("Nicio listă: tipul documentului spune ce înseamnă legătura.");
  });

  it("every ⓘ has its label and three steps in both languages, and the lists they name are links", () => {
    for (const l of ["ro", "en"] as const) {
      const info = (MSG[l].valueList.triangle as unknown as { info: Record<string, Record<string, string>> }).info;
      expect(Object.keys(info)).toEqual(["personDocument", "documentProperty"]);
      for (const id of Object.keys(info)) expect(Object.keys(info[id])).toEqual(["label", "s1", "s2", "s3"]);
      expect(info.personDocument.s1).toMatch(/<roles>[^<]+<\/roles>/);
      expect(info.personDocument.s2).toMatch(/<types>[^<]+<\/types>/);
      expect(info.documentProperty.s1).toMatch(/<types>[^<]+<\/types>/);
    }
    expect(TILE).toContain('{ roles: listLink("person-roles"), types: listLink("document-types") }');
    expect(HUB).toContain("onOpenList={chooseList}");
  });

  it("the ⓘ is a real button: named, a press outside or Esc closes it (`usePressAway`)", () => {
    const info = read("src/lib/ui/info-press.tsx");
    expect(info).toContain("aria-label={label}");
    expect(info).toContain("aria-expanded={open}");
    expect(info).toContain("usePressAway<HTMLSpanElement>(open, (how) => {");
    expect(info).toContain('if (how === "escape") button.current?.focus();');
    expect(info).toContain('className={buttonClass({ variant: "ghost", size: "xs", pill: true');
  });
});
