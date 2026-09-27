/**
 * FU-067 — „Fă curentă" is not offered in a read-only view.   (Slice #37.07)
 *
 * A record opened from an association tab opens read-only (`mode="view"`),
 * with „Modifică" to turn it into an editable one. On an older version the
 * view still offered an ENABLED „Fă curentă" beside the disabled „Modifică" —
 * a write from a screen that is otherwise read-only. Each of the four detail
 * forms now offers it only in edit mode, or after „Modifică" was pressed.
 * Read as code (comments stripped): the forms are large and their version
 * navigation needs a server; the expression is the whole of the change.
 */
import fs from "node:fs";
import path from "node:path";

const FORMS = [
  "src/app/natural-persons/_components/natural-person-form.tsx",
  "src/app/judicial-persons/_components/judicial-person-form.tsx",
  "src/app/properties/_components/property-form.tsx",
  "src/app/documents/_components/document-form.tsx",
];

describe("FU-067: „Fă curentă” needs a view that may write", () => {
  it.each(FORMS)("%s gates it on the mode", (file) => {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const line = code.split("\n").find((l) => /^\s*canMakeCurrent:/.test(l)) ?? "";
    expect(line).toContain('(mode !== "view" || associatedEditing)');
    expect(line).toContain("!isOnLatest");
  });
});
