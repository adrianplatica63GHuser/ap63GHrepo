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
import { RELATIONSHIPS, isCorner } from "@/lib/admin/value-lists/relationships";

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

  it("opens a list from a corner or side through the page's own `open` (Ask first #2)", () => {
    expect(HUB).toContain("onOpen={open}");
    expect(TILE).toContain("onClick={(e) => press(e, r.list as ListKey)}");
    expect(TILE).toContain("href={`/admin/value-lists?list=${r.list}`}");
  });
});
