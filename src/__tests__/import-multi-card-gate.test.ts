/**
 * The identity-scan refusal, and above all the FALSE POSITIVE it is designed
 * against.                                                     (Slice #32.08)
 *
 * The rule is "one file, one card". The way a rule like that fails is not by
 * missing a two-card scan — that is the case everybody writes a test for — but
 * by refusing the ordinary ones: the front and back of one card on one page,
 * and one booklet `buletin` photographed spread by spread. Both show two
 * card-shaped rectangles, both are ONE person, and a rule that refuses them is
 * a rule a business user learns to work around. So the front-and-back case is
 * the FIRST test in this file, not the last.
 *
 * The three real negatives were measured by eye over twenty identity scans in
 * `C:\dev\TEST.DATA\CLINCENI.3` before the check was written, and they are
 * named in the cases below so that a later reader can go and look at them.
 */

import {
  MULTI_CARD_THRESHOLD,
  MULTI_IDENTITY_CODE,
  MAX_BELIEVABLE_PERSONS,
  cardsAreClean,
  checkMultiCard,
  identityPersonCountOf,
  showsMoreThanOnePerson,
} from "@/lib/import/multi-card-gate";

describe("the negatives — one person, however many rectangles", () => {
  it("⚠️ THE PRIMARY NEGATIVE: the front and back of ONE card on one page", () => {
    // Two card-shaped objects, one CNP, one person. This is the commonest
    // identity scan in any archive; refusing it would make the whole rule the
    // thing a user learns to route around, and every other test here is worth
    // less than this one.
    const verdict = checkMultiCard([{ path: "Buletin.jpg", identityPersonCount: 1 }]);
    expect(verdict).toEqual({ refused: [], clean: true });
    expect(cardsAreClean(verdict)).toBe(true);
  });

  it("one booklet photographed spread by spread is still one person", () => {
    // `Toma Veturia.jpg` (496,602 bytes) and `Toma Tudor.jpg` (389,930) in
    // CLINCENI.3: each is one booklet `buletin` shot twice, so the page carries
    // two card-shaped spreads bearing ONE serial and ONE name.
    expect(
      checkMultiCard([
        { path: "diverse 4432 mp/Toma Veturia.jpg", identityPersonCount: 1 },
        { path: "diverse 3867 mp/Toma Tudor.jpg", identityPersonCount: 1 },
      ]).clean,
    ).toBe(true);
  });

  it("two photographs of the same holder in one booklet is one person", () => {
    // `Dumitru Niculae.jpg` in CLINCENI.3 carries the booklet's two photo slots,
    // the second affixed in 1993 — same serial, same CNP. It is the file most
    // likely to be miscounted by anything that counts faces.
    expect(checkMultiCard([{ path: "Dumitru Niculae.jpg", identityPersonCount: 1 }]).clean)
      .toBe(true);
  });

  it("a document that is not an identity card at all is zero, not one", () => {
    // `cert casat Ilie Mihaela.jpg` is a marriage certificate. It prints TWO
    // full CNPs and shows no identity card, which is exactly the shape a rule
    // written around "two CNPs on a page" rather than "two identity documents"
    // would refuse.
    expect(
      checkMultiCard([
        { path: "cert casat Ilie Mihaela.jpg", identityPersonCount: 0 },
        { path: "Contract vanzare.pdf", identityPersonCount: 0 },
      ]).clean,
    ).toBe(true);
  });
});

describe("the positive — more than one person on one file", () => {
  it("refuses a scan of two people's cards and carries the count", () => {
    // `Costache Mihai Claudiu.jpg` (360,792 bytes): one A4 sheet holding two
    // different men's cards — COSTACHE MIHAIL-ALEXANDRU and COSTACHE
    // CLAUDIU-COSMIN, two CNPs, two series. The file the slice was opened for.
    const verdict = checkMultiCard([
      { path: "Costache Mihai Claudiu.jpg", identityPersonCount: 2 },
    ]);
    expect(verdict.clean).toBe(false);
    expect(verdict.refused).toEqual([
      { path: "Costache Mihai Claudiu.jpg", personCount: 2 },
    ]);
    expect(cardsAreClean(verdict)).toBe(false);
  });

  it("⚠️ names EVERY refused file, in walk order, uncapped", () => {
    // Walk order is what makes the list checkable line by line against File
    // Explorer, and it is the reason the screen neither sorts nor caps. A
    // verdict that reported only the first would send a user back for a second
    // stop they were never told about.
    const verdict = checkMultiCard([
      { path: "b/second.jpg", identityPersonCount: 2 },
      { path: "a/ok.jpg", identityPersonCount: 1 },
      { path: "c/third.jpg", identityPersonCount: 3 },
    ]);
    expect(verdict.refused.map((f) => f.path)).toEqual(["b/second.jpg", "c/third.jpg"]);
    expect(verdict.refused.map((f) => f.personCount)).toEqual([2, 3]);
  });

  it("the threshold is two, and it is the constant that says so", () => {
    expect(MULTI_CARD_THRESHOLD).toBe(2);
    expect(showsMoreThanOnePerson(MULTI_CARD_THRESHOLD - 1)).toBe(false);
    expect(showsMoreThanOnePerson(MULTI_CARD_THRESHOLD)).toBe(true);
  });
});

describe("⚠️ silence never refuses", () => {
  // The opposite of the under-claiming direction this codebase takes
  // everywhere else, and the module header argues it at length: the type gate
  // blocks on "we could not find out" because its promise is that no document
  // is written on an unproved type; this rule refuses only on a POSITIVE
  // finding. A rule that treated a missing field as "two people" would refuse
  // every image in every folder the day the field is dropped from the prompt.
  it.each([
    ["absent", {} as { identityPersonCount?: number | null }],
    ["null", { identityPersonCount: null }],
  ])("%s does not refuse", (_label, extra) => {
    expect(checkMultiCard([{ path: "x.jpg", ...extra }]).clean).toBe(true);
  });

  it("a verdict that was never taken is clean", () => {
    expect(cardsAreClean(null)).toBe(true);
  });

  it("an empty folder is clean", () => {
    expect(checkMultiCard([])).toEqual({ refused: [], clean: true });
  });
});

describe("identityPersonCountOf — the one boundary where a model's answer is read", () => {
  it("takes whole, non-negative numbers", () => {
    expect(identityPersonCountOf(0)).toBe(0);
    expect(identityPersonCountOf(1)).toBe(1);
    expect(identityPersonCountOf(2)).toBe(2);
  });

  it("takes a string of digits, because that is what models reach for", () => {
    // The field is described in prose, and refusing `"2"` would silently drop
    // exactly the finding this slice exists for.
    expect(identityPersonCountOf("2")).toBe(2);
    expect(identityPersonCountOf(" 2 ")).toBe(2);
  });

  it("⚠️ takes digits ONLY on the string branch", () => {
    // `Number()` alone accepts `"0x10"` (16) and `"1e2"` (100), either of which
    // would manufacture a refusal out of something nobody meant as a count.
    // Whitespace still trims, because a model emitting `" 2 "` is ordinary.
    expect(identityPersonCountOf("0x10")).toBeNull();
    expect(identityPersonCountOf("1e2")).toBeNull();
    expect(identityPersonCountOf("-2")).toBeNull();
    expect(identityPersonCountOf("2.0")).toBeNull();
  });

  it("⚠️ refuses everything else, and refusing means `null` rather than zero", () => {
    // `null` is "nobody said" and `0` is an answer. They behave identically in
    // the gate today, and keeping them apart is what stops a future reader
    // taking an invented zero for a question that was actually put.
    for (const raw of [
      undefined,
      null,
      true,
      false,
      "",
      "   ",
      "two",
      {},
      [],
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
    ]) {
      expect({ raw, out: identityPersonCountOf(raw) }).toEqual({ raw, out: null });
    }
  });

  it("⚠️ refuses a fraction rather than rounding it up", () => {
    // Rounding `1.6` to 2 would MANUFACTURE the refusal out of an answer nobody
    // should act on — the one direction a sanitiser must never fail in.
    expect(identityPersonCountOf(1.6)).toBeNull();
    expect(identityPersonCountOf(2.5)).toBeNull();
  });

  it("⚠️ REJECTS an absurd answer rather than clamping it into a refusal", () => {
    // ⚠️ **THE FIRST DRAFT CLAMPED, AND AN ADVERSARIAL ROUND CAUGHT THE
    // CONTRADICTION.** A model answering 1e9 is a malformed answer, not a
    // finding — the module says so in as many words — and clamping it to 99
    // turned that malformed answer into a refusal, because 99 is at or above
    // the threshold. The module's whole stated direction is that it refuses
    // only on evidence, so an unbelievable number is `null`, and `null` never
    // refuses.
    expect(identityPersonCountOf(1e9)).toBeNull();
    expect(identityPersonCountOf(MAX_BELIEVABLE_PERSONS + 1)).toBeNull();
    expect(showsMoreThanOnePerson(identityPersonCountOf(1e9))).toBe(false);
    // …and the boundary itself is still believed, so the constant is a limit
    // rather than an off-by-one.
    expect(identityPersonCountOf(MAX_BELIEVABLE_PERSONS)).toBe(MAX_BELIEVABLE_PERSONS);
  });
});

describe("the refusal code the two later refusal points share", () => {
  it("⚠️ is the exact string the review dialog turns into a sentence", () => {
    // It is a contract between four files — the two routes that write it,
    // `runAiInterpret` that reads it, and the review dialog whose
    // `KNOWN_ERROR_CODES` selects `error_multiple_identities` out of
    // `messages/*.json`. A typo in any half is a refusal that silently degrades
    // into an ordinary failure, which is to say into a row offering a retry
    // that will be refused again.
    expect(MULTI_IDENTITY_CODE).toBe("multiple_identities");
  });
});
