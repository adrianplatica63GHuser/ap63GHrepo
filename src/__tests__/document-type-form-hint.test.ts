/**
 * The dropdown that says which types have a form, and the sentence that says
 * what would give a type one.                                   (Slice #27.02)
 *
 * WHAT IS ACTUALLY AT RISK
 * ------------------------
 * Nothing here is stored and nothing here is fetched — the whole slice is two
 * sentences of copy and one call to `documentTypeHasForm`. So the failures it
 * can have are not crashes; they are all cases where the screen keeps rendering
 * and says something untrue:
 *
 *   1. **The hint names a button that is no longer called that.** It says
 *      "Descoperire AI" in prose. Rename `buttons.aiDiscover` and the sentence
 *      points at a control the user cannot find, in the one place they are
 *      being told to go and use it. Pinned per locale, against the button's own
 *      message rather than against a literal repeated here.
 *
 *   2. **"Has no form" starts reading as a fault.** It is the correct and
 *      PERMANENT answer for CARTE_IDENTITATE (its data comes from the
 *      identity-card step) and for any type whose content is the scan itself.
 *      A red span, a warning word, or a "yet" turns a settled fact into a chore
 *      the user cannot discharge — and nothing would fail.
 *
 *   3. **A second computation of "has a form".** `templateFields.length > 0` is
 *      right here and now, and drifts from `parseTemplateFields` the day the
 *      parser drops one more shape. #26.12 put that decision in one function so
 *      a label and a colour could never disagree; a hint is now the third
 *      reader of it.
 *
 *   4. **The marking silently flips.** Twenty-three of the twenty-four seeded
 *      types have no form, so annotating the majority costs nothing at compile
 *      time and makes the dropdown say nothing. The property is pinned in
 *      `document-status.test.ts`; what is pinned HERE is that the component
 *      goes through the function that has it.
 *
 * The component assertions read code, never comments — a NAME guard may read
 * comments, a BEHAVIOUR guard must not.
 */

import fs from "fs";
import path from "path";
import { scanIcu } from "@/test-support/icu";

const SRC = path.join(process.cwd(), "src");
const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

const MESSAGES: Record<string, unknown> = Object.fromEntries(
  LOCALES.map((file) => [
    file,
    JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8")) as unknown,
  ]),
);

function at(node: unknown, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (n, part) =>
        n !== null && typeof n === "object" ? (n as Record<string, unknown>)[part] : undefined,
      node,
    );
}

function text(file: string, keyPath: string): string {
  const value = at(MESSAGES[file], keyPath);
  if (typeof value !== "string") {
    throw new Error(`${file}: ${keyPath} is ${JSON.stringify(value)}, not a string`);
  }
  return value;
}

const FORM_FILE = "app/documents/_components/document-form.tsx";
const FORM_SRC = fs.readFileSync(path.join(SRC, FORM_FILE), "utf8");

/**
 * The file with its comments removed.
 *
 * ⚠️ **Not tidiness — the guard below is wrong without it.** It asserts that the
 * form never tests `templateFields.length`, and the comment explaining WHY it
 * must not spells that expression out. A behaviour guard that reads comments
 * fails on the sentence describing the rule it is enforcing, and the obvious
 * fix — reword the comment — deletes the explanation to satisfy the test.
 * (A NAME guard may read comments; a behaviour guard must read only code.)
 *
 * The `:` test is a guard against a `//` inside a URL string. There is none in
 * this file today; it is there so the day one arrives, this keeps working.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i >= 0 && line[i - 1] !== ":" ? line.slice(0, i) : line;
    })
    .join("\n");
}

const FORM_CODE = codeOnly(FORM_SRC);

/** The `<tag …/>` element containing `marker`, sliced by its OWN indentation. */
function jsxElement(src: string, tag: string, marker: string): string {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  const open = src.lastIndexOf(`<${tag}`, at);
  if (open < 0) throw new Error(`<${tag} not found before ${marker}`);
  const indent = src.slice(src.lastIndexOf("\n", open) + 1, open);
  const close = src.indexOf(`\n${indent}/>`, open);
  if (close < 0) throw new Error(`unterminated <${tag}> at ${open}`);
  return src.slice(open, close);
}

/** A top-level function declaration, up to the next one (or end of file). */
function functionBody(src: string, head: string): string {
  const at = src.indexOf(head);
  if (at < 0) throw new Error(`function not found: ${head}`);
  const next = src.indexOf("\nfunction ", at + head.length);
  return src.slice(at, next < 0 ? src.length : next);
}

/** The single statement beginning `head`, up to its terminating semicolon. */
function statement(src: string, head: string): string {
  const at = src.indexOf(head);
  if (at < 0) throw new Error(`statement not found: ${head}`);
  const end = src.indexOf(";", at);
  if (end < 0) throw new Error(`unterminated statement: ${head}`);
  return src.slice(at, end);
}

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

describe("both locales carry the same two messages", () => {
  it.each(LOCALES)("%s has the group, with exactly these keys", (file) => {
    expect(Object.keys(at(MESSAGES[file], "document.typeForm") as object).sort())
      .toEqual(["noFormHint", "optionHasForm"]);
  });

  it.each(LOCALES)("%s interpolates the type name, and nothing else", (file) => {
    const message = text(file, "document.typeForm.optionHasForm");
    const scan = scanIcu(message);
    expect([...scan.args]).toEqual(["name"]);
    expect(scan.plurals).toEqual([]);
    // It must actually MARK. `"{name}"` alone parses, reads fine in a diff, and
    // renders a dropdown identical to the one before this slice.
    expect(message.replace("{name}", "").trim().length).toBeGreaterThan(0);
  });

  it.each(LOCALES)("%s takes no arguments in the hint", (file) => {
    const scan = scanIcu(text(file, "document.typeForm.noFormHint"));
    expect([...scan.args]).toEqual([]);
  });
});

describe("the hint names the button by the name the button actually has", () => {
  // Risk 1. Against `buttons.aiDiscover` itself, not a literal — a rename that
  // updates only the button fails here, which is the point.
  it.each(LOCALES)("%s spells it exactly as the button does", (file) => {
    const buttonName = text(file, "document.buttons.aiDiscover");
    expect(text(file, "document.typeForm.noFormHint")).toContain(buttonName);
  });

  // ⚠️ `toContain` above passes a rename that SHORTENS the name into a substring
  // of the old one — "Descoperire AI" -> "Descoperire" leaves the hint saying
  // "Descoperire AI", which still contains "Descoperire". A review round found
  // that, and this is the backstop: the literal is pinned in both locales, so
  // any rename fails HERE, two lines under the assertion it would have slipped
  // past, and whoever renames has to update the hint in the same breath.
  it.each([
    ["ro-RO.json", "Descoperire AI"],
    ["en-GB.json", "AI Discover"],
  ])("%s calls the button exactly %s", (file, name) => {
    expect(text(file, "document.buttons.aiDiscover")).toBe(name);
  });
});

describe("the hint states the consequence, in one sentence, without alarm", () => {
  it.each(LOCALES)("%s is a single sentence", (file) => {
    const message = text(file, "document.typeForm.noFormHint");
    expect(message.endsWith(".")).toBe(true);
    // No sentence break anywhere before the end. A second sentence is not a
    // style complaint: it renders as a paragraph under a form field.
    expect(message.slice(0, -1)).not.toMatch(/[.!?]\s/);
  });

  it.each(LOCALES)("%s carries no line break", (file) => {
    expect(text(file, "document.typeForm.noFormHint")).not.toMatch(/[\r\n]/);
    expect(text(file, "document.typeForm.optionHasForm")).not.toMatch(/[\r\n]/);
  });

  // Risk 2, in the copy. Each word here would reframe a permanent, correct
  // state as something wrong or unfinished.
  const ALARM: Record<string, string[]> = {
    "ro-RO.json": ["eroare", "atenție", "atentie", "avertis", "încă", "inca", "trebuie", "lipse"],
    "en-GB.json": ["error", "warning", "yet", "must", "missing", "should"],
  };

  it.each(LOCALES)("%s does not describe it as a fault", (file) => {
    const message = text(file, "document.typeForm.noFormHint").toLowerCase();
    for (const word of ALARM[file]) expect(message).not.toContain(word);
  });

  // The consequence the slice asks for: the fields land on the TYPE, so they
  // appear on every document of that type. Pinned as "the hint says something
  // about the type, and about all its documents" rather than as a sentence.
  // ⚠️ The EN phrase is "added to the document type", not "document type". A
  // review round caught the loose version: "document type" also occurs in the
  // OPENING clause ("This document type has no form of its own"), so a rewrite
  // that dropped the where-the-fields-land claim entirely still passed. The RO
  // phrase was only safe by accident — the articulated "tipul de document"
  // happens not to match the opening "Acest tip de document" — and two locales
  // guarded at different strengths is the same bug waiting for a translator.
  it.each([
    ["ro-RO.json", ["se adaugă la tipul de document", "toate documentele"]],
    ["en-GB.json", ["added to the document type", "every document"]],
  ] as const)("%s says the fields land on the type", (file, phrases) => {
    const message = text(file, "document.typeForm.noFormHint").toLowerCase();
    for (const phrase of phrases) expect(message).toContain(phrase);
  });
});

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const SELF = "__tests__/document-type-form-hint.test.ts";

function productionFilesContaining(needle: string): string[] {
  return walk(SRC)
    .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
    .filter((f) => f !== SELF && !f.startsWith("__tests__/"))
    .filter((f) => fs.readFileSync(path.join(SRC, f), "utf8").includes(needle))
    .sort();
}

describe("the comment stripper does not eat the code it is stripping", () => {
  // Every assertion below reads FORM_CODE. A stripper that ran away would make
  // all of them pass vacuously or fail for the wrong reason.
  it("leaves the file's landmarks standing", () => {
    expect(FORM_CODE).toContain("export function DocumentForm(");
    expect(FORM_CODE).toContain("function SelectField(");
    expect(FORM_CODE).toContain("</form>");
    expect(FORM_CODE.length).toBeGreaterThan(FORM_SRC.length / 2);
  });

  it("is only safe while the file has no `//` inside a string", () => {
    // The two shapes a line-and-block stripper this small gets wrong are a `//`
    // in a URL literal and a `/*` inside a line comment. Neither is in this file
    // today; the day one arrives this fails first, rather than a downstream
    // assertion failing for a reason nobody can see.
    expect(FORM_SRC).not.toMatch(/:\/\//);
  });
});

describe("has-a-form is decided once, and the dropdown asks that one function", () => {
  // Risk 3. The ban is on a COMPARISON against a template-fields length, which
  // is what a second has-a-form test looks like — `templateFields.length > 0`
  // and `parseTemplateFields(x).length > 0` both. A bare `.length` used as a
  // count is not this, and is not banned.
  it("re-decides has-a-form nowhere in the form", () => {
    expect(FORM_CODE).not.toMatch(/templateFields\s*\)?\s*\.\s*length\s*(>|<|={2,3}|!==)/);
    // ⚠️ …and the shortest form of it, which needs no comparator at all.
    // `!templateFields.length` was found by a review round slipping straight
    // through the rule above.
    expect(FORM_CODE)
      .not.toMatch(/!\s*(parseTemplateFields\([^)]*\)|templateFields)\s*\)?\s*\.\s*length/);
  });

  // ⚠️ **Risk 3's real hole, and a review round found it.** Everything else here
  // checks WHICH FUNCTIONS the component calls, and no such check survives the
  // deletion of a single `!`. So the decision moved into `status.ts`, where
  // `document-status.test.ts` pins its polarity over every template_fields
  // shape — and what is left to pin here is that the component asks it, and
  // adds only the two questions that are about the SCREEN.
  it("gates the hint on the shared predicate, plus the screen facts", () => {
    const stmt = statement(FORM_CODE, "const showNoFormHint");
    // ⚠️ **The SHAPE, not the substring.** Round three showed that
    // `toContain("documentTypeNeedsFormHint(selectedType)")` is satisfied by
    // `&& !documentTypeNeedsFormHint(selectedType)` — one character that
    // inverts the entire slice, showing the hint on exactly the types that
    // HAVE a form, with both suites green. Moving the inversion into
    // `status.ts` guarded the function; this guards the call.
    expect(stmt).toMatch(/&&\s*documentTypeNeedsFormHint\(selectedType\)/);
    expect(stmt).not.toMatch(/!\s*documentTypeNeedsFormHint/);
    // `effectiveMode`, not `mode`: the read-only states are the ones where the
    // feature is unreachable, and `mode !== "view"` was subsumed in five of the
    // six states and wrong in the sixth (an associated record after Modifică is
    // an editable picker — it was marking the options and withholding the
    // sentence). Round three.
    expect(stmt).toContain('effectiveMode !== "view"');
    // ⚠️ A lookbehind, not `not.toContain('mode !== "view" ')`. Round four
    // reproduced the trailing-space version missing entirely: this statement is
    // written one conjunct per line, so a re-added `mode !== "view"` is followed
    // by a NEWLINE. The lookbehind is what keeps `effectiveMode` from matching.
    expect(stmt).not.toMatch(/(?<![A-Za-z])mode\s*!==\s*"view"/);
    // Until the pages arrive, "not text-only" is a guess.
    expect(stmt).toContain("!pagesState.isLoading");
    expect(stmt).toContain("!hasTextOnlyPages");
    expect(stmt).not.toMatch(/\.\s*length/);
  });

  // …and it has to be declared where `effectiveMode` already exists. Reading a
  // `const` above its declaration is a TDZ ReferenceError on every render, not
  // a lint warning, so this is a crash the string guards above cannot see.
  it("declares the gate after the value it reads", () => {
    expect(FORM_CODE.indexOf("const effectiveMode"))
      .toBeLessThan(FORM_CODE.indexOf("const showNoFormHint"));
  });

  // The hint names Descoperire AI, so it may only appear where that button can.
  // One declaration of the fact, read by both.
  it("reads the same page fact the Descoperire AI button reads", () => {
    expect(FORM_CODE.match(/const hasTextOnlyPages/g)).toHaveLength(1);
    expect(FORM_CODE).toContain("if (hasTextOnlyPages) return null;");
  });

  // …and the comment that says why none of this is recomputed is still there.
  // Stripping comments to run the assertions above would otherwise make
  // deleting the reasoning free. Pinned on a phrase unique to that comment: a
  // review round caught the first version asserting on "#26.12", which this
  // file has carried in an unrelated JSDoc since a previous slice.
  it("keeps the reasoning the stripper hides from the assertions", () => {
    expect(FORM_SRC).toContain("is the same answer computed a second time");
  });

  // Risk 4 — the property itself is pinned in document-status.test.ts; this is
  // the wiring, without which that property guards nothing that ships.
  it("builds each option's label from THAT option, through the shared function", () => {
    const field = jsxElement(FORM_CODE, "SelectField", 'name="documentTypeId"');
    expect(field.split("<SelectField")).toHaveLength(2);
    // ⚠️ **The call's SHAPE, both arguments, in order.** Bare `toContain`s do
    // not hold this: `documentTypeOptionLabel(selectedType?.name ?? "",
    // opt.templateFields, …)` renders the SELECTED type's name on every marked
    // row, and `toContain("opt.name")` passed it the moment round three put an
    // `opt.name` in a ternary arm one line above. Round four.
    expect(field).toMatch(/documentTypeOptionLabel\(\s*opt\.name,\s*opt\.templateFields,/);
    expect(field).toContain('t("typeForm.optionHasForm"');
    expect(field).toContain('t("typeForm.noFormHint")');
    // No carve-out on which options are marked. Both that were tried made the
    // picker inconsistent — see the component's comment, which records them.
    expect(field).not.toContain("opt.id === selectedDocumentTypeId");
    expect(field).not.toContain('effectiveMode === "view"');
    // And the hint is passed through, the right way up. `hint={!showNoFormHint
    // ? …}` satisfies a bare toContain and inverts the sentence. `\s*` rather
    // than literal spaces: round five reproduced the literal version failing on
    // a pure line-wrap of the ternary, which is a red build for no behaviour
    // change — the one thing a guard must never do.
    expect(field).toMatch(/hint=\{\s*showNoFormHint\s*\?/);
  });

  // ⚠️ **The invariant the whole slice rests on, and until a review round asked,
  // only a comment held it.** `app/documents/list-view.tsx` and this form each
  // define their own `fetchDocumentTypes` and share the react-query key
  // `["document-types"]`, so whichever page loads first fills the cache both
  // read. That is safe only while BOTH return the rows unprojected: list-view's
  // own `DocumentTypeOption` names three fields, so `.map(({ id, key, name }) =>
  // …)` is an obvious tidy — and it type-checks, lints, and would make this form
  // mark nothing and tell the user that every type is formless, including the
  // ones that are not.
  it("keeps the shared document-types cache unprojected at both fetchers", () => {
    for (const file of [FORM_FILE, "app/documents/list-view.tsx"]) {
      const src = fs.readFileSync(path.join(SRC, file), "utf8");
      expect(src).toContain('queryKey: ["document-types"]');
      expect(src).toMatch(/return \(?body\.items \?\? \[\]\)?( as DocumentTypeOption\[\])?;/);
    }
  });

  /**
   * The same invariant, at the fetcher that is NOT in the react-query cache.
   *                                                             (Slice #27.05)
   *
   * ⚠️ **The loop above is keyed on `queryKey: ["document-types"]`, and this
   * fetcher has none** — the import dialog reads the list with a bare `fetch`
   * because it runs inside an effect, not a component subscription. So it was
   * invisible to the guard while depending on the guard's invariant harder than
   * either file above: it asks `documentTypeHasForm(item.templateFields)` of
   * every row to decide which types get a billed model read and which rows tell
   * the user their type has no form. Project the rows to `{ id, key, name }` —
   * an obvious tidy, since three of the four fields are all `ensureDocType`
   * wants — and every type reads as formless: one discovery read per distinct
   * type in the folder, and a header that says the whole archive is unfinished.
   */
  it("keeps the import dialog's own document-types fetcher unprojected", () => {
    const src = fs.readFileSync(
      path.join(SRC, "app/admin/import/_components/bulk-import-dialog.tsx"),
      "utf8",
    );
    expect(src).toContain("documentTypeHasForm(");
    expect(src).toMatch(/return body\.items \?\? \[\];/);
    // ⚠️ **And the CALLER too, which is where a projection would actually be
    // written** — an adversarial round pointed out that the fetcher above is
    // the tidy nobody makes. `templateFields` is OPTIONAL on `DocTypeRow`, so
    // `(await fetchDocTypeRows()).map(({ id, key, name }) => …)` type-checks,
    // lints, and makes `documentTypeHasForm(undefined)` false for every type:
    // one billed discovery read per distinct type in the folder, and a header
    // telling the user the whole archive is unfinished.
    expect(src).toMatch(/const items = await fetchDocTypeRows\(\);/);
    expect(src).not.toMatch(/fetchDocTypeRows\(\)[\s)]*\.map\(/);
  });

  it("has one marking surface, and it is that dropdown", () => {
    expect(productionFilesContaining("documentTypeOptionLabel(")).toEqual([
      FORM_FILE,
      "lib/documents/status.ts",
    ]);
  });
});

const SELECT_FIELD = functionBody(FORM_CODE, "function SelectField(");

describe("the SelectField slice this suite reads is the real one", () => {
  it("contains the whole control and nothing after it", () => {
    expect(SELECT_FIELD).toContain("<select");
    expect(SELECT_FIELD).toContain("</select>");
    expect(SELECT_FIELD).not.toContain("SurveyorPickerDialog");
    expect(SELECT_FIELD).not.toContain("<textarea");
  });
});

describe("the hint is not drawn as an error", () => {
  // Risk 2, in the rendering. The span that carries the hint is muted body
  // text; the red one below it is the validation message and stays that way.
  const hintSpan = /<span id=\{hintId\}[^>]*>/.exec(FORM_CODE)?.[0] ?? "";

  it("renders the hint in the muted secondary colour", () => {
    expect(hintSpan).toContain("text-fade");
  });

  it("is a span this test can actually see", () => {
    // Without this, a renamed `hintId` makes the regex miss, `hintSpan` becomes
    // "" and both assertions around it pass on an empty string.
    expect(hintSpan).not.toBe("");
  });

  it("gives it no alarm colour of any kind", () => {
    expect(hintSpan).not.toMatch(/red|amber|orange|yellow|emerald|border/);
  });

  // ⚠️ A review round rejected the first version of this, which named the field
  // with `aria-label` while the <label> still wrapped everything. It fixed the
  // name and silently dropped the ERROR from what a screen reader announces —
  // the error had only ever been read out because it fell inside that label. So
  // the label points at the control by id, and BOTH the hint and the error are
  // descriptions.
  it("names the field by its label and describes it with the hint AND the error", () => {
    expect(SELECT_FIELD).toContain("id={fieldId}");
    expect(SELECT_FIELD).toContain("htmlFor={fieldId}");
    expect(SELECT_FIELD).toContain("aria-describedby={describedBy || undefined}");
    // The joined list, in the order they are read out.
    expect(SELECT_FIELD).toContain("[hint ? hintId : null, error ? errorId : null]");
    expect(SELECT_FIELD).toContain("<span id={errorId}");
    // An aria-label would name the field a second time and win over the <label>.
    expect(SELECT_FIELD).not.toContain("aria-label=");
  });

  it("no longer wraps the control in the label that carries the sentence", () => {
    // A click anywhere inside a wrapping <label> activates the control, so
    // selecting the hint text to read it would pop the dropdown open in Chrome.
    //
    // ⚠️ Asserted as ORDER, not as the absence of `<label className=`. A review
    // round pointed out that this file writes multi-line tags, so a regression
    // that re-wrapped the field in `<label\n  className=…>` matches no such
    // substring and the guard would have passed through it. A label that CLOSES
    // before the control opens cannot contain it, however it is formatted.
    const closed = SELECT_FIELD.indexOf("</label>");
    const control = SELECT_FIELD.indexOf("<select");
    expect(closed).toBeGreaterThan(-1);
    expect(control).toBeGreaterThan(-1);
    expect(closed).toBeLessThan(control);
  });
});
