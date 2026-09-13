/**
 * A printed value says what it is the value OF.                 (Slice #34.28)
 *
 * WHAT IS AT RISK
 * ---------------
 * `<ReadOnlyField>` renders a `<span>` beside a `<div>` with nothing tying them
 * together. There is no control for a `<label>` to wrap, so the association has
 * to be made explicitly — and until this slice it was not, which meant a screen
 * reader announced „412,75" with no idea it was the calculated area. #34.17 gave
 * the printed SNAPSHOT box `role="group"` + `aria-labelledby` and wrote in place
 * that `<ReadOnlyField>` „predates this and still has that gap"; this closes it.
 *
 * ⚠️ **A SOURCE GUARD RATHER THAN A RENDER, AND THAT IS A LIMIT WORTH STATING.**
 * `ReadOnlyField` is module-private inside `property-form.tsx`, and no suite in
 * this repo imports a `_components/*-form` component — the four of them pull in
 * Google Maps, react-hook-form and a react-query provider at module load.
 * #34.28's out-of-scope list forbids extracting the component to make it
 * importable. So this reads the source with comments stripped, which makes it a
 * BEHAVIOUR guard in this repo's terms: a sentence in a comment cannot satisfy
 * it. What it cannot do is prove the rendered accessible NAME, and `npm run e2e`
 * is where that would live.
 */

import fs from "node:fs";
import path from "node:path";

import { stripComments } from "@/lib/dev/strip-comments";

const FORM = path.join(
  process.cwd(), "src", "app", "properties", "_components", "property-form.tsx",
);

/** Just the `ReadOnlyField` function, so a match cannot come from a neighbour. */
function readOnlyFieldSource(): string {
  const code = stripComments(fs.readFileSync(FORM, "utf8"));
  const start = code.indexOf("function ReadOnlyField(");
  expect(start).toBeGreaterThan(-1);
  const next = code.indexOf("\nfunction ", start + 1);
  return code.slice(start, next === -1 ? undefined : next);
}

describe("ReadOnlyField", () => {
  const source = readOnlyFieldSource();

  it("is a group named by its own label", () => {
    expect(source).toContain('role="group"');
    expect(source).toContain("aria-labelledby={labelId}");
    expect(source).toContain("id={labelId}");
  });

  it("generates the id rather than deriving it from the label", () => {
    // Two read-only fields share this screen and the component takes no `name`,
    // so a label-derived id collides the day two of them read the same word —
    // and a colliding `aria-labelledby` announces the WRONG field rather than
    // failing, which is the class of bug that never gets reported.
    // ⚠️ **BOUND TO `labelId`, NOT JUST „a `useId()` appears".** A review round
    // kept `const valueId = useId();` on another node and changed `labelId`
    // back to a label-derived template — a lint-clean refactor — and the bare
    // `toContain("useId()")` stayed green over the collision this test names.
    expect(source).toContain("const labelId = useId();");
  });

  it("names the label TEXT, not the cell that also holds the HelpHint", () => {
    /**
     * ⚠️ **THE ONE THING THE SLICE DESCRIPTION COULD NOT HAVE KNOWN.** The
     * description called this „one attribute each", which it is on the snapshot
     * box — that box has no hint. Here the label cell also renders `{hint}`, a
     * `<HelpHint>`, which is a `<button aria-label="Indiciu">` and, once opened,
     * a `<p>` holding the whole hint paragraph. `aria-labelledby` takes the
     * named element's SUBTREE, so naming the outer cell would have made this
     * group's accessible name „Suprafață calculată Indiciu" — and, with the hint
     * open, the entire hint. The id therefore sits on an inner span wrapping the
     * label alone.
     *
     * Asserted structurally: the id must be introduced on a span that contains
     * `{label}` and nothing else, and the `{hint}` must be its sibling.
     */
    expect(source).toMatch(/<span id=\{labelId\}>\{label\}<\/span>/);
    expect(source).toMatch(/<span id=\{labelId\}>\{label\}<\/span>\s*\{hint\}/);
    // And the outer cell — the one carrying the width class — must not be it.
    expect(source).not.toMatch(/className="w-24[^"]*"\s+id=\{labelId\}/);
  });
});

describe("the comment that described the gap", () => {
  it("no longer says ReadOnlyField still has it", () => {
    // Read WITH comments on purpose: this is a NAME guard, not a behaviour one,
    // and what it guards is a sentence. #34.28 required the comment at the
    // snapshot box to be corrected in the same commit rather than left
    // describing a gap that has gone — a stale comment here is how the next
    // slice re-opens a fixed bug looking for it.
    const withComments = fs.readFileSync(FORM, "utf8");
    expect(withComments).not.toContain("still has that gap; it is in the handover");
    expect(withComments).toContain("Slice #34.28 closed it there");
  });
});
