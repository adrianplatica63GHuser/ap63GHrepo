/**
 * An identity type under „Tipuri de documente": its system form, its mark, one message per refusal.  (Slice 40.84)
 *
 * - the Form tab of an identity type shows the kind's fields, read-only, under the one line the header asked for;
 * - the list marks the four types „Act de identitate” and draws no „Formular” button on them (unless an old free
 *   form is still on the row, which may only be cleared);
 * - `id_card_form` and `id_card_rename` have one message each, which the list, the form editor and the engine all
 *   read — the editor's `errorIdCardType` and the engine's `save.idCardType` are gone.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, within } from "@testing-library/react";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const ro = JSON.parse(read("messages", "ro-RO.json")) as Record<string, unknown>;
const en = JSON.parse(read("messages", "en-GB.json")) as Record<string, unknown>;
const at = (tree: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined), tree);

// The Romanian copy, resolved as the screen would; `{name}` filled, a plural block left as written.
jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tree = require("../../messages/ro-RO.json") as Record<string, unknown>;
    const raw = `${ns}.${key}`.split(".").reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined), tree);
    if (typeof raw !== "string") return `${ns}.${key}`;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) => (values && name in values ? String(values[name]) : m));
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { IdentitySystemForm } = require("@/app/admin/value-lists/_components/identity-system-form") as typeof import("@/app/admin/value-lists/_components/identity-system-form");
import { IDENTITY_KINDS, IDENTITY_KIND_VALUES, identityKindOfRow } from "@/lib/identity-documents/kinds";

const COMPONENTS = ["src", "app", "admin", "value-lists", "_components"] as const;

describe("identityKindOfRow — a Reference Data row's kind", () => {
  it("the marker where the row carries it, the key where it does not, never the name", () => {
    expect(identityKindOfRow({ key: "ORICE", identityKind: "PASAPORT" })).toBe("PASAPORT");
    expect(identityKindOfRow({ key: "CARTE_IDENTITATE", identityKind: null })).toBeNull();
    expect(identityKindOfRow({ key: "CARTE_IDENTITATE_VECHE" })).toBe("CI_VECHE");
    expect(identityKindOfRow({ key: "ADEVERINTA", name: "Carte de identitate", identityKind: null })).toBeNull();
    expect(identityKindOfRow({ key: 7, identityKind: 3 })).toBeNull();
    expect(identityKindOfRow(null)).toBeNull();
  });
});

describe("the system form", () => {
  it.each([...IDENTITY_KIND_VALUES])("%s: the line, then every field of the kind, in its order, with its width", (kind) => {
    const { container } = render(<IdentitySystemForm kind={kind} typeName={IDENTITY_KINDS[kind].typeName} />);
    expect(screen.getByText("Formular de sistem: câmpurile unui act de identitate sunt definite de aplicație și nu se modifică aici.")).toBeTruthy();
    const rows = [...container.querySelectorAll("[data-system-field]")];
    expect(rows.map((r) => r.getAttribute("data-system-field"))).toEqual(IDENTITY_KINDS[kind].fields.map((f) => f.key));
    IDENTITY_KINDS[kind].fields.forEach((f, i) => {
      const label = String(at(ro, f.messageKey));
      expect(within(rows[i] as HTMLElement).getByText(label)).toBeTruthy();
      expect(rows[i].querySelector("[data-system-width]")?.getAttribute("data-system-width")).toBe(f.width.step);
    });
    // Read-only: nothing to type in, nothing to press.
    expect(container.querySelectorAll("input, select, textarea, button")).toHaveLength(0);
  });

  it("every value kind and every place a field is kept has words, in both locales", () => {
    const types = new Set(IDENTITY_KIND_VALUES.flatMap((k) => IDENTITY_KINDS[k].fields.map((f) => f.type)));
    const targets = new Set(IDENTITY_KIND_VALUES.flatMap((k) => IDENTITY_KINDS[k].fields.map((f) => f.target)));
    for (const tree of [ro, en]) {
      for (const k of ["line", "caption", "colField", "colValue", "colWidth", "colStored", "lines"]) {
        expect(typeof at(tree, `identityDocument.systemForm.${k}`)).toBe("string");
      }
      for (const t of types) expect(typeof at(tree, `identityDocument.systemForm.values.${t}`)).toBe("string");
      for (const t of targets) expect(typeof at(tree, `identityDocument.systemForm.stored.${t}`)).toBe("string");
    }
  });

  it("the type's page shows it on an identity type, and the editor only for an old form left on one", () => {
    const page = code(read(...COMPONENTS, "document-type-page.tsx"));
    expect(page).toContain("const kind = identityKindOfRow(row);");
    expect(page).toMatch(/kind !== null \? \(\s*<IdentitySystemForm kind=\{kind\}/);
    expect(page).toContain("const canOpen = lock === null || fields.length > 0;");
    // The lock reads the marker, as the list's does.
    expect(page).toContain('if (identityKindOfRow(row) !== null) return "idCard";');
  });
});

describe("the list", () => {
  const modal = code(read(...COMPONENTS, "value-list-modal.tsx"));

  it("marks the four types „Act de identitate”", () => {
    expect(at(ro, "valueList.documentTypeStatus.identity")).toBe("Act de identitate");
    expect(typeof at(en, "valueList.documentTypeStatus.identity")).toBe("string");
    expect(modal).toMatch(/identityKindOfRow\(row\) !== null\s*\?\s*"identity"\s*:\s*documentTypeStatus\(/);
    expect(modal).toContain("data-row-status={review.statusOf(row)}");
  });

  it("draws no „Formular” button on an identity row with no form", () => {
    expect(modal).toMatch(/identityKindOfRow\(row\) === null\)\s*\|\|\s*parseTemplateFields\(row\.templateFields\)\.length > 0\) && \(/);
    expect(modal).toContain('if (identityKindOfRow(row) !== null) return "idCard";');
  });
});

describe("one message per refusal code", () => {
  it("the two old copies are gone, in both locales", () => {
    for (const tree of [ro, en]) {
      expect(at(tree, "valueList.templateFields.errorIdCardType")).toBeUndefined();
      expect(at(tree, "docTypeEngine.save.idCardType")).toBeUndefined();
    }
  });

  it("each code its own sentence, which names the system form or the application", () => {
    const form = String(at(ro, "valueList.confirm.errors.idCardForm"));
    const rename = String(at(ro, "valueList.confirm.errors.idCardRename"));
    expect(form).not.toBe(rename);
    expect(form).toContain("formularul de sistem");
    expect(rename).toContain("definite de aplicație");
    // The pre-40.82 argument — „se preiau la import, ca persoane” — is no longer true and no longer said.
    expect(form).not.toContain("ca persoane");
    expect(rename).not.toContain("ca persoane");
  });

  it.each([
    ["document-type-form-editor", join(...COMPONENTS, "document-type-form-editor.tsx")],
    ["doc-type-engine", join("src", "app", "admin", "doc-type-engine", "_components", "doc-type-engine.tsx")],
  ])("%s reads the list's message for each code", (_name, file) => {
    const src = code(read(file));
    expect(src).toContain('useTranslations("valueList.confirm.errors")');
    expect(src).toContain('tErr("idCardForm", { code: "", collisions: 0 })');
    expect(src).toContain('tErr("idCardRename", { code: "", collisions: 0 })');
    expect(src).not.toContain("errorIdCardType");
    expect(src).not.toContain("save.idCardType");
  });
});
