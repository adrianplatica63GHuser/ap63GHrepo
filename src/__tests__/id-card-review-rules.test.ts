/**
 * Slice #34.13 — the two decisions the ID-card review dialog makes about a
 * value it did not read off the card.
 *
 * Both shipped as inline expressions, and both were wrong in the same way: a
 * control showed one thing and the submit wrote another. The institution
 * picker opened on the matcher's guess while the Document held a different row;
 * Confirm wrote the citizenship read off the card while the select showed „—".
 *
 * ⚠️ **ASSERTED ON THE RULE AND ON THE WIRING, NOT ON A SENTENCE.** The rules
 * are pure functions and are exercised directly. What a source-text sweep adds
 * is the other half — that the dialog actually ROUTES its picker and its POST
 * through them — because a rule nothing calls passes every test in this file
 * while the defect stays live. Comments are stripped before any of those
 * assertions, so no claim here can be satisfied by prose.
 *
 * (Rendering the dialog instead was considered and not done: it opens with
 * three fetches, a next-intl provider and a React Query client, and a test that
 * mocks all of it asserts mostly its own mocks. The rules are where the
 * behaviour is.)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  citizenshipForWrite,
  citizenshipIsHidden,
  institutionForCardWrite,
  institutionSelectSeed,
} from "@/lib/import/id-card-review";

const SRC = join(process.cwd(), "src");
const read = (...parts: string[]): string => readFileSync(join(SRC, ...parts), "utf8");

/**
 * Remove // line comments and block comments, so no assertion below is
 * satisfied by prose rather than by code. Same shape as the helper in
 * `async-select-single-source.test.ts`, and for the same reason: this file's
 * subject is a comment-heavy component.
 */
function stripComments(src: string): string {
  return src
    .replace(/(^|[\s[({,;=>)\]])\/\*[\s\S]*?\*\//g, "$1")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const DIALOG = ["app", "admin", "import", "_components", "id-card-person-dialog.tsx"] as const;

const DOC = "11111111-1111-1111-1111-111111111111";
const MATCHED = "22222222-2222-2222-2222-222222222222";

// ---------------------------------------------------------------------------
// institutionSelectSeed
// ---------------------------------------------------------------------------

describe("institutionSelectSeed — what the picker opens on", () => {
  it("opens on the DOCUMENT's institution when it has one", () => {
    // The defect: `institutionId` was seeded from the matcher and from nothing
    // else, so a document already filed under an institution showed a row it
    // does not hold — and the user could not see what they were about to keep.
    expect(
      institutionSelectSeed({ documentInstitutionId: DOC, matchedInstitutionId: MATCHED }),
    ).toBe(DOC);
  });

  it("opens on the document's institution even when the matcher found nothing", () => {
    expect(institutionSelectSeed({ documentInstitutionId: DOC })).toBe(DOC);
    expect(
      institutionSelectSeed({ documentInstitutionId: DOC, matchedInstitutionId: null }),
    ).toBe(DOC);
  });

  it("falls back to the matcher's answer on a document with no institution", () => {
    // #34.02's behaviour, unchanged: on a fresh import the document is blank
    // and the matcher's suggestion is the whole point of the control.
    expect(
      institutionSelectSeed({ documentInstitutionId: null, matchedInstitutionId: MATCHED }),
    ).toBe(MATCHED);
    expect(institutionSelectSeed({ matchedInstitutionId: MATCHED })).toBe(MATCHED);
  });

  it("opens empty when neither answered", () => {
    expect(institutionSelectSeed({})).toBe("");
    expect(
      institutionSelectSeed({ documentInstitutionId: null, matchedInstitutionId: null }),
    ).toBe("");
  });

  it("treats a whitespace-only id as absent, and trims the one it takes", () => {
    expect(
      institutionSelectSeed({ documentInstitutionId: "   ", matchedInstitutionId: MATCHED }),
    ).toBe(MATCHED);
    expect(institutionSelectSeed({ documentInstitutionId: `  ${DOC} ` })).toBe(DOC);
  });
});

// ---------------------------------------------------------------------------
// institutionForCardWrite
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THE RULE THIS FILE EXISTS FOR MOST, and it was not in #34.13's first
 * draft.** Seeding the picker from the document is the visible half of item 4;
 * the invisible half is that the seeded value must NOT then be sent to
 * `documentFieldsFromIdCard` as `card.institutionId`. That id would make
 * `sameInstitutionAlready` true because it was COPIED from `current`, which
 * suppresses the `subject` fallback — while write-if-empty already blocks the
 * FK. The card's authority would reach neither column. The first adversarial
 * round on this slice found it; these assertions are what stop it coming back.
 */
describe("institutionForCardWrite — whose answer is on screen", () => {
  it("refuses a seeded value the matcher did not name", () => {
    // Which is the document's own institution echoed back at it: seeded from
    // the document, matcher missed — and the matcher misses on EVERY identity
    // card today, because no seeded institution is a card issuer.
    //
    // The document is deliberately not a parameter. „Not chosen and not
    // matched" refuses whatever it holds, and a first draft that took it and
    // never read it made this very assertion pass for the wrong reason.
    expect(
      institutionForCardWrite({ selected: DOC, chosen: false, matchedInstitutionId: null }),
    ).toBeNull();
    expect(institutionForCardWrite({ selected: DOC, chosen: false })).toBeNull();
  });

  it("sends it when the MATCHER named the same row the document holds", () => {
    // The ordinary second pass over one card: the first click wrote the FK, the
    // second click's matcher now hits that row. `sameInstitutionAlready` is
    // then true for the right reason, and #34.02's second review round is why
    // the prose must not be written beside it.
    expect(
      institutionForCardWrite({ selected: DOC, chosen: false, matchedInstitutionId: DOC }),
    ).toBe(DOC);
  });

  it("sends the matcher's answer on a document that holds none", () => {
    expect(
      institutionForCardWrite({ selected: MATCHED, chosen: false, matchedInstitutionId: MATCHED }),
    ).toBe(MATCHED);
  });

  it("sends whatever a PERSON picked, including over the document's own", () => {
    expect(
      institutionForCardWrite({ selected: MATCHED, chosen: true, matchedInstitutionId: null }),
    ).toBe(MATCHED);
  });

  it("refuses an empty picker however it got there", () => {
    // A person who cleared it back to „—" has said „nobody has placed this",
    // which is exactly the state the `subject` line answers.
    expect(institutionForCardWrite({ selected: "", chosen: true })).toBeNull();
    expect(institutionForCardWrite({ selected: "   ", chosen: false })).toBeNull();
    expect(institutionForCardWrite({ selected: "", chosen: false })).toBeNull();
  });

  it("trims what it sends and what it compares", () => {
    expect(
      institutionForCardWrite({
        selected: ` ${MATCHED} `,
        chosen: false,
        matchedInstitutionId: `${MATCHED}  `,
      }),
    ).toBe(MATCHED);
  });
});

// ---------------------------------------------------------------------------
// citizenshipForWrite / citizenshipIsHidden
// ---------------------------------------------------------------------------

describe("citizenshipForWrite — Confirm never writes what the select hides", () => {
  const LIST = [{ value: "ro" }, { value: "md" }];

  it("writes the citizenship the select can show", () => {
    expect(citizenshipForWrite("ro", LIST)).toBe("ro");
  });

  it("refuses one no option matches — the failed-list case", () => {
    // The defect, exactly: the id is in `_formValues`, `<AsyncSelect>` is
    // uncontrolled, the field renders „—", and Confirm wrote it anyway.
    expect(citizenshipForWrite("ro", [])).toBe("");
  });

  it("refuses one no option matches — the deleted-row case", () => {
    // A list that loaded perfectly and no longer holds that row. Asking the
    // OPTIONS rather than a load state is what covers this too: gating on
    // `listState === "failed"` would have written a dangling id here.
    expect(citizenshipForWrite("xx", LIST)).toBe("");
  });

  it('answers "" for a form that holds no citizenship at all', () => {
    expect(citizenshipForWrite("", LIST)).toBe("");
    expect(citizenshipForWrite(null, LIST)).toBe("");
    expect(citizenshipForWrite(undefined, LIST)).toBe("");
    expect(citizenshipForWrite("   ", LIST)).toBe("");
  });

  it("matches on the trimmed value and returns it trimmed", () => {
    expect(citizenshipForWrite(" ro ", LIST)).toBe("ro");
  });

});

describe("citizenshipIsHidden — the sentence and the write agree", () => {
  const LIST = [{ value: "ro" }];

  it("is true exactly when a held value has no option", () => {
    expect(citizenshipIsHidden("ro", [])).toBe(true);
    expect(citizenshipIsHidden("xx", LIST)).toBe(true);
  });

  it("is false when the value can be shown", () => {
    expect(citizenshipIsHidden("ro", LIST)).toBe(false);
  });

  it("is false when the form holds nothing — „—” is then the truth", () => {
    // An empty select over an empty value needs no sentence: it is not hiding
    // anything, and a red line there would be an alarm about nothing.
    expect(citizenshipIsHidden("", [])).toBe(false);
    expect(citizenshipIsHidden(null, [])).toBe(false);
    expect(citizenshipIsHidden("  ", LIST)).toBe(false);
  });

  it("never lets a hidden value through, and never blocks a shown one", () => {
    // The two must be one decision, asserted as the CONTRACT between them
    // rather than by restating either one's body — which would pass for any
    // implementation written that way and for no other reason.
    for (const held of ["ro", "xx", "", "   ", null, undefined]) {
      for (const options of [[], LIST]) {
        const where = [held, options.length];
        if (citizenshipIsHidden(held, options)) {
          // Hidden means: there is something to lose, and it is not written.
          expect([...where, citizenshipForWrite(held, options)]).toEqual([...where, ""]);
          expect([...where, (held ?? "").trim()]).not.toEqual([...where, ""]);
        } else {
          // Not hidden means the write matches what the select is showing:
          // the value itself, or nothing when the form holds nothing.
          expect([...where, citizenshipForWrite(held, options)]).toEqual([
            ...where,
            (held ?? "").trim(),
          ]);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The wiring — a rule nothing calls is a rule that ships nothing
// ---------------------------------------------------------------------------

describe("the dialog decides through these rules and not beside them", () => {
  const code = stripComments(read(...DIALOG));

  it("imports all three from the one module", () => {
    expect(code).toContain('from "@/lib/import/id-card-review"');
    expect(code).toContain("institutionSelectSeed");
    expect(code).toContain("citizenshipForWrite");
    expect(code).toContain("citizenshipIsHidden");
  });

  it("reads the document's own institution, and records it as the DOCUMENT's", () => {
    // Without the GET there is nothing for `institutionSelectSeed` to prefer
    // and the rule degrades silently to the matcher — passing every assertion
    // above while the defect stays live.
    expect(code).toMatch(/fetch\(`\/api\/documents\/\$\{encodeURIComponent\(documentId\)\}`\)/);
    expect(code).toMatch(/setDocumentInstitutionId\(doc\.institutionId \?\? ""\)/);
    expect(code).toMatch(/setMatchedInstitutionId\(fields\.institutionId \?\? ""\)/);
  });

  it("derives the picker's value instead of racing two setters into it", () => {
    // The two answers arrive from two fetches in whichever order the network
    // gives them. A `setInstitutionId` per answer makes the opening value
    // depend on that order; deriving it on every render cannot.
    expect(code).not.toMatch(/setInstitutionId\(/);
    expect(code).toMatch(/const seededInstitutionId = institutionSelectSeed\(\{/);
    expect(code).toMatch(/const institutionId = chosenInstitutionId \?\? seededInstitutionId;/);
    // A person's answer is its own state, and „untouched" is null rather than
    // "" so that clearing the picker back to „—" is not re-seeded away.
    expect(code).toMatch(/useState<string \| null>\(null\)/);
    expect(code).toMatch(/onChange=\{\(e\) =>\s*setChosenInstitutionId\(/);
    expect(code).toMatch(/setChosenInstitutionId\(row\.id\)/);
  });

  it("gates the document write AND the add-institution offer on the same rule", () => {
    // The invisible half of the seed. Without the first, the picker shows what
    // the document holds and the PATCH then writes nothing at all — neither the
    // FK nor the prose — losing the authority the card names. Without the
    // second, the offer to create that authority disappears on exactly those
    // documents, so there is no route left for it either. Both were found by
    // adversarial rounds, one per round.
    expect(code).toMatch(
      /institutionForCardWrite\(\{[\s\S]{0,200}?chosen: chosenInstitutionId !== null/,
    );
    expect(code).toMatch(/const institutionForWrite =[\s\S]{0,200}?institutionPlaced/);
    expect(code).toMatch(/const cardAuthorityPlaced = institutionPlaced !== null;/);
    expect(code).toMatch(/const offerInstitutionAdd =\s*!cardAuthorityPlaced/);
    // The sentence under the picker asks the same question, so the offer and
    // the explanation for it cannot appear apart.
    expect(code).toMatch(/institutionListUnusable \|\| !cardAuthorityPlaced/);
    // …and the old question is gone from both, or one of them still answers it.
    expect(code).not.toMatch(/!institutionId &&/);
  });

  it("does not let re-picking the seed count as a person's answer", () => {
    // Document holds D, matcher missed, picker opens on D. Pick something else,
    // change your mind, pick D again — and without this the id becomes „chosen",
    // which suppresses the `subject` line the authority would have reached.
    expect(code).toMatch(/e\.target\.value === seededInstitutionId \? null : e\.target\.value/);
  });

  it("routes the person POST through citizenshipForWrite", () => {
    expect(code).toMatch(/citizenshipForWrite\(values\.citizenshipId,\s*citizenshipOptions\)/);
    // ⚠️ **The payload must be the ADJUSTED one.** A `toApiPayload(values)`
    // left anywhere in this file is the old write, and it would go on shipping
    // the hidden citizenship no matter what the line above computed.
    expect(code).not.toMatch(/toApiPayload\(values\)/);
    expect(code).toMatch(/toApiPayload\(\{\s*\.\.\.values,\s*citizenshipId\s*\}\)/);
  });

  it("drives the sentence under the field from the same predicate", () => {
    expect(code).toMatch(/citizenshipIsHidden\(wCitizenshipId,\s*citizenshipOptions\)/);
    // The value is watched, not sampled: a `getValues()` snapshot does not
    // re-render, so the sentence would outlive the value that earned it.
    expect(code).toMatch(/name:\s*\[[\s\S]{0,400}?"citizenshipId"/);
  });

  it("offers a way out of the state the sentence describes", () => {
    // #34.04 left „it does NOT recover inside this dialog" standing, and the
    // dialog is opened by the run rather than by the user — so closing it to
    // get the list back is recorded as a decision not to create the person.
    expect(code).toMatch(/reload:\s*reloadCitizenships/);
    expect(code).toMatch(/onClick=\{reloadCitizenships\}/);
    expect(stripComments(read("hooks", "use-lookup-options.ts"))).toMatch(
      /const reload = useCallback\(\(\): void => \{\s*void refetch\(\);/,
    );
  });

  it("offers it on the failed LIST, not only on a hidden value", () => {
    // A card that carried no citizenship at all leaves nothing „hidden", and
    // the first draft of this slice hid both the sentence and the retry in
    // exactly that state — the one #34.04 wrote its sentence for. An
    // adversarial round found it.
    expect(code).toMatch(/citizenshipListState === "failed"\s*\?\s*citizenshipHidden/);
    expect(code).toMatch(/t\("citizenshipListFailed"\)/);
    expect(code).toMatch(/hintAction=\{\s*citizenshipListState === "failed" \?/);
  });

  it("covers all three of the sentence's states, and names the row on the third", () => {
    // The list failed with a value held; the list failed with nothing held
    // (#34.04's own state, which the first draft of this slice hid); and a
    // value the loaded list no longer contains. The third names the card's own
    // spelling, because the form holds a uuid and „—" identifies nothing — so
    // „add it back in Reference Data" would otherwise be an instruction about
    // a value the screen never printed.
    expect(code).toMatch(/t\("citizenshipHiddenListFailed"\)/);
    expect(code).toMatch(/t\("citizenshipListFailed"\)/);
    expect(code).toMatch(/t\("citizenshipHiddenNotListed"\)/);
    expect(code).toMatch(
      /t\("citizenshipHiddenNotListedNamed", \{ name: citizenshipRaw \}\)/,
    );
    expect(code).toMatch(/setCitizenshipRaw\(fields\.citizenshipRaw \?\? ""\)/);
  });

  it("says when the retry is in flight", () => {
    // `refetch` on an errored query leaves `status` at "error" for the whole
    // round trip, so `listState` says „failed" throughout and nothing on screen
    // would move between the click and the answer.
    expect(code).toMatch(/isReloading:\s*citizenshipReloading/);
    expect(code).toMatch(/citizenshipReloading \? t\("citizenshipRetrying"\)/);
    expect(code).toMatch(/disabled=\{busy \|\| citizenshipReloading\}/);
  });

  it("keeps the sentence and its button out of the <label>", () => {
    // Interactive content inside a <label> is invalid HTML, and the browser
    // folds BOTH the button and the sentence into the labelled control's
    // accessible name — so „Cetățenie" became „Cetățenie <the whole red
    // sentence> Reîncearcă" and changed every time the sentence did. Two
    // adversarial rounds: the first moved the button out, the second the
    // sentence. `aria-describedby` is what carries it to the control instead.
    const field = code.slice(code.indexOf("function SelectField("));
    const labelOpen = field.indexOf("<label");
    const labelClose = field.indexOf("</label>");
    expect(labelOpen).toBeGreaterThan(-1);
    expect(labelClose).toBeGreaterThan(labelOpen);
    // Between the tags, and not merely „somewhere before them" — both props are
    // named in the destructured parameter list above, which is not the label.
    const inLabel = field.slice(labelOpen, labelClose);
    expect(inLabel).not.toContain("hintAction");
    expect(inLabel).not.toContain("{hint}");
    expect(field.slice(labelClose)).toContain("hintAction");
    expect(field.slice(labelClose)).toContain("{hint}");
    expect(inLabel).toMatch(/aria-describedby=\{showHint \? hintId : undefined\}/);
  });

  it("still sends both of the card's numbers to the document mapping", () => {
    // `documentFieldsFromIdCard` chooses between them; the dialog's job is only
    // to hand over what the form holds. Dropping either one here would move the
    // choice back into the component, where the preview and the write can
    // disagree again.
    expect(code).toMatch(/idDocumentNumber:\s*values\.idDocumentNumber/);
    expect(code).toMatch(/idCardNumber:\s*values\.idCardNumber/);
    expect(code).toMatch(/idDocumentNumber:\s*wIdDocumentNumber/);
    expect(code).toMatch(/idCardNumber:\s*wIdCardNumber/);
  });

  it("top-aligns both the grid row and the field that grows inside it", () => {
    // #34.04 named the row half of this one-word fix and could not render the
    // screen to take it: the citizenship field's sentence grows its row, and
    // with the grid's default `stretch` the short sibling stretches and
    // re-centres. The field's OWN label needs the same treatment against its
    // own taller column — a review round on this slice found that half missing.
    expect(code).toMatch(/grid grid-cols-2 items-start gap-2[\s\S]{0,400}?name="citizenshipId"/);
    // Every row holding a <SelectField> needs it, not only the one that grows:
    // that component's root is a <div> wrapper rather than the <label>, so it
    // no longer stretches to the row and its own `items-center` has nothing to
    // centre against. „Sex" would pin to the top while „Data nașterii" beside
    // it re-centred. Found by the second adversarial round.
    expect(code).toMatch(/grid grid-cols-2 items-start gap-2[\s\S]{0,400}?name="gender"/);
    const field = code.slice(code.indexOf("function SelectField("));
    expect(field).toMatch(/error \? "items-start" : "items-center"/);
  });
});
