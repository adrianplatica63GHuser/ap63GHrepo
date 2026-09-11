/**
 * „+ Adaugă" says why it cannot be pressed.                      (Slice #34.20)
 *
 * The defect: `document-persons-modal.tsx` runs three queries and only
 * `assocQuery` had `isLoading` and `isError` on screen. The add form is
 * rendered by `showAdd && docTypesQuery.data && rolesQuery.data`, and the
 * button was disabled by `showAdd` ALONE — so with either lookup failed the
 * button was live, the press set `showAdd`, no form appeared, and the button
 * then disabled ITSELF. A press that produced nothing and then refused a second
 * try, with the reason on no screen anywhere.
 *
 * ⚠️ **THE FIX IS AN IDENTITY, NOT A PAIR OF CONDITIONS, AND THAT IS WHAT THIS
 * FILE GUARDS.** The button's enabled condition and the form's render condition
 * must be the same two facts. Written as `!isLoading && !isError` on one side
 * and `.data && .data` on the other they would agree today and part company on
 * the first state React Query grows — `isPaused` on a dropped connection is
 * neither loading nor error and has no data — and the gap is precisely the "a
 * press that renders nothing" state again. So the assertion below compares the
 * two expressions rather than checking each one.
 *
 * A BEHAVIOUR guard: comments are stripped before anything is matched, so a
 * docblock saying the right thing cannot make it pass. Slice #34.10, which made
 * Escape work on this dialog, guarded its own condition the same way and
 * deliberately left this one; its fix commit is worth reading before either is
 * touched, because the move that occasioned it broke three other things first.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";

const SRC = join(process.cwd(), "src");
const MODAL = "app/admin/value-lists/_components/document-persons-modal.tsx";

const code = stripComments(readFileSync(join(SRC, ...MODAL.split("/")), "utf8"));

/** The two lookups the add form is built from. Not `assocQuery`, which is the table's. */
const LOOKUPS = ["docTypesQuery", "rolesQuery"] as const;

/**
 * Every `<name>Query.data` an expression reads, in source order, de-duplicated.
 *
 * ⚠️ **EXTRACTED, NOT FILTERED FROM `LOOKUPS`, AND AN ADVERSARIAL ROUND IS WHY.**
 * The first draft of this file compared `LOOKUPS.filter(...)` on both sides of
 * the identity below — two filters of the same literal array, which can only
 * ever agree. The round rebuilt the #34.20 defect to prove it: a third lookup
 * added to the render condition and to `AddForm`'s props, `lookupsReady` left
 * alone, button live, press draws nothing — **and the suite stayed green.**
 * A guard that cannot see the shape it is written against is worse than none,
 * because the docblock claims it is watched. Reading the names OUT of the
 * source is what makes the comparison mean anything.
 */
function queriesReadIn(expression: string): string[] {
  const names = [...expression.matchAll(/\b(\w+Query)\.data\b/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

/**
 * The right-hand side of a `const <name> = …;`, whitespace collapsed.
 *
 * ⚠️ **TOLERANT OF A TYPE ANNOTATION AND OF PRETTIER, AND A SECOND ADVERSARIAL
 * ROUND MEASURED WHY.** The first draft matched `/const lookupsReady\s*=/` and
 * then dereferenced the result with `!`. Adding `: boolean` — a change that
 * alters nothing — turned three assertions red, and one of them died as
 * "Cannot read properties of null" rather than saying what it wanted. A guard
 * that fails on formatting spends a slice teaching the next author to distrust
 * it. Whitespace is collapsed for the same reason: every comparison below is
 * about the SHAPE of the expression, never about how it is wrapped.
 */
function declaredExpression(name: string): string {
  const found = code.match(new RegExp(`const\\s+${name}\\s*(?::[^=]+)?=\\s*([^;]+);`));
  if (!found) throw new Error(`no \`const ${name} = …;\` in ${MODAL}`);
  return found[1].replace(/\s+/g, " ").trim();
}

/**
 * The full opening tag of a JSX element, whitespace collapsed.
 *
 * Pinned in whole by the assertions below, so an attribute ADDED to one of
 * these spans — `aria-live="off"` is the one that matters — fails rather than
 * passing every needle. Whitespace is collapsed so prettier may wrap it, and
 * the `>` is matched with an optional space before it for the same reason: a
 * tag prettier keeps on one line has none, a tag it wraps has one.
 */
function openingTagOf(anchor: string): string {
  const at = code.indexOf(anchor);
  if (at < 0) throw new Error(`no \`${anchor}\` in ${MODAL}`);
  const open = code.lastIndexOf("<", at);
  const close = code.indexOf(">", at);
  if (open < 0 || close < 0) throw new Error(`could not bound the tag at \`${anchor}\``);
  return code.slice(open, close + 1).replace(/\s+/g, " ");
}

/**
 * Is every `{` and `(` opened in this window also closed in it?
 *
 * ⚠️ **THIS IS WHAT "NOT INSIDE A CONDITIONAL" ACTUALLY MEANS, AND A FOURTH
 * ADVERSARIAL ROUND IS WHY IT IS NOT A SEARCH FOR `&&`.** Both JSX conditionals
 * — `{cond && (` and `{cond ? (` — leave a brace and a paren open at the point
 * the element begins; a complete SIBLING element leaves nothing open. So the
 * balance answers the question, and an unrelated
 * `{assocQuery.isFetching && <span/>}` added between the button and this span
 * no longer fails a test about a different element, which the `&&` search did.
 * (`stripComments` has already collapsed the JSX comment above the span to a
 * balanced `{ }`, so it does not count either way.)
 */
function bracketsBalancedIn(window: string): boolean {
  let curly = 0;
  let round = 0;
  for (const ch of window) {
    if (ch === "{") curly++;
    else if (ch === "}") curly--;
    else if (ch === "(") round++;
    else if (ch === ")") round--;
  }
  return curly === 0 && round === 0;
}

/**
 * The class list of a pinned tag, as tokens.
 *
 * The tag regexes accept any `className`, so this is what reads it. A fourth
 * round got `empty:invisible` and `sr-only` past a `not.toContain("hidden")`
 * — `visibility: hidden` and an off-screen clip both take a node out of the
 * user's reach as surely as `display: none` — while `overflow-hidden`, which
 * is the natural companion of the `min-w-0` these spans already carry, failed
 * it. Whole tokens, and the variant is stripped: `empty:hidden` is `hidden`.
 */
function classTokensOf(tag: string): string[] {
  const found = tag.match(/className="([^"]*)"/);
  if (!found) throw new Error(`no literal className in ${tag}`);
  return found[1].split(/\s+/).filter(Boolean).map((token) => token.split(":").pop()!);
}

/** Classes that would take a node out of the accessibility tree or off screen. */
const REMOVES_FROM_VIEW = ["hidden", "invisible", "sr-only", "collapse"];

/** The source of one JSX element, from an attribute that identifies it. */
function elementAround(anchor: string): string {
  const at = code.indexOf(anchor);
  if (at < 0) throw new Error(`no \`${anchor}\` in ${MODAL}`);
  const open = code.lastIndexOf("<", at);
  const close = code.indexOf("</", at);
  if (open < 0 || close < 0) throw new Error(`could not bound the element at \`${anchor}\``);
  return code.slice(open, close);
}

describe("the document-persons modal reads its own source", () => {
  it("finds the modal", () => {
    expect(code).toContain("export function DocumentPersonsModal(");
    for (const lookup of LOOKUPS) expect(code).toContain(`const ${lookup} = useQuery(`);
  });
});

describe("both lookups have a loading and an error state", () => {
  /**
   * ⚠️ **THE OPERATOR IS ASSERTED, NOT ONLY THE OPERANDS, AND A SECOND
   * ADVERSARIAL ROUND IS WHY.** The first draft compared the SET of query names
   * on each side, which `&&` → `||` leaves untouched: with
   * `!!docTypesQuery.data || !!rolesQuery.data` a failed `person-roles` makes
   * `lookupsReady` true, the button live, the press draws nothing — #34.20's
   * defect verbatim — and the suite stayed green. Ready is a conjunction;
   * failed is a disjunction; neither is a matter of taste.
   */
  it("declares lookupsReady as the DATA of both, ANDed", () => {
    const expression = declaredExpression("lookupsReady");
    expect(queriesReadIn(expression)).toEqual([...LOOKUPS].sort());
    expect(expression).toMatch(/^!!\w+Query\.data && !!\w+Query\.data$/);
    // The paraphrase this must never become — see the header.
    expect(expression).not.toContain("isLoading");
    expect(expression).not.toContain("isError");
  });

  /**
   * ⚠️ **AND IT IS GUARDED BY `!lookupsReady`, WHICH A THIRD ADVERSARIAL ROUND
   * IS WHY.** React Query v5 sets `status: "error"` on a failed BACKGROUND
   * refetch while keeping `data`, and both mutations in this panel call
   * `qc.invalidateQueries()` with no filter — so a bare
   * `docTypesQuery.isError || rolesQuery.isError` put a red assertive „nu se
   * poate adăuga o asociere" beside a button that was still enabled and a form
   * that still drew. An earlier draft of this very assertion PINNED that
   * shape. Failed means failed with nothing to work with.
   */
  it("declares lookupsFailed as the error of either, and only when not ready", () => {
    const expression = declaredExpression("lookupsFailed");
    expect(expression).toMatch(
      /^!lookupsReady && \(\w+Query\.isError \|\| \w+Query\.isError\)$/,
    );
    const named = [...expression.matchAll(/\b(\w+Query)\.isError\b/g)].map((m) => m[1]);
    expect([...new Set(named)].sort()).toEqual([...LOOKUPS].sort());
  });

  /**
   * The two sentences must partition „not ready": a state that is neither
   * `lookupsFailed` nor the wait's condition would disable the button and say
   * nothing, which is the silence this slice removes wearing a third face.
   */
  it("leaves no not-ready state without a sentence", () => {
    const wait = code.replace(/\s+/g, " ");
    expect(wait).toContain("{!lookupsReady && !lookupsFailed && (");
    expect(declaredExpression("lookupsFailed")).toContain("!lookupsReady &&");
  });
});

describe("the add button cannot open a form that does not draw", () => {
  /**
   * ⚠️ **THE ASSERTION THIS FILE EXISTS FOR.** Both conditions are extracted
   * and compared: the button is gated on `lookupsReady`, and `lookupsReady` is
   * declared from exactly the lookups the form is rendered by. A third query
   * added to the form without being added to the gate reopens the defect, and
   * fails here.
   */
  it("gates the button on the same two lookups the form is rendered by", () => {
    // ⚠️ THE ADD BUTTON's `disabled`, found from the label rather than by
    // taking the first one in the file: `AddForm` is declared above the modal
    // and its Save button has a `disabled` of its own, so a bare
    // `/disabled=\{/` would have asserted about the wrong control and passed
    // while this one stayed ungated.
    const label = code.indexOf('+ {t("add")}');
    expect(label).toBeGreaterThan(0);
    const before = code.slice(0, label);
    const gate = before.slice(before.lastIndexOf("disabled={")).match(/disabled=\{([^}]+)\}/);
    expect(gate).not.toBeNull();
    // ⚠️ **THE WHOLE EXPRESSION.** Two `toContain`s are satisfied by
    // `showAdd && !lookupsReady`, which is enabled whenever the form is closed
    // — the defect again, with both needles present. A second adversarial round
    // shipped that mutant past the first draft of this assertion.
    expect(gate![1].replace(/\s+/g, " ").trim()).toBe("showAdd || !lookupsReady");

    const render = code.match(/\{showAdd\s*&&\s*([^(]+?)&&\s*\(/);
    if (!render) throw new Error("no `{showAdd && … && (` add-form render condition");
    const renderedFrom = queriesReadIn(render[1]);
    expect(renderedFrom).toEqual([...LOOKUPS].sort());

    // ⚠️ THE IDENTITY. Both sides are read out of the source, so a lookup added
    // to one and not the other is a set difference and fails here.
    expect(queriesReadIn(declaredExpression("lookupsReady"))).toEqual(renderedFrom);
  });

  /**
   * The Escape handler guards on the same name. #34.10 wrote it as the raw pair
   * because there was no name to use; leaving it that way after this slice
   * would be the third place the same fact is spelled out.
   */
  it("the Escape guard uses the same name rather than a third copy", () => {
    expect(code).toContain("if (showAdd && lookupsReady)");
  });
});

describe("the reason is on screen, not only in the button's silence", () => {
  it("says which of the two states it is", () => {
    expect(elementAround("id={lookupHintId}").replace(/\s+/g, " ")).toContain(
      '{lookupsFailed ? t("lookupsError") : ""}',
    );
    expect(elementAround("id={lookupWaitId}").replace(/\s+/g, " ")).toContain(
      '{t("lookupsLoading")}',
    );
    // The wait span draws only while there is a wait, and never over a failure.
    expect(code.replace(/\s+/g, " ")).toContain("{!lookupsReady && !lookupsFailed && (");
  });

  /**
   * ⚠️ **THE LIVE REGION IS MOUNTED BEFORE IT HAS ANYTHING TO SAY.** This file
   * states the rule 100 lines below, on #29.13's delete refusal: a region
   * mounted together with its text is not reliably announced. The first draft
   * of #34.20 rendered the span inside `{!lookupsReady && (…)}` and switched
   * `role` on with the content — the same mistake, in the same file, found by
   * an adversarial round. `role="alert"` is a bare literal here so a future
   * `role={… ? "alert" : undefined}` cannot slip back in.
   */
  /**
   * ⚠️ **THE WHOLE OPENING TAG, NOT A LIST OF NEEDLES, AND A THIRD ADVERSARIAL
   * ROUND IS WHY.** Needle assertions let `aria-live="off"` be added beside
   * `role="alert"` — an explicit `aria-live` overrides the role's implicit
   * assertive, so the failure is never announced and every needle still
   * matches. Pinning the tag makes any extra attribute a failure, which is the
   * only shape of assertion that survives an author who is adding rather than
   * removing.
   */
  it("keeps the live region mounted and always live", () => {
    // ANCHORED TO THE SPAN, NOT TO THE FILE (second round): a bare
    // `code.toContain('role="alert"')` was satisfied by #29.13's
    // delete-refusal `<p role="alert">` 100 lines below.
    const tag = openingTagOf("id={lookupHintId}");
    expect(tag).toMatch(
      /^<span id=\{lookupHintId\} role="alert" className="[^"]*" ?>$/,
    );
    // `display:none` — and `visibility:hidden`, and `sr-only` — take a node out
    // of the accessibility tree or off the screen, which is the same defect
    // wearing a utility class. Whole tokens: `overflow-hidden` is not one.
    for (const token of classTokensOf(tag)) {
      expect(REMOVES_FROM_VIEW).not.toContain(token);
    }
  });

  /**
   * ⚠️ **AND NOT INSIDE A CONDITIONAL — CHECKED OVER THE WHOLE TOOLBAR, NOT THE
   * 80 CHARACTERS BEFORE THE TAG.** A third round wrapped the span AND its
   * 25-line comment in `{lookupsFailed && (<>…`: after `stripComments` those
   * 80 characters are comment residue, the `&&` sat outside them, and round
   * one's finding was back with the suite green.
   */
  it("mounts the live region unconditionally", () => {
    // ⚠️ **THE ORDER IS ASSERTED BEFORE THE WINDOW IS TAKEN.** `slice(a, b)`
    // with `b < a` answers `""`, and `""` contains no conditional — so hoisting
    // the span above the button, or out into a
    // `const hintSpan = lookupsFailed ? (…) : null` beside `lookupsReady`,
    // passed this silently. A fourth adversarial round shipped both.
    //
    // ⚠️ **AND THE WINDOW OPENS AT THE PANEL BODY, NOT AT THE BUTTON GROUP,
    // WHICH A FIFTH ROUND IS WHY.** Anchored at the group, everything ABOVE the
    // group was unwatched — so wrapping the whole toolbar in
    // `{!lookupsFailed && (…)}` unmounted the live region and the button at
    // exactly the moment the failure arrived, left `aria-describedby` pointing
    // at a node that no longer existed, and passed. A conditional one level up
    // is the same defect; the window has to start above every level.
    const body = code.indexOf('<div className="overflow-y-auto p-5">');
    const group = code.indexOf('<div className="flex min-w-0 items-center gap-3">');
    const at = code.indexOf("id={lookupHintId}");
    expect(body).toBeGreaterThan(0);
    expect(group).toBeGreaterThan(body);
    expect(at).toBeGreaterThan(group);

    expect(bracketsBalancedIn(code.slice(body, code.lastIndexOf("<", at)))).toBe(true);
  });

  /**
   * ⚠️ **AND IT STANDS BESIDE THE BUTTON, WHICH IS A FACT AND NOT A COMMENT.**
   * A fifth round moved the span out of the button group and past the count, so
   * the reason rendered at the far right of the toolbar while every a11y
   * assertion above still held. „Beside the button it disables" is the whole
   * design of this fix; nothing else was checking it.
   */
  it("keeps the sentence inside the button's own group", () => {
    const group = code.indexOf('<div className="flex min-w-0 items-center gap-3">');
    const at = code.indexOf("id={lookupHintId}");
    // The group's own closing tag: the first `</div>` after it at which the
    // divs opened since balance out.
    let depth = 0;
    let closes = group;
    for (const m of code.slice(group).matchAll(/<div\b|<\/div>/g)) {
      depth += m[0] === "</div>" ? -1 : 1;
      if (depth === 0) {
        closes = group + (m.index ?? 0);
        break;
      }
    }
    expect(closes).toBeGreaterThan(group);
    expect(at).toBeLessThan(closes);
  });

  /**
   * The WAIT is not announced. `role="alert"` is assertive, and a region that
   * mounts already holding „Se încarcă listele…" fires in the same commit as
   * #34.10's `listPanelRef.current?.focus()` — so every open of this panel
   * interrupted the dialog's own name with a loading hint. Two spans, and the
   * wait's tag is pinned too: `aria-live="assertive"` on it is that finding
   * restored without a `role` anywhere (third round).
   */
  it("does not announce the wait", () => {
    const tag = openingTagOf("id={lookupWaitId}");
    expect(tag).toMatch(/^<span id=\{lookupWaitId\} className="[^"]*" ?>$/);
    for (const token of classTokensOf(tag)) {
      expect(REMOVES_FROM_VIEW).not.toContain(token);
    }
    expect(elementAround("id={lookupHintId}")).not.toContain("lookupsLoading");
  });

  /**
   * The sentence must be tied to the button, and to the one that is actually
   * PRESENT: the failure span is empty while the wait span is showing.
   * Whitespace-insensitive — see `declaredExpression` for what a literal-space
   * regex cost the first draft.
   */
  it("describes the button with whichever sentence is present", () => {
    const at = code.indexOf('+ {t("add")}');
    const button = code.slice(code.lastIndexOf("<button", at), at);
    expect(button.replace(/\s+/g, " ")).toContain(
      "aria-describedby={ lookupsFailed ? lookupHintId : lookupsReady ? undefined : lookupWaitId }",
    );
  });
});

describe("both message files carry both sentences", () => {
  const locales = ["ro-RO", "en-GB"] as const;

  it.each(locales)("%s", (locale) => {
    const root = JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
    ) as { valueList: { documentPersons: Record<string, string> } };
    const block = root.valueList.documentPersons;
    for (const key of ["lookupsLoading", "lookupsError"]) {
      expect(typeof block[key]).toBe("string");
      expect(block[key].trim()).not.toBe("");
    }
    /**
     * ⚠️ **THE FAILURE SENTENCE MUST TELL THE USER WHAT TO DO, AND THIS ASSERTS
     * THAT RATHER THAN ITS LENGTH.** The first draft compared it against
     * `lookupsLoading.length`, which „Eroare la încărcarea listelor" passes
     * while instructing nobody. Retrying is out of #34.20's scope —
     * `refetchOnWindowFocus` is off globally and stays off — so reloading is
     * the honest instruction, and it is the one the copy has to give.
     */
    expect(block.lookupsError).toContain(locale === "ro-RO" ? "Reîncărcați" : "Reload");
  });
});
