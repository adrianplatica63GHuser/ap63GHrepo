/**
 * The „Contract de Vânzare" and „Act Adițional" forms.          (Slice #36.01)
 *
 * WHAT THIS FILE IS FOR
 * ---------------------
 * The two templates are DATA — JSON arrays on two `lookup_document_type` rows
 * — and they ship in two files at once: `migration_085_seed_cvc_templates.sql`
 * for a database migrated forward, `src/db/sync-reference-data.sql` for one
 * rebuilt from scratch. That duplication is deliberate (a template typed into
 * Reference Data exists only in Adrian's database, and `Verify-Rebuild.ps1`
 * would never see it) and it is exactly the shape this project has been caught
 * by before: one list written twice, drifting quietly. So the first thing
 * asserted here is that the two copies are identical.
 *
 * The rest are the rules #36.01 was written to enforce, and every one of them
 * is a rule some earlier attempt broke:
 *
 *  - **Labels are short official terms, not sentence fragments.** Finding F5 of
 *    the #29.01 import report: a form discovered from ONE deed produced
 *    `pretul_vanzarii_este_de`, `s_a_taxat_cu`, `din_totalul_de`. The guards
 *    `looksLikeSentenceFragment` and `nameTooLongForKey` came out of it; here
 *    they are pointed at the hand-authored labels as well.
 *  - **An `aiHint` is a shape example, never one document's data.** The same
 *    finding: hints carrying one parcel's tarla, parcela, area and sale price
 *    onto a type every future contract would share.
 *  - **Sixty stays sixty.** Every field is a prompt line on every document of
 *    the type forever, and the notebook solves page height, not prompt cost.
 *    The two are not interchangeable.
 *
 * Both SQL files are parsed rather than a shared fixture being imported,
 * because the files ARE the deliverable: a test that read a TypeScript copy of
 * the template would stay green while the thing that actually reaches the
 * database drifted.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MAX_TEMPLATE_FIELDS,
  looksLikeSentenceFragment,
} from "@/lib/documents/discover-to-template";
import {
  parseTemplateFields,
  type DocumentTemplateField,
} from "@/lib/documents/template-fields";
import { isFeesGroup, isFinancialGroup } from "@/lib/documents/template-groups";
import { templateTabsOf } from "@/lib/documents/template-tabs";
import { documentTypeSchema } from "@/lib/admin/value-lists/validation";

const DB = join(process.cwd(), "src", "db");

/**
 * Pull one dollar-quoted JSON array out of a .sql file.
 *
 * Both files write the templates as `$cvc$ … $cvc$::jsonb` / `$act$ … $act$`,
 * which is what keeps Romanian quotation marks and apostrophes out of the
 * escaping business entirely.
 */
function templateFromSql(file: string, tag: "cvc" | "act"): unknown {
  const sql = readFileSync(join(DB, file), "utf8");
  const open = `$${tag}$`;
  const from = sql.indexOf(open);
  expect(from).toBeGreaterThan(-1);
  const to = sql.indexOf(open, from + open.length);
  expect(to).toBeGreaterThan(from);
  return JSON.parse(sql.slice(from + open.length, to));
}

const MIGRATION = "migration_085_seed_cvc_templates.sql";
const SEED = "sync-reference-data.sql";

const cvcRaw = templateFromSql(MIGRATION, "cvc");
const actRaw = templateFromSql(MIGRATION, "act");
const cvc = parseTemplateFields(cvcRaw);
const act = parseTemplateFields(actRaw);

describe("the migration and the rebuild seed carry the same two forms", () => {
  it("writes CONTRACT_VANZARE identically in both files", () => {
    expect(templateFromSql(SEED, "cvc")).toEqual(cvcRaw);
  });

  it("writes ACT_ADITIONAL identically in both files", () => {
    expect(templateFromSql(SEED, "act")).toEqual(actRaw);
  });

  it("targets the two type keys by key, in both files", () => {
    for (const file of [MIGRATION, SEED]) {
      const sql = readFileSync(join(DB, file), "utf8");
      expect(sql).toContain("WHERE key = 'CONTRACT_VANZARE'");
      expect(sql).toContain("WHERE key = 'ACT_ADITIONAL'");
    }
  });
});

describe.each([
  ["Contract de Vânzare", cvc, cvcRaw],
  ["Act Adițional", act, actRaw],
] as [string, DocumentTemplateField[], unknown][])("%s", (_name, fields, raw) => {
  it("survives parseTemplateFields without losing a field", () => {
    // `parseTemplateFields` drops what it cannot read, silently and by design.
    // A template that shrinks on the way in is a template with a field nobody
    // will ever see and nothing will ever say so.
    expect(fields.length).toBe((raw as unknown[]).length);
  });

  it("fits under the ceiling, and the ceiling is the shared constant", () => {
    expect(fields.length).toBeLessThanOrEqual(MAX_TEMPLATE_FIELDS);
  });

  it("has unique keys", () => {
    const keys = fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("numbers `order` 0..n-1, which is what the form and the prompt read", () => {
    expect(fields.map((f) => f.order)).toEqual(fields.map((_, i) => i));
  });

  it("labels with short official terms, never sentence fragments", () => {
    for (const f of fields) {
      expect(looksLikeSentenceFragment(f.labelRo)).toBe(false);
      // Four words is the slack over the two or three the input documents use
      // — „Nedezmembrat contrar extrasului" is three, „Declarație art. 292 CP"
      // is four. Anything longer is a sentence wearing a caption's clothes.
      expect(f.labelRo.split(/\s+/).length).toBeLessThanOrEqual(4);
      expect(f.labelRo.length).toBeLessThanOrEqual(40);
      expect(f.labelEn.trim().length).toBeGreaterThan(0);
    }
  });

  it("writes every aiHint as a shape example and never as one deed's data", () => {
    for (const f of fields) {
      if (!f.aiHint) continue;
      // A year, a cadastral number, a CNP or a price from one scan — the F5
      // failure exactly. Placeholders are spelled N, zz.ll.aaaa, X and Y, so a
      // run of three or more digits is the tell, with the law citations the
      // archive genuinely shares („Legea 247/2005") the only thing that would
      // read like one — and those belong in the label or the option list, not
      // in a hint, which is why none is allowed here either.
      expect(f.aiHint).not.toMatch(/\d{3,}/);
      // One line, always: `buildExtractSystemPrompt` renders each field as ONE
      // `//` comment line inside the JSON shape it shows the model.
      expect(f.aiHint).not.toMatch(/[\r\n]/);
    }
  });

  it("gives every select at least two options and no other type any", () => {
    for (const f of fields) {
      if (f.type === "select") {
        expect(f.options?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const o of f.options ?? []) {
          expect(o.value).toMatch(/^[A-Za-z0-9_]+$/);
          expect(o.labelRo.trim().length).toBeGreaterThan(0);
          expect(o.labelEn.trim().length).toBeGreaterThan(0);
        }
        const values = (f.options ?? []).map((o) => o.value);
        expect(new Set(values).size).toBe(values.length);
      } else {
        expect(f.options).toBeNull();
      }
    }
  });

  it("puts every field on a tab, and gives the type a notebook", () => {
    const tabs = templateTabsOf(fields);
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(tabs.length).toBeLessThanOrEqual(5);
    for (const f of fields) expect(f.tabRo).toBeTruthy();
  });

  it("is accepted by the door the form editor writes through", () => {
    const parsed = documentTypeSchema.safeParse({
      name: "x",
      sortOrder: 1,
      templateFields: raw,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Contract de Vânzare, specifically", () => {
  it("lays its panels over three to five tabs", () => {
    // Adrian's escape hatch, in his words: "a notebook with 3, 4, 5 tabs, each
    // of them holding a number of panels that are related".
    const tabs = templateTabsOf(cvc);
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    expect(tabs.length).toBeLessThanOrEqual(5);
  });

  it("spells „Taxe și onorarii” and „Financiar” exactly, so they inherit the paired layout", () => {
    // ⚠️ The one silent failure mode in `template-groups.ts`: a name one
    // diacritic off saves cleanly, renders cleanly, and quietly costs the type
    // the half-width pairing. Asserted through the matchers the FORM uses, not
    // by comparing strings here — a second copy of the names is the thing
    // #27.03 moved them into that module to prevent.
    const panels = new Set(cvc.map((f) => f.groupRo ?? ""));
    expect([...panels].some((p) => isFeesGroup(p))).toBe(true);
    expect([...panels].some((p) => isFinancialGroup(p))).toBe(true);
  });

  it("records the flavour as a field, not as five document types", () => {
    // D-01: "a subtype with its own form is simply a type", and four of the
    // five CVC groups differ by the STATE OF THE PAPERWORK, which is a fact
    // about one transaction. The fifth option exists so all five are sayable.
    const categorie = cvc.find((f) => f.key === "categorieInterna");
    expect(categorie?.type).toBe("select");
    expect(categorie?.options?.map((o) => o.value)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("holds no field for a party, a share, a cadastral unit or a title event", () => {
    // The decision the whole slice rests on: those four are ASSOCIATIONS —
    // `person_document` (with the cotă from migration_084), `property_document`
    // and `document_document`. A field named for one of them is this template
    // reopening it.
    //
    // ⚠️ **EXACT KEYS, NOT A PREFIX PATTERN.** The first version of this test
    // matched `/^cumparator/` and flagged `cumparatorCunoasteSituatia`, which
    // is a CLAUSE about what the buyer accepts, not a field holding a buyer.
    // A pattern broad enough to catch the failure is broad enough to forbid
    // naming the party a clause is about, and a test that lies about a rule is
    // worse than the rule being unstated.
    const forbidden = new Set([
      "vanzator", "cumparator", "notar", "mandatar", "parti",
      "cotaParte", "cotaSuprafataMp", "cotaMod",
      "nrCadastral", "carteFunciara", "tarlaId", "parcela",
      "suprafataDeclarata", "suprafataMasurata",
      "titluNr", "titluData", "titluEmitent", "modDobandire",
      "certificatFiscalNr", "extrasCfNr", "certificatSarciniNr", "procuraNr",
    ]);
    expect(cvc.filter((f) => forbidden.has(f.key)).map((f) => f.key)).toEqual([]);
  });

  it("carries no `_2` twin of any field, which is what a repeating group becomes", () => {
    // Finding F5 of the #29.01 import report produced four of them from one
    // deed naming two parties. A suffix here means a repeating group was
    // folded back into the flat record, and the next deed with three of
    // whatever it is needs a `_3`.
    expect([...cvc, ...act].filter((f) => /_\d+$/.test(f.key)).map((f) => f.key)).toEqual([]);
  });
});

describe("the ceiling refuses a sixty-first field, by the constant", () => {
  const filler = (i: number) => ({
    key: `k${i}`,
    labelRo: `Câmp ${i}`,
    labelEn: `Field ${i}`,
    type: "text" as const,
    order: i,
  });

  it("accepts exactly MAX_TEMPLATE_FIELDS", () => {
    const fields = Array.from({ length: MAX_TEMPLATE_FIELDS }, (_, i) => filler(i));
    expect(documentTypeSchema.safeParse({ name: "x", sortOrder: 1, templateFields: fields }).success)
      .toBe(true);
  });

  it("refuses one more, and says the number the constant holds", () => {
    // ⚠️ Compared against `MAX_TEMPLATE_FIELDS` rather than against 60 —
    // `discover-to-template.test.ts` pins the route to the constant for the
    // same reason. A literal here would pass while the two writers disagreed.
    const fields = Array.from({ length: MAX_TEMPLATE_FIELDS + 1 }, (_, i) => filler(i));
    const parsed = documentTypeSchema.safeParse({ name: "x", sortOrder: 1, templateFields: fields });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain(String(MAX_TEMPLATE_FIELDS));
  });
});
