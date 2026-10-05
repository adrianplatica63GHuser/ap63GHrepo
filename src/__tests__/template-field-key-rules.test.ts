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
 * (#29.09) writes its approved form through the additive `template-fields`
 * PUT, with an ordered-key concurrency check. A key rule relaxed in one of the
 * two is relaxed for the type the other is standing on. (The AI-Discovery
 * review dialog was a third writer until Slice #37.85 deleted it.)
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

const ENGINE = join(SRC, "src", "app", "admin", "doc-type-engine", "_components", "doc-type-engine.tsx");
const EDITOR = join(SRC, "src", "app", "admin", "value-lists", "_components", "document-type-form-editor.tsx");
const ROUTE  = join(SRC, "src", "app", "api", "document-types", "[id]", "template-fields", "route.ts");

const read = (p: string) => readFileSync(p, "utf8");

/**
 * Every screen that can put a row into `template_fields`. Slice #37.85 took
 * „Descoperire AI"'s review dialog out: the engine and the Form editor are the
 * only two left.
 */
const WRITERS: Array<[string, string]> = [
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

describe("the AI writer goes through the additive PUT", () => {
  const AI_WRITERS: Array<[string, string]> = [
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
// #37.85: the discovery dialog, gone
// ---------------------------------------------------------------------------

describe("the one-document review dialog is gone, and nothing replaced it", () => {
  // Slice #37.85: one document is never evidence for a type's form. The review
  // dialog that turned one read into fields on the TYPE was deleted with
  // „Descoperire AI"; the engine and the Form editor are the writers left.
  it("the file no longer exists", () => {
    expect(() => read(join(SRC, "src", "app", "documents", "_components", "discover-review-dialog.tsx"))).toThrow();
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

describe("the no-form sentence points at a screen that exists", () => {
  // Slice #37.85: the review dialog's no-hint note went with the dialog; the
  // sentence under „Tip document" is the one that names the engine now.
  it.each(["ro-RO.json", "en-GB.json"] as const)("%s links DocTypeEngine as it is titled", (file) => {
    const messages = JSON.parse(
      readFileSync(join(SRC, "messages", file), "utf8"),
    ) as {
      document: { typeForm: Record<string, string> };
      docTypeEngine: { pageTitle: string };
    };
    // Pinned against the screen's own title rather than a literal repeated
    // here: rename the screen and this sentence sends the user somewhere that
    // no longer exists, in the one place they are told to go and use it.
    expect(messages.document.typeForm.noFormHint).toContain(
      `<link>${messages.docTypeEngine.pageTitle}</link>`,
    );
  });
});
