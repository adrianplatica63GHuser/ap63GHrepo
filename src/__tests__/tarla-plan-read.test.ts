/**
 * A plan parcelar, read and proposed.                                                            (Slice #39.69)
 *
 * The pure part (src/lib/tarla/plan-read.ts): what the model's answer becomes — the code without its word, the place
 * without „UAT", areas from the ways a plan prints them, parcels once each, owners never — and the proposal: link to
 * the tarla that has the code in that locality, else create, nothing without a code. The files part: the general
 * read's prompt is untouched (its own call), and migration_113, the schema and the repair file agree.
 */
import fs from "fs";
import path from "path";
import {
  buildTarlaPlanRequestBody,
  buildTarlaPlanSystemPrompt,
  cleanPlace,
  cleanTarlaCode,
  matchUseCategory,
  parseAreaSqm,
  parseTarlaPlanReading,
  tarlaPlanProposal,
  TARLA_PLAN_MAX_PARCELS,
} from "@/lib/tarla/plan-read";
import { tarlaPlanRowNote } from "@/lib/tarla/plan-step";

describe("the model's answer", () => {
  it("keeps the code without the word, the place without its kind", () => {
    expect(cleanTarlaCode("Tarla 52")).toBe("52");
    expect(cleanTarlaCode("T 47/2")).toBe("47/2");
    expect(cleanTarlaCode("sola nr. 3")).toBe("3");
    expect(cleanTarlaCode(40)).toBe("40");
    expect(cleanTarlaCode("T52")).toBe("52");
    expect(cleanTarlaCode("TCP9")).toBe("TCP9");
    expect(cleanTarlaCode("Tarla TCP9")).toBe("TCP9");
    expect(cleanTarlaCode("  ")).toBeNull();
    expect(cleanPlace("UAT Bragadiru")).toBe("Bragadiru");
    expect(cleanPlace("comuna Cornetu")).toBe("Cornetu");
    expect(cleanPlace("jud. Ilfov")).toBe("Ilfov");
    expect(cleanPlace("Bragadiru")).toBe("Bragadiru");
  });

  it.each([
    [1234.5, 1234.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234.56", 1234.56],
    ["1.234", 1234],
    ["1 234 mp", 1234],
    ["0,5 ha", 5000],
    ["0.25 ha", 2500],
    ["2500", 2500],
    ["—", null],
    [0, null],
    [-3, null],
    [null, null],
  ] as const)("reads the area %p as %p m²", (raw, m2) => {
    expect(parseAreaSqm(raw)).toBe(m2);
  });

  it("keeps each parcel once, counts the unreadable ones, and drops every key it does not know", () => {
    const r = parseTarlaPlanReading({
      locality: "UAT Testeni",
      county: "jud. Exemplu",
      tarla: "Tarla TCP9",
      parcels: [
        { parcela: "1", areaSqm: 2500, use: "Arabil", owner: "POPESCU ION", cnp: "1800101000000" },
        { parcela: "2", areaSqm: "0,5 ha", use: null },
        { parcela: "1", areaSqm: 99, use: "Vie" },
        { parcela: null, areaSqm: 10 },
        { parcela: "3", areaSqm: "?" },
      ],
      illegibleParcels: 2,
      unread: ["suprafața parcelei 3", 7],
      owners: ["POPESCU ION"],
    });
    expect(r).toEqual({
      locality: "Testeni",
      county: "Exemplu",
      tarla: "TCP9",
      parcels: [
        { parcela: "1", areaSqm: 2500, use: "Arabil" },
        { parcela: "2", areaSqm: 5000, use: null },
        { parcela: "3", areaSqm: null, use: null },
      ],
      illegibleParcels: 3,
      unread: ["suprafața parcelei 3", "7"],
      duplicatesDropped: 1,
    });
    expect(JSON.stringify(r)).not.toMatch(/POPESCU|1800101000000|owner|cnp/i);
  });

  it("is null for anything but the object asked for, and empty for a document that is not a plan", () => {
    expect(parseTarlaPlanReading(null)).toBeNull();
    expect(parseTarlaPlanReading([])).toBeNull();
    expect(parseTarlaPlanReading("plan")).toBeNull();
    expect(parseTarlaPlanReading({ locality: null, county: null, tarla: null, parcels: [], illegibleParcels: 0, unread: [] })).toEqual({
      locality: null, county: null, tarla: null, parcels: [], illegibleParcels: 0, unread: [], duplicatesDropped: 0,
    });
  });

  it(`keeps at most ${TARLA_PLAN_MAX_PARCELS} parcels`, () => {
    const many = Array.from({ length: TARLA_PLAN_MAX_PARCELS + 5 }, (_, i) => ({ parcela: String(i + 1), areaSqm: 10 }));
    const r = parseTarlaPlanReading({ tarla: "1", parcels: many })!;
    expect(r.parcels).toHaveLength(TARLA_PLAN_MAX_PARCELS);
    expect(r.duplicatesDropped).toBe(5);
  });
});

describe("the proposal", () => {
  const TARLALE = [
    { id: "a", indicativ: "52", locality: "Bragadiru" },
    { id: "b", indicativ: "52", locality: "Cornetu" },
    { id: "c", indicativ: "T9", locality: null },
  ];

  it("links to the tarla with the code in that locality, folded as the index folds", () => {
    expect(tarlaPlanProposal("52", "bragadiru", TARLALE)).toEqual({ action: "link", tarla: TARLALE[0] });
    expect(tarlaPlanProposal("52", "Cornetu", TARLALE)).toEqual({ action: "link", tarla: TARLALE[1] });
    expect(tarlaPlanProposal("t9", null, TARLALE)).toEqual({ action: "link", tarla: TARLALE[2] });
  });

  it("creates when the code is new in that locality, and does nothing without a code", () => {
    expect(tarlaPlanProposal("52", "Clinceni", TARLALE)).toEqual({ action: "create" });
    expect(tarlaPlanProposal("53", "Bragadiru", TARLALE)).toEqual({ action: "create" });
    expect(tarlaPlanProposal(null, "Bragadiru", TARLALE)).toEqual({ action: "none" });
    expect(tarlaPlanProposal("  ", "Bragadiru", TARLALE)).toEqual({ action: "none" });
  });

  it("matches a printed use to its category by its folded name, else keeps none", () => {
    const cats = [{ id: "u1", name: "Arabil" }, { id: "u2", name: "Pășune" }];
    expect(matchUseCategory("arabil", cats)).toBe("u1");
    expect(matchUseCategory("Pasune", cats)).toBe("u2");
    expect(matchUseCategory("Neproductiv", cats)).toBeNull();
    expect(matchUseCategory(null, cats)).toBeNull();
  });

  it("gives the row one sentence for each outcome", () => {
    expect(tarlaPlanRowNote(undefined)).toBeNull();
    expect(tarlaPlanRowNote({ status: "pending", code: "52" })).toEqual({ key: "tarlaPlanPending", values: { code: "52" } });
    expect(tarlaPlanRowNote({ status: "created", code: "52", tarlaId: "a", parcelsAdded: 3 })).toEqual({
      key: "tarlaPlanCreated", values: { code: "52", count: 3 },
    });
    expect(tarlaPlanRowNote({ status: "failed", reason: "HTTP 500" })?.key).toBe("tarlaPlanFailed");
  });
});

describe("the read and the files", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

  it("asks for no owners, and sends the pages with the plan prompt", () => {
    const prompt = buildTarlaPlanSystemPrompt();
    expect(prompt).toMatch(/Do NOT return owners' names/);
    const body = buildTarlaPlanRequestBody([{ type: "text", text: "page" }]) as { system: string; messages: { content: unknown[] }[] };
    expect(body.system).toBe(prompt);
    expect(body.messages[0].content).toHaveLength(2);
  });

  it("is its own call: the general read's prompt says nothing about parcels", () => {
    expect(read("src", "lib", "import", "classify-prompts.ts")).not.toMatch(/illegibleParcels|areaSqm/);
    expect(read("src", "app", "api", "documents", "[id]", "ai-interpret", "route.ts")).not.toMatch(/tarla-plan|plan-read/);
  });

  it("refuses any document that is not a plan before it pays for a read", () => {
    const route = read("src", "app", "api", "documents", "[id]", "tarla-plan", "route.ts");
    expect(route.indexOf("not_a_plan")).toBeGreaterThan(-1);
    expect(route.indexOf("not_a_plan")).toBeLessThan(route.indexOf("callAnthropic("));
  });

  it("migration_113, the schema and the repair file declare the same two tables", () => {
    const migration = read("src", "db", "migration_113_tarla_parcels_and_plans.sql");
    const repair = read("src", "db", "supabase_repair_missing_tables.sql");
    const schema = read("src", "db", "schema", "index.ts");
    for (const sqlText of [migration, repair]) {
      expect(sqlText).toContain("CREATE TABLE IF NOT EXISTS tarla_parcel (");
      expect(sqlText).toContain("CREATE TABLE IF NOT EXISTS document_tarla (");
      expect(sqlText).toContain("tarla_parcel_tarla_parcela_folded_unique");
    }
    expect(schema).toMatch(/export const tarlaParcel = pgTable\(\s*"tarla_parcel"/);
    expect(schema).toMatch(/export const documentTarla = pgTable\(\s*"document_tarla"/);
    expect(migration).not.toMatch(/^\s+(owner|proprietar)\w*\s/im); // no owner column
  });
});
