/**
 * The CNP field says it is locked, the way the CUI field already did.
 *                                                                (Slice #32.18)
 *
 * WHAT WAS WRONG
 * ──────────────
 * `natural_person_lock_cnp` refuses the UPDATE in the database and
 * `src/lib/api/errors.ts` turns that refusal into a 400. The form said nothing:
 * the user typed a new CNP, pressed Save, and learned the rule from a failed
 * save. `naturalPerson.hints.cnpLocked` had been written for exactly this and
 * had no call site anywhere in `src/` — which is why the asymmetry with the
 * judicial-person form read as an omission rather than a decision.
 *
 * WHAT IS GUARDED, AND WHAT IS DELIBERATELY NOT
 * ─────────────────────────────────────────────
 * The fix is a hint, NOT a disabled input, and that is the interesting thing to
 * pin: the judicial form's `Field` accepts no `disabled` prop at all, the input
 * stays editable, and the database remains the thing that refuses. A later
 * change that "improves" this by disabling the field would make the two forms
 * behave differently again, in the opposite direction — so the parity, both
 * halves of it, is asserted here.
 *
 * These are source reads rather than a render. `natural-person-form.tsx`
 * imports next-intl, which is ESM-only and is not transformed by `next/jest`
 * (`src/test-support/icu.ts` has the long form), so the component cannot be
 * mounted in this suite at all.
 *
 * The assertions read CODE, not comments: every source string checked here is
 * stripped of its comments first. A NAME guard may read comments; a BEHAVIOUR
 * guard must not.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

/** Remove `//` and block comments so a guard cannot be satisfied by prose. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const NATURAL = codeOnly(
  read("src", "app", "natural-persons", "_components", "natural-person-form.tsx"),
);
const JUDICIAL = codeOnly(
  read("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"),
);

const LOCALES = ["en-GB", "ro-RO"] as const;
type Locale = (typeof LOCALES)[number];

type MessageNode = { [key: string]: MessageNode | string };
const MESSAGES = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(read("messages", `${l}.json`)) as MessageNode]),
) as Record<Locale, MessageNode>;

function hint(locale: Locale, name: string): string {
  const hints = MESSAGES[locale].naturalPerson as MessageNode | undefined;
  const value = (hints?.hints as MessageNode | undefined)?.[name];
  if (typeof value !== "string") throw new Error(`naturalPerson.hints.${name} missing in ${locale}`);
  return value;
}

describe("naturalPerson.hints.cnpLocked is used", () => {
  it("has a call site — the orphan this slice closed", () => {
    // The finding was not that the copy was wrong. It was that the copy
    // existed and nothing rendered it. Grep the whole of src/, not just the
    // one form, so moving the hint elsewhere still counts.
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && fs.readFileSync(full, "utf8").includes("hints.cnpLocked")) {
          hits.push(path.relative(ROOT, full));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    // This suite itself lives under src/ and names the key, so exclude it.
    const appHits = hits.filter((f) => !f.includes("__tests__"));
    expect(appHits.length).toBeGreaterThan(0);
  });

  it("exists in both locales and takes no placeholder", () => {
    for (const locale of LOCALES) {
      expect(hint(locale, "cnpLocked").length).toBeGreaterThan(0);
      expect(hint(locale, "cnpLocked")).not.toMatch(/\{/);
    }
  });

  it("offers the same escape route the trigger names", () => {
    // The trigger raises "CNP cannot be changed once set; delete and recreate
    // the person instead". If that remedy ever changes, the hint is telling
    // the user to do something the database no longer supports.
    const schema = read("drizzle", "0000_initial_schema.sql");
    expect(schema).toContain("CNP cannot be changed once set; delete and recreate the person instead");
    expect(hint("en-GB", "cnpLocked").toLowerCase()).toContain("delete");
    expect(hint("en-GB", "cnpLocked").toLowerCase()).toContain("recreate");
  });
});

describe("the natural-person form mirrors the judicial-person form", () => {
  it("shows the hint whenever the field is editable, not merely when mode says edit", () => {
    // The judicial model keys off the `mode` PROP. This form keys off
    // `effectiveMode`, which is what <fieldset disabled> obeys — and the two
    // disagree on the one path the hint exists for: a person opened read-only
    // from an association tab whose Modify button sets `associatedEditing`.
    // There the CNP input is typable and `mode` is still "view".
    expect(NATURAL).toMatch(
      /const cnpIsLocked\s*=\s*effectiveMode === "edit" && Boolean\(initialValues\?\.cnp\?\.trim\(\)\)/,
    );
    // `effectiveMode` is the thing the disabled fieldset reads, so the hint and
    // the editability cannot drift apart.
    expect(NATURAL).toMatch(/<fieldset disabled=\{effectiveMode === "view"\}/);
    // The model, unchanged and deliberately not edited by this slice.
    expect(JUDICIAL).toMatch(
      /const cuiIsLocked\s*=\s*mode === "edit" && Boolean\(initialValues\?\.cuiNumber\?\.trim\(\)\)/,
    );
  });

  it("passes the hint on the field itself, and only when locked — as a bubble since #37.50", () => {
    expect(NATURAL).toMatch(/bubble=\{cnpIsLocked \? t\("hints\.cnpLocked"\) : undefined\}/);
    expect(JUDICIAL).toMatch(/bubble=\{cuiIsLocked \? t\("hints\.cuiLocked"\) : undefined\}/);
  });

  it("puts the hint on the CNP field, and leaves that field editable", () => {
    // The whole <Field …name="cnp"… /> element, not a fixed-size window, so
    // the assertions below cannot drift out of range as the file grows.
    const anchor = NATURAL.indexOf('name="cnp"');
    expect(anchor).toBeGreaterThan(-1);
    expect(NATURAL.indexOf('name="cnp"', anchor + 1)).toBe(-1); // exactly one
    const open = NATURAL.lastIndexOf("<Field", anchor);
    const close = NATURAL.indexOf("/>", anchor);
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    const cnpField = NATURAL.slice(open, close + 2);
    // If the element ever stops being self-closing, `close` runs on to the
    // next `/>` in the file and the window silently swallows its neighbours.
    // Fail loudly there rather than asserting against the wrong text.
    expect(cnpField.length).toBeLessThan(600);

    expect(cnpField).toContain("hints.cnpLocked");
    expect(cnpField).not.toMatch(/\b(disabled|readOnly)\b/);
  });

  it("uses the lock for the hint and for nothing else", () => {
    // The window above only sees the <Field> element, so it cannot see a lock
    // placed on a WRAPPER — `<fieldset disabled={cnpIsLocked}>` around it, or
    // a `pointer-events-none` div. This is the guard that catches those: the
    // flag is allowed to appear exactly twice in the whole file, where it is
    // declared and where it feeds `hint=`. Any third use is a client-side
    // block by construction, whatever it is spelled, and that is the
    // divergence from the judicial form this suite exists to prevent.
    const uses = (source: string, name: string) =>
      source.match(new RegExp(`\\b${name}\\b`, "g"))?.length ?? 0;
    expect(uses(NATURAL, "cnpIsLocked")).toBe(2);
    expect(uses(JUDICIAL, "cuiIsLocked")).toBe(2);
  });

  it("neither form's Field even accepts a lock prop", () => {
    // Belt and braces on the check above, and the reason a stray
    // `disabled={…}` on either field would be a `tsc` error rather than a
    // silently ignored attribute: the prop does not exist.
    for (const source of [NATURAL, JUDICIAL]) {
      const props = /type FieldProps = \{[\s\S]*?\n\};/.exec(source);
      expect(props).not.toBeNull();
      expect(props![0]).not.toMatch(/\b(disabled|readOnly)\b/);
    }
  });
});

/** The body of a form's own `function Field(…)`, comments already stripped. */
function fieldBody(source: string): string {
  const start = source.indexOf("function Field(");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\n}\n", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("the lock note is a bubble, not a line under the field (Slice #37.50)", () => {
  it.each([
    ["natural", NATURAL],
    ["judicial", JUDICIAL],
  ])("%s: Field prints no hint under the box — the sentence goes to HintBubble, with no ⓘ", (_which, source) => {
    const body = fieldBody(source);
    // The permanent caption #32.18 drew is gone.
    expect(body).not.toMatch(/\bhint\b/);
    expect(body).not.toContain("text-xs text-fade");
    // The bubble, only when there is a sentence, its text the field's description.
    expect(body).toMatch(/\{bubble \? \(\s*<HintBubble id=\{bubbleId\} text=\{bubble\}>/);
    expect(body).not.toContain("triggerLabel");
    expect(body).toContain("const describedBy = bubble ? bubbleId : undefined;");
    expect(body.split("aria-describedby={describedBy}").length - 1).toBe(2);
    // Named by its label alone: the sentence sits inside the <label>.
    expect(body).toContain("<span id={labelId} className={STACKED_LABEL_CLASS}>{label}</span>");
    expect(body.split("aria-labelledby={labelledBy}").length - 1).toBe(2);
  });

  it("no bubble without a saved value or in view mode — the same lock as before", () => {
    // Unchanged from #32.18: the flag is false on a new person (no initialValues),
    // an empty CNP (trim), and wherever the fieldset is disabled (effectiveMode).
    expect(NATURAL).toMatch(/const cnpIsLocked\s*=\s*effectiveMode === "edit" && Boolean\(initialValues\?\.cnp\?\.trim\(\)\)/);
    expect(JUDICIAL).toMatch(/const cuiIsLocked\s*=\s*mode === "edit" && Boolean\(initialValues\?\.cuiNumber\?\.trim\(\)\)/);
  });
});

describe("the refusal on save is said in Romanian (Slice #37.50)", () => {
  // Measured in #37.50 before the change: a changed CNP saved on a Romanian
  // screen showed „CNP cannot be changed once set; delete and recreate the
  // person instead" — the trigger's sentence, passed through by errors.ts.
  const ERRORS = codeOnly(read("src", "lib", "api", "errors.ts"));
  const SAFE = codeOnly(read("src", "lib", "api", "safe-mutate.ts"));

  it("the route tags each lock's refusal with a code, beside the trigger's sentence", () => {
    expect(ERRORS).toContain('Response.json({ error: message, code: "CNP_LOCKED" }, { status: 400 })');
    expect(ERRORS).toContain('Response.json({ error: message, code: "CUI_LOCKED" }, { status: 400 })');
  });

  it("each form shows its own Romanian sentence for its code — the same spelling on both sides", () => {
    expect(NATURAL).toMatch(/refusalCode\(err\) === "CNP_LOCKED"\s*\?\s*t\("hints\.cnpLocked"\)/);
    expect(JUDICIAL).toMatch(/refusalCode\(err\) === "CUI_LOCKED"\s*\?\s*t\("hints\.cuiLocked"\)/);
    expect(SAFE).toContain("export function refusalCode(err: unknown): string | undefined");
  });

  it("names the CUI's remedy too", () => {
    const sql = read("src", "db", "supabase_schema_full.sql");
    expect(sql).toContain("CUI cannot be changed once set; delete and recreate the judicial person instead");
    const cui = ((MESSAGES["en-GB"].judicialPerson as MessageNode).hints as MessageNode).cuiLocked as string;
    expect(cui.toLowerCase()).toContain("delete");
    expect(cui.toLowerCase()).toContain("recreate");
    expect(((MESSAGES["ro-RO"].judicialPerson as MessageNode).hints as MessageNode).cuiLocked).toBeTruthy();
  });
});
