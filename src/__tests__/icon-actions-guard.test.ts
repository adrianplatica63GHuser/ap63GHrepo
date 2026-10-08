/**
 * „Salvează", „Anulează", „Închide", „Șterge", „Modifică" are icons now.   (Slice #37.43)
 *
 * Adrian's decisions A021–A025 (GA40-CTA-Icon-Map.xlsx): Save, X, X, Trash2 and
 * Pencil, through IconButton, the word kept as the accessible name and the
 * tooltip. This guard walks every component #37.43 converted and fails on a
 * `<button>` whose visible text is one of those words — so a later edit cannot
 * quietly put a word back beside its icon twin.
 *
 * ⚠️ **EXCEPT THE A110 DIALOGS, WHICH THE GUARD NAMES.** A button that answers
 * the question its dialog has just asked — „Ștergeți …? Șterge / Anulează" —
 * keeps its words: a destructive or irreversible answer must say what it does.
 * Each one is listed in `A110` below with how many such buttons its file holds,
 * and a count that grows is a failure too.
 *
 * How it reads a button: the last `{…}` before `</button>`, its `t("key")`
 * calls resolved through the nearest `useTranslations("ns")` above them (a file
 * may hold several components, each with its own `t`), and the Romanian value
 * looked up in `messages/ro-RO.json`. The busy texts („Se salvează…") are not
 * words the slice removes from sight — an icon button shows them as its
 * tooltip — so only the five words, „Renunță" and „Editează" count.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const RO = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", "ro-RO.json"), "utf8")) as Record<string, unknown>;

/** The components #37.43 converted. */
const FILES = [
  "src/app/account/change-password/change-password-form.tsx",
  "src/app/admin/groups/_components/group-editor.tsx",
  "src/app/admin/groups/_components/groups-list-view.tsx",
  "src/app/admin/help-content/_components/help-content-hub.tsx",
  "src/app/admin/import/_components/bulk-import-dialog.tsx",
  "src/app/admin/import/_components/property-step-dialog.tsx",
  "src/app/admin/import/_components/tag-dialog.tsx",
  "src/app/admin/settings/_components/settings-view.tsx",
  "src/app/admin/stamps/_components/stamp-applicator.tsx",
  "src/app/admin/stamps/_components/stamps-list-view.tsx",
  "src/app/admin/tags/_components/tag-manager.tsx",
  "src/app/admin/value-lists/_components/document-type-form-editor.tsx",
  "src/app/admin/value-lists/_components/value-list-modal.tsx",
  "src/app/documents/[id]/associate-party/associate-party-view.tsx",
  "src/app/documents/[id]/associate-person/associate-person-view.tsx",
  "src/app/documents/[id]/associate-property/associate-property-view.tsx",
  "src/app/documents/[id]/associate-reference/associate-reference-view.tsx",
  "src/app/documents/_components/ai-reference-linker-dialog.tsx",
  "src/app/documents/_components/document-form.tsx",
  "src/app/documents/_components/pages-panel.tsx",
  "src/app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
  "src/app/judicial-persons/[id]/associate-person/associate-person-view.tsx",
  "src/app/judicial-persons/[id]/associate-property/associate-property-view.tsx",
  "src/app/judicial-persons/_components/judicial-person-form.tsx",
  "src/app/natural-persons/[id]/associate-document/associate-document-view.tsx",
  "src/app/natural-persons/[id]/associate-person/associate-person-view.tsx",
  "src/app/natural-persons/[id]/associate-property/associate-property-view.tsx",
  "src/app/natural-persons/_components/natural-person-form.tsx",
  "src/app/properties/[id]/associate-document/associate-document-view.tsx",
  "src/app/properties/[id]/associate-person/associate-person-view.tsx",
  "src/app/properties/[id]/associate-reference/associate-reference-view.tsx",
  "src/app/properties/_components/add-property-dialog.tsx",
  "src/app/properties/_components/corners-manager.tsx",
  "src/app/properties/_components/property-form.tsx",
  "src/app/properties/_components/straighten-dialog.tsx",
  "src/components/entity-metadata-tab.tsx",
  "src/components/help/help-button.tsx",
  "src/components/help/help-hint.tsx",
  "src/components/persons/person-resolution-dialog.tsx",
  "src/components/tiles/preview-tile-body.tsx",
];

const WORDS = new Set(["Salvează", "Anulează", "Renunță", "Închide", "Șterge", "Modifică", "Editează"]);

/** file → message key → how many buttons may still show it: the A110 confirmations. */
const A110: Record<string, Record<string, number>> = {
  "src/app/admin/groups/_components/groups-list-view.tsx": { "group.confirm.delete": 1, "group.confirm.cancel": 1 },
  "src/app/admin/stamps/_components/stamps-list-view.tsx": { "stamp.confirm.delete": 1, "stamp.confirm.cancel": 1 },
  "src/app/admin/value-lists/_components/document-type-form-editor.tsx": { "valueList.templateFields.confirmDiscard": 1, "valueList.templateFields.cancel": 1 },
  "src/app/admin/value-lists/_components/value-list-modal.tsx": { "valueList.confirm.delete": 1, "valueList.confirm.cancel": 1 },
  "src/app/documents/_components/pages-panel.tsx": { "document.pages.deleteConfirm.yes": 1, "document.pages.deleteConfirm.no": 1 },
};

function lookup(key: string): string | undefined {
  let o: unknown = RO;
  for (const p of key.split(".")) {
    if (typeof o !== "object" || o === null || !(p in o)) return undefined;
    o = (o as Record<string, unknown>)[p];
  }
  return typeof o === "string" ? o : undefined;
}

/** Message keys shown as the visible text of a `<button>`, with the word each resolves to. */
function wordsOnButtons(source: string): { key: string; word: string }[] {
  const defs = [...source.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)")?\s*\)/g)].map(
    (m) => ({ at: m.index ?? 0, name: m[1], ns: m[2] ?? "" }),
  );
  const found: { key: string; word: string }[] = [];
  for (const m of source.matchAll(/\{([^{}]*)\}\s*<\/button>/g)) {
    const ns: Record<string, string> = {};
    for (const d of defs) if (d.at < (m.index ?? 0)) ns[d.name] = d.ns;
    for (const c of m[1].matchAll(/(\w+)\("([^"]+)"/g)) {
      if (!(c[1] in ns)) continue;
      const key = ns[c[1]] ? `${ns[c[1]]}.${c[2]}` : c[2];
      const word = lookup(key);
      if (word && WORDS.has(word)) found.push({ key, word });
    }
  }
  return found;
}

describe("#37.43 — no converted component shows „Salvează / Anulează / Închide / Șterge / Modifică\" as button text", () => {
  it.each(FILES)("%s", (file) => {
    const found = wordsOnButtons(fs.readFileSync(path.join(ROOT, file), "utf8"));
    const allowed = A110[file] ?? {};
    const counts: Record<string, number> = {};
    for (const f of found) counts[f.key] = (counts[f.key] ?? 0) + 1;
    const offenders = Object.entries(counts)
      .filter(([key, n]) => n > (allowed[key] ?? 0))
      .map(([key, n]) => `${key} ×${n} (allowed ${allowed[key] ?? 0})`);
    expect(offenders).toEqual([]);
  });

  it("reads a word where one is — the guard is not blind", () => {
    const sample = 'const t = useTranslations("valueList.confirm");\n<button>{t("delete")}</button>';
    expect(wordsOnButtons(sample)).toEqual([{ key: "valueList.confirm.delete", word: "Șterge" }]);
  });

  it("every A110 entry still exists, so an exception cannot outlive its dialog", () => {
    for (const [file, keys] of Object.entries(A110)) {
      const found = wordsOnButtons(fs.readFileSync(path.join(ROOT, file), "utf8")).map((f) => f.key);
      for (const key of Object.keys(keys)) expect({ file, key, present: found.includes(key) }).toEqual({ file, key, present: true });
    }
  });
});
