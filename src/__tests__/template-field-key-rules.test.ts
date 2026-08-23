/**
 * A field's KEY is permanent, and since #29.09 two screens mint one.
 *                                                              (Slice #29.10)
 *
 * WHAT IS AT RISK
 * ---------------
 * `key` is the JSON key under which every document already captured on a type
 * holds its value in `document.custom_fields`. A form can lose a field again
 * since #27.03; the values stored under its key stay where they are, reachable
 * from no screen. So rewriting a stored key does not rename anything — it
 * orphans real data behind a form that can no longer see it.
 *
 * `document-type-form-editor.tsx` states the rule at the top of itself and has
 * always been the only screen bound by it. It is not any more: DocTypeEngine
 * (#29.09) writes its approved form through the SAME additive
 * `template-fields` PUT, with the same ordered-key concurrency check, as the
 * AI-Discovery review dialog. A key rule relaxed in one of the three is
 * relaxed for the type either of the others is standing on.
 *
 * #29.10 changes what a NEW row's key is derived from on the discovery dialog —
 * it follows the name as the user types it, instead of freezing at proposal
 * time — and this file exists to pin that this is the only thing that moved.
 * Nothing here makes a key editable, and nothing here touches a stored one.
 *
 * Mostly pure functions and source scans, deliberately. Rendering React would
 * prove the JSX compiles; what goes wrong silently is a `readOnly` dropped from
 * an input, or a fourth writer appearing that nobody told about the rule.
 * The component assertions read CODE. Two named documentation guards read
 * comments, and say so where they sit — CLAUDE.md: a NAME guard may read
 * comments, a BEHAVIOUR guard must read only code.
 */

import { readFileSync } from "fs";
import { join } from "path";

import {
  mergeAcceptedFields,
  sanitizeTemplateField,
  seedReviewRows,
} from "@/lib/documents/discover-to-template";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";

const SRC = process.cwd();

const DIALOG = join(SRC, "src", "app", "documents", "_components", "discover-review-dialog.tsx");
const ENGINE = join(SRC, "src", "app", "admin", "doc-type-engine", "_components", "doc-type-engine.tsx");
const EDITOR = join(SRC, "src", "app", "admin", "value-lists", "_components", "document-type-form-editor.tsx");
const ROUTE  = join(SRC, "src", "app", "api", "document-types", "[id]", "template-fields", "route.ts");

const read = (p: string) => readFileSync(p, "utf8");

/** Every screen that can put a row into `template_fields`. */
const WRITERS: Array<[string, string]> = [
  ["discover-review-dialog", DIALOG],
  ["doc-type-engine", ENGINE],
  ["document-type-form-editor", EDITOR],
];

function field(over: Partial<DocumentTemplateField> = {}): DocumentTemplateField {
  return {
    key: "pretTotal",
    labelRo: "Preț total",
    labelEn: "Total price",
    type: "text",
    order: 0,
    aiHint: null,
    groupRo: null,
    groupEn: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// A stored key survives every path that touches it
// ---------------------------------------------------------------------------

describe("a stored key is returned byte-for-byte", () => {
  it("keeps a camelCase key through a merge that appends to it", () => {
    const merged = mergeAcceptedFields(
      [field({ key: "pretTotal" }), field({ key: "nrCadastral", labelRo: "Nr. cadastral", order: 1 })],
      [field({ key: "suprafata_de", labelRo: "Suprafața de", order: 0 })],
    );
    expect(merged.map((f) => f.key)).toEqual(["pretTotal", "nrCadastral", "suprafata_de"]);
  });

  it("keeps a stored key that would FAIL the safe-key test", () => {
    // A stored key that sanitising would rewrite is a key documents already
    // hold data under. Repairing it on a save the user asked for something
    // else entirely would strand that data for good.
    const odd = 'weird key"with\\junk';
    const merged = mergeAcceptedFields([field({ key: odd })], []);
    expect(merged[0].key).toBe(odd);
    // …while the same key arriving as an ACCEPTED row is re-slugged, because
    // nothing is stored under it yet and it would corrupt the prompt line.
    expect(sanitizeTemplateField(field({ key: odd })).key).not.toBe(odd);
  });

  it("recognises a discovered slug as the stored camelCase field, not a second one", () => {
    const merged = mergeAcceptedFields(
      [field({ key: "pretTotal" })],
      [field({ key: "pret_total", labelRo: "Preț total" })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].key).toBe("pretTotal");
  });

  it("never renumbers a key, only `order`", () => {
    const merged = mergeAcceptedFields(
      [field({ key: "b", order: 7 }), field({ key: "a", order: 9 })],
      [],
    );
    expect(merged.map((f) => f.key)).toEqual(["b", "a"]);
    expect(merged.map((f) => f.order)).toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------------------
// No screen lets a key be typed
// ---------------------------------------------------------------------------

describe("no writer of template_fields offers an editable key", () => {
  it.each(WRITERS)("%s renders the key as text, never as a control", (_name, file) => {
    const src = read(file);
    // An input/select/textarea whose value is bound to a key, or a change
    // handler that patches one. Any of these would be a key the user types.
    expect(src).not.toMatch(/value=\{[^}]*\.key\b/);
    expect(src).not.toMatch(/patchRow\([^)]*\{\s*key:/);
    expect(src).not.toMatch(/\bkey:\s*e\.target\.value/);
  });

  it.each(WRITERS)("%s derives a new key from the label through the shared pair", (_name, file) => {
    const src = read(file);
    // One derivation, in one module. A screen that minted keys its own way
    // would disagree with the merge on whether two fields are the same field.
    // Three entry points into the same `slugifyFieldKey`/`uniqueFieldKey` pair:
    // the review dialog goes through `keysForReviewRows` (#29.10), the admin
    // editor through `keysForRows`, DocTypeEngine through the pair directly.
    expect(src).toMatch(/keysForReviewRows|keysForRows|slugifyFieldKey/);
    expect(src).toContain("@/lib/documents/discover-to-template");
  });
});

// ---------------------------------------------------------------------------
// One door, one concurrency check
// ---------------------------------------------------------------------------

describe("both AI writers go through the same additive PUT", () => {
  const AI_WRITERS: Array<[string, string]> = [
    ["discover-review-dialog", DIALOG],
    ["doc-type-engine", ENGINE],
  ];

  it.each(AI_WRITERS)("%s PUTs template-fields with knownKeys", (_name, file) => {
    const src = read(file);
    expect(src).toContain("/template-fields");
    expect(src).toContain("knownKeys");
    expect(src).toMatch(/method:\s*"PUT"/);
  });

  it("the route merges rather than replaces, and compares keys in order", () => {
    const src = read(ROUTE);
    expect(src).toContain("mergeAcceptedFields");
    // The ordered comparison is what makes a reordering a change the reviewer
    // did not see. A set comparison would pass it silently.
    expect(src).toMatch(/currentKeys\.every\(\(k, i\) => k === parsed\.data\.knownKeys\[i\]\)/);
  });
});

// ---------------------------------------------------------------------------
// #29.10: the discovery dialog's key follows the name the user typed
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THE BEHAVIOUR ITSELF IS PINNED IN `discover-to-template.test.ts`, over
 * `keysForReviewRows` and `reviewRowIssues`, with real rows and real renames.**
 * A review round found the first version of this file asserting the live key by
 * calling `uniqueFieldKey(slugifyFieldKey("Preț vânzare"), new Set())` — which
 * passes byte-for-byte on the pre-slice code, because neither of those two
 * functions changed. Nine assertions here were vacuous for the same reason.
 *
 * What is left in this file is what belongs here and nowhere else: that the
 * dialog is WIRED to those functions rather than to a private copy, and that
 * the three writers still agree about keys. Those are source facts, and a
 * source scan is the honest way to state them.
 */
describe("the dialog is wired to the shared key derivation", () => {
  it("takes its keys and its guards from the pure module, not from a local copy", () => {
    const src = read(DIALOG);
    expect(src).toContain("keysForReviewRows");
    expect(src).toContain("reviewRowIssues");
    // ⚠️ And the SET they are measured against comes from the same function
    // `proposeTemplateFields` uses. A review round found the dialog assembling
    // its own — the stored keys plus whatever discovery surfaced as captured —
    // which carried neither the generic columns, nor the label aliases, nor the
    // person roles, so a rename to „Notar" or „Data" went straight through it.
    expect(src).toContain("capturedFieldNames(activeBaseline, roles)");
    // ⚠️ …and both inputs are FROZEN. `partyRoleNames` comes off the same
    // react-query cache with `refetchOnWindowFocus` that `baseline` is frozen
    // against: a round found a role added mid-review silently re-minting an
    // untouched row from `notar` to `notar_2`, which inside the
    // `fieldsUnresolved` window changes the retry's payload.
    expect(src).toContain("useState<readonly string[]>(partyRoleNames)");
    expect(src).not.toMatch(/proposeTemplateFields\([^)]*partyRoleNames/);
    // Displayed and stored from ONE computation. A screen that showed one key
    // and saved another is worse than one that showed none.
    expect(src).toMatch(/key:\s*keyForRow\(r\)/);
    expect(src).toMatch(/\{keyForRow\(row\)\}/);
    // No second derivation left behind in the component.
    expect(src).not.toMatch(/uniqueFieldKey\(/);
  });

  it("reads one name for the key, the save, the warning and the labels", () => {
    // A review round found four call sites reading three different expressions
    // (`row.label || row.key`, `row.label || row.labelRo`, `row.label.trim() ||
    // row.labelRo`), so a single typed space made the fragment warning vanish
    // while the fragment was still what got stored.
    const src = read(DIALOG);
    expect(src).not.toMatch(/row\.label \|\| row\.key/);
    expect(src).not.toMatch(/row\.label \|\| row\.labelRo/);
    expect(src).toContain("rowName(row)");
  });

  it("blocks Save on both issues the live key opened", () => {
    const src = read(DIALOG);
    expect(src).toMatch(/!unnamedRow/);
    expect(src).toMatch(/!duplicateRow/);
    // …and says so where it can be acted on. A review round found both
    // sentences in the FOOTER only — "a ticked field has no name", on a screen
    // showing thirty-six rows — while the two advisory warnings sat on the row.
    // The row says which problem it has; the footer says to go and look.
    expect(src).toContain("reviewRowIssue(row, captured)");
    expect(src).toContain("rowNameRequired");
    expect(src).toContain("rowNameDuplicate");
    expect(src).toContain("rowIssuesFooter");
  });

  it("keeps the two name warnings as two separate sentences", () => {
    // A review round found one rule and one message doing both jobs, so an
    // ordinary long caption was told it read like a piece of prose while the
    // thing that was true of it — its key is about to be cut mid-word — went
    // unsaid. Same evidence, two complaints, two sentences.
    const src = read(DIALOG);
    expect(src).toContain("looksLikeSentenceFragment(rowName(row))");
    expect(src).toContain("nameTooLongForKey(rowName(row))");
    expect(src).toContain("fragmentName");
    expect(src).toContain("longName");
  });

  it("freezes the rows once a field write's outcome is unknown", () => {
    // ⚠️ `errorFieldsUnknown` asks the user to press Save again, and the 409
    // recovery only fires when the retry asks for the SAME keys. With the key
    // following the name, a rename between the two presses breaks it — and the
    // banner is on screen exactly when the fragment warning has just told the
    // user to rename something. A review round found this.
    const src = read(DIALOG);
    expect(src).toContain("fieldsUnresolved");
    expect(src).toMatch(/const rowsLocked = saving \|\| fieldsUnresolved/);
    // ⚠️ And it is CLEARED at the top of every attempt. A round found it set
    // and never unset, so every outcome proving the write did not land — a 409
    // that reseeds the list and says "check it and press Save again", a 404,
    // `errorTooMany`'s "untick a few and try again" — left the user reading an
    // instruction beside a table with every control dead.
    expect(src).toContain("setFieldsUnresolved(false)");
    expect(src).toContain("setFieldsUnresolved(true)");
    // The new-type controls take the freeze too: toggling that box reseeds the
    // rows and re-points the save at a type that does not exist yet, which is
    // the one thing a frozen table must not be able to do underneath itself.
    expect(src.split("|| unresolved || fieldsUnresolved")).toHaveLength(3);
    // All three row controls take the lock: the checkbox, the name box and the
    // type select. Counted, because "at least one of them does" is the version
    // that ships a half-frozen table.
    expect(src.split("disabled={rowsLocked}")).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// #29.10: the two pre-tick defaults, and why they differ
// ---------------------------------------------------------------------------

describe("the pre-tick default is a per-screen decision", () => {
  it("the one-document review opens with nothing accepted", () => {
    const rows = seedReviewRows([
      {
        key: "parcela",
        labelRo: "Parcela",
        labelEn: "Parcela",
        type: "text",
        sampleValue: "225/3/24",
        confidence: "high",
        alreadyInForm: false,
      },
    ]);
    expect(rows[0].include).toBe(false);
  });

  it("DocTypeEngine still ticks what cleared its Matching % line", () => {
    // Left alone deliberately. A field there was found in at least that share
    // of the documents actually READ, and the screen prints the count beside
    // it; a row on the one-document dialog was seen once.
    expect(read(ENGINE)).toMatch(/include:\s*true/);
  });

  /**
   * ⚠️ DOCUMENTATION GUARD — this one reads comments on purpose, because what
   * it guards IS the comment. The slice's requirement is that the asymmetry is
   * recorded where the next reader will be standing, not only in a commit
   * message nobody greps.
   */
  it("each side names the other, so neither default reads as an oversight", () => {
    expect(read(ENGINE)).toContain("seedReviewRows");
    const lib = read(join(SRC, "src", "lib", "documents", "discover-to-template.ts"));
    expect(lib).toContain("DocTypeEngine");
  });
});

// ---------------------------------------------------------------------------
// #29.10: the two hint producers, and why they may legitimately differ
// ---------------------------------------------------------------------------

/**
 * ⚠️ DOCUMENTATION GUARD, for the same reason as the one above. Two functions
 * write `template_fields.aiHint` and they land on the same line of the same
 * prompt; #29.06 deleted a pair like that. This one is deliberate, and a
 * deliberate contradiction that is not written down is indistinguishable from
 * the accidental kind at the moment somebody decides to tidy it.
 */
describe("the two aiHint producers cross-reference each other", () => {
  it("buildFieldHint carries the sentence and field-distillation points at it", () => {
    const lib = read(join(SRC, "src", "lib", "documents", "discover-to-template.ts"));
    const distil = read(join(SRC, "src", "lib", "documents", "field-distillation.ts"));
    expect(lib).toContain("distilledHint");
    expect(distil).toContain("buildFieldHint");
    // The rule that survives a future merge of the two, stated in both files so
    // it cannot be lost with whichever one is deleted. Matched on the phrase
    // rather than the sentence: these live in wrapped block comments, and a
    // regex spanning a wrap would fail on a reflow that changed nothing.
    for (const src of [lib, distil]) {
      expect(src).toContain("extended to the engine");
      expect(src).toContain("refusing to emit");
    }
  });
});

// ---------------------------------------------------------------------------
// Copy that names another screen
// ---------------------------------------------------------------------------

describe("the no-hint sentence points at a screen that exists", () => {
  it.each(["ro-RO.json", "en-GB.json"] as const)("%s names DocTypeEngine as it is titled", (file) => {
    const messages = JSON.parse(
      readFileSync(join(SRC, "messages", file), "utf8"),
    ) as {
      document: { discoverReview: Record<string, string> };
      docTypeEngine: { pageTitle: string };
    };
    // Pinned against the screen's own title rather than a literal repeated
    // here: rename the screen and this sentence sends the user somewhere that
    // no longer exists, in the one place they are told to go and use it.
    expect(messages.document.discoverReview.noHintNote).toContain(
      messages.docTypeEngine.pageTitle,
    );
  });
});
