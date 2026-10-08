/**
 * „Identificarea actului": who issued an act, its number and its date, in one
 * tile on every document.                                       (Slice #38.32)
 *
 * The issuer, the number and the date sat at the top of the fees panel (since
 * #21.06.misc); they are on the document's first tile now, under „Tip
 * document", with the type's own identification fields after them — on a
 * contract de vânzare „Calitate exemplar", „Exemplare emise", „Temei
 * autentificare" and „Data conținutului". The fees panel keeps only the fees,
 * and a type with no fees group has no fees panel. The browser half is
 * TC-DOC-03.
 */
import fs from "fs";
import path from "path";
import { TEMPLATE_FIELD_GROUPS, isIdentificationGroup, templateFieldGroupOf } from "@/lib/documents/template-groups";
import { getTypeConfig } from "@/lib/documents/type-config";
import { PANEL_UNITS, SCREEN_ROWS } from "@/lib/ui/field-widths";
import { FIELDS_TILE, documentTileRegistry } from "@/app/documents/_components/document-tiles";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const FORM = code(read("src", "app", "documents", "_components", "document-form.tsx"));
const between = (src: string, a: string, b: string) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

type Field = { key: string; type: string; tabRo: string | null; groupRo: string | null; groupEn: string | null };
const FORMS = JSON.parse(read("src", "db", "document-type-forms.json")) as { forms: Record<string, Field[]> };

describe("the identification group", () => {
  it("is the fourth special group, named as the tile, in both languages", () => {
    expect(TEMPLATE_FIELD_GROUPS.map((g) => g.id)).toEqual(["financial", "fees", "certificates", "identification"]);
    expect(isIdentificationGroup("Identificarea actului")).toBe(true);
    expect(isIdentificationGroup("Document identification")).toBe(true);
    expect(templateFieldGroupOf("Identificarea actului ")).toBeNull();
    expect(JSON.parse(read("messages", "ro-RO.json")).document.tiles.general).toBe("Identificarea actului");
  });

  it("holds the contract de vânzare's four, on no tab", () => {
    const cvc = FORMS.forms.CONTRACT_VANZARE.filter((f) => f.groupRo === "Identificarea actului");
    expect(cvc.map((f) => f.key)).toEqual(["calitateExemplar", "exemplareEmise", "temeiAutentificare", "dataContinut"]);
    expect(cvc.every((f) => f.tabRo === null && f.groupEn === "Document identification")).toBe(true);
    // Ask first 2: „Data conținutului" is a real date field, its stored text converted by migration_097.
    expect(cvc.find((f) => f.key === "dataContinut")?.type).toBe("date");
    // „Dosar și exemplar" keeps the two that describe the cadastral file.
    expect(FORMS.forms.CONTRACT_VANZARE.filter((f) => f.groupRo === "Dosar și exemplar").map((f) => f.key)).toEqual(["categorieInterna", "documentatieFinalizata"]);
  });
});

describe("the tile", () => {
  it("reads Tip document, then the issuer, number and date, then the type's identification fields", () => {
    expect(SCREEN_ROWS.document.general.slice(0, 3)).toEqual([["documentTypeId"], ["institutionId"], ["nrDocument", "dateDocument"]]);
    const general = between(FORM, "const generalSection = (", "const panelsOf = (");
    expect(general.indexOf('name="documentTypeId"')).toBeLessThan(general.indexOf("{issueFields}"));
    const issue = between(FORM, "const issueFields = (", "const financialPacked");
    expect(issue).toMatch(/label=\{t\(cfg\.labels\.institution\)\}[\s\S]*name="institutionId"[\s\S]*label=\{t\(cfg\.labels\.nrDocument\)\}[\s\S]*label=\{t\(cfg\.labels\.dateDocument\)\}[\s\S]*\{identificationPacked\.nodes\}/);
  });

  it("is where an error or a highlight on those fields is shown", () => {
    const tileOf = between(FORM, "const tileOfPath = (path: string): string => {", "const onTileLayout");
    expect(tileOf).toMatch(/identificationGroup\?\.fields\.some\(\(f\) => f\.key === key\)\) return "general";/);
    expect(tileOf).toMatch(/if \(ISSUE_FIELDS\.has\(root\)\) return "general";/);
  });

  it("never draws the identification group as a panel of its own", () => {
    expect(FORM).toMatch(/g !== certificatesGroup && g !== identificationGroup/);
  });
});

describe("a type with no fields of its own", () => {
  it("offers no empty „Detalii act” — the issuer, number and date were all it held", () => {
    const cm = documentTileRegistry({ typeKey: "CERTIFICAT_MOSTENITOR", tabs: [], succession: true, pages: true, ownFields: false });
    expect(cm.all).not.toContain(FIELDS_TILE);
    expect(cm.defaults).toEqual(["general", "pages", "succession"]);
    const pad = documentTileRegistry({ typeKey: "PLAN_AMPLASAMENT_DELIMITARE", tabs: [], succession: false, pages: true, ownFields: true });
    expect(pad.defaults).toEqual(["general", "pages", FIELDS_TILE]);
    expect(FORM).toContain("ownFields: typeHasForm");
    expect(FORM).toContain("const typeHasForm = documentTypeHasForm(selectedType?.templateFields);");
  });
});

describe("the fees panel", () => {
  it("holds only the fees, and is not drawn without a fees group", () => {
    const fees = between(FORM, "const feesSection = ", "const issueFields");
    expect(fees).toContain("feesGroup && feesGroup.fields.length > 0 ?");
    expect(fees).not.toMatch(/name="(institutionId|nrDocument|dateDocument)"/);
    expect(PANEL_UNITS.document.fees).toBe(3);
  });
});

describe("the labels (Ask first 1)", () => {
  it("the notarial set where the type config already picks the notary", () => {
    for (const key of ["CONTRACT_VANZARE", "ACT_ADITIONAL"]) {
      expect(getTypeConfig(key).labels).toEqual({ nrDocument: "typeLabels.nrAuthenticDeed", dateDocument: "typeLabels.dateAuthenticated", institution: "typeLabels.institutionNotary" });
    }
  });
  it("the generic set — „Emitent”, „Nr. document”, „Data” — for a type with none of its own", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).document.typeLabels;
    const l = getTypeConfig("PLAN_AMPLASAMENT_DELIMITARE").labels;
    expect([ro[l.institution.split(".")[1]], ro[l.nrDocument.split(".")[1]], ro[l.dateDocument.split(".")[1]]]).toEqual(["Emitent", "Nr. document", "Data"]);
  });
});

describe("migration_097 — „Data conținutului” becomes a date (Ask first 2)", () => {
  const sql = read("src", "db", "migration_097_cvc_data_continut_date.sql");
  it("reads dd.mm.yyyy, yyyy-mm-dd and a Romanian month name, and only real days", () => {
    expect(sql).toContain("'^\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}$'");
    expect(sql).toContain("'^\\d{4}-\\d{1,2}-\\d{1,2}$'");
    expect(sql).toContain("'^\\d{1,2}\\s+[[:alpha:]]+\\.?\\s+\\d{4}$'");
    expect(sql).toMatch(/RETURN make_date\(y, m, d\);\s+EXCEPTION WHEN others THEN\s+RETURN NULL;/);
  });
  it("knows all twelve months by name", () => {
    for (const m of ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]) {
      expect([m, sql.includes(`'${m}'`)]).toEqual([m, true]);
    }
  });
  it("drops nothing: a value that is not a date goes to „Note” and its DOC code is logged", () => {
    expect(sql).toContain("'Data conținutului (text): ' || m.raw");
    expect(sql).toContain("custom_fields = d.custom_fields - 'dataContinut'");
    expect(sql).toContain("RAISE NOTICE 'migration_097: % kept");
  });
});
