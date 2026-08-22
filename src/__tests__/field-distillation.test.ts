/**
 * The counting rule, and the two things it must never get wrong.
 *                                                              (Slice #29.09)
 *
 * DocTypeEngine reads ten to twenty documents of one type and proposes a form
 * carrying the fields they have in common. Everything the model does — reading
 * a page, deciding that two differently-worded captions mean the same thing —
 * is a call this suite does not make. What is left after those calls is
 * arithmetic over a cluster table, and it is the arithmetic that decides what
 * the user is shown and what is written onto a document type every future
 * document of that type will be read against. So it is asserted here, against
 * fixtures, with no model in the loop.
 *
 * Two of these tests exist because getting them wrong would be invisible:
 *
 *  - **The denominator is samples READ.** Twenty samples is twenty calls
 *    against a ten-per-minute limiter, so some runs read fewer than they picked.
 *    Dividing by the number picked would lower every share and drop real fields
 *    under the threshold — silently, since the screen would still show a tidy
 *    percentage.
 *  - **A cluster's count is DISTINCT SAMPLES.** One deed naming two sellers
 *    prints „Vânzător" twice. Counting members would let one document satisfy a
 *    50% threshold by itself, which is F5's `_2` bug wearing a percentage.
 *
 * The last block is F5 itself, replayed: the thirty-five sentence-fragment
 * fields one deed produced, against nineteen other deeds that do not carry them.
 */

import {
  captionVariants,
  clusterSharePercent,
  distilFields,
  distilledHint,
  distilledLabel,
  distilledType,
  meetsThreshold,
  readSampleCount,
  sampleCount,
  splitByThreshold,
  unreadSampleCount,
  restrictToRead,
  readSampleIds,
  MATCHING_PERCENTS,
  type FieldCluster,
  type SampleFailure,
  type SampleRead,
} from "@/lib/documents/field-distillation";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";
import {
  minimumRunMs,
  msUntilNextSlot,
  retryAfterMs,
  OCR_MAX_REQUESTS,
  OCR_WINDOW_MS,
} from "@/lib/import/sample-read-pacing";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A sample that was read, carrying no pairs — the pairs live in the clusters. */
function ok(sampleId: string): SampleRead {
  return {
    sampleId,
    fileName: `${sampleId}.pdf`,
    read: true,
    pairs: [],
    skippedPages: 0,
    truncated: false,
  };
}

function failed(sampleId: string, reason: SampleFailure = "failed"): SampleRead {
  return { sampleId, fileName: `${sampleId}.pdf`, read: false, reason };
}

/** A cluster present in the named samples, with one label/value shape each. */
function cluster(
  clusterId: string,
  members: readonly (readonly [sampleId: string, label: string, value: string])[],
): FieldCluster {
  return {
    clusterId,
    members: members.map(([sampleId, label, value]) => ({ sampleId, label, value })),
  };
}

function field(over: Partial<DocumentTemplateField> = {}): DocumentTemplateField {
  return {
    key: "camp",
    labelRo: "Câmp",
    labelEn: "Field",
    type: "text",
    order: 0,
    aiHint: null,
    groupRo: null,
    groupEn: null,
    ...over,
  };
}

/** N samples, all read. */
function reads(n: number): SampleRead[] {
  return Array.from({ length: n }, (_, i) => ok(`s${i + 1}`));
}

/** A cluster seen in the first `n` of those samples. */
function seenIn(clusterId: string, n: number, label: string, value = "x"): FieldCluster {
  return cluster(
    clusterId,
    Array.from({ length: n }, (_, i) => [`s${i + 1}`, label, `${value}${i}`] as const),
  );
}

// ---------------------------------------------------------------------------
// The dropdown
// ---------------------------------------------------------------------------

describe("the Matching % values", () => {
  it("is 50 to 100 in fives", () => {
    expect([...MATCHING_PERCENTS]).toEqual([50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
  });

  it("⚠️ never prints a share the threshold disagrees with", () => {
    // ⚠️ **THE ROW PRINTS THE PERCENTAGE AND THE DECISION SIDE BY SIDE, SO THEY
    // MUST NOT DISAGREE — and with `Math.round` they did, inside the range this
    // screen works in.** 6 of 11 rounded to „55%" on a row filed BELOW a 55%
    // threshold; 11 of 13 printed „85%" below an 85% one. Exhaustive over every
    // run size a real folder can produce.
    for (let read = 1; read <= 30; read += 1) {
      for (let count = 0; count <= read; count += 1) {
        const c = seenIn("x", count, "L");
        const printed = clusterSharePercent(c, read);
        for (const percent of MATCHING_PERCENTS) {
          expect({ read, count, percent, agree: printed >= percent === meetsThreshold(c, read, percent) })
            .toEqual({ read, count, percent, agree: true });
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The counting rule
// ---------------------------------------------------------------------------

describe("the threshold", () => {
  it("keeps a field found in exactly the chosen share — at least, not more than", () => {
    // The slice text says both "more than" and "at least". This is the decision,
    // and 100 is the argument: "more than 100%" is unsatisfiable, so a strict
    // comparison makes the top of the dropdown a setting that can only ever
    // produce an empty form.
    const samples = reads(4);
    const half = seenIn("c", 2, "Preț");
    expect(meetsThreshold(half, readSampleCount(samples), 50)).toBe(true);
  });

  it("drops a field one sample short of the line", () => {
    const samples = reads(4);
    expect(meetsThreshold(seenIn("c", 1, "Preț"), readSampleCount(samples), 50)).toBe(false);
  });

  it("at 100 keeps only what every read sample carried", () => {
    const samples = reads(5);
    const all = seenIn("all", 5, "Nr. cadastral");
    const most = seenIn("most", 4, "Tarla");
    const { above, below } = splitByThreshold([all, most], readSampleCount(samples), 100);
    expect(above.map((c) => c.clusterId)).toEqual(["all"]);
    expect(below.map((c) => c.clusterId)).toEqual(["most"]);
  });

  it("at 75 keeps three of four and drops two of four", () => {
    const samples = reads(4);
    const three = seenIn("three", 3, "Suprafață");
    const two = seenIn("two", 2, "Vecinătăți");
    const { above, below } = splitByThreshold([three, two], readSampleCount(samples), 75);
    expect(above.map((c) => c.clusterId)).toEqual(["three"]);
    expect(below.map((c) => c.clusterId)).toEqual(["two"]);
  });

  it("decides 2 of 3 at 66% without a float", () => {
    // 2/3 is 66.66…, so a rounded percentage would answer 67 >= 66 either way.
    // The comparison is count*100 >= percent*read, which is 200 >= 198.
    expect(meetsThreshold(seenIn("c", 2, "X"), 3, 65)).toBe(true);
    expect(meetsThreshold(seenIn("c", 2, "X"), 3, 70)).toBe(false);
  });

  it("keeps nothing at all when no sample was read", () => {
    // Not an edge case worth skipping: it is what a run looks like when the
    // limiter refused every call, and a form built from zero samples would be a
    // form built from nothing while showing a confident 0%.
    expect(meetsThreshold(seenIn("c", 3, "X"), 0, 50)).toBe(false);
    expect(clusterSharePercent(seenIn("c", 3, "X"), 0)).toBe(0);
  });

  it("orders the proposal most-seen first, and breaks ties by cluster id", () => {
    // ⚠️ The tie-break is asserted with the tied pair supplied in REVERSE id
    // order, because a mutation round showed the old fixture passing on V8's
    // stable sort with the `localeCompare` tie-break deleted.
    const samples = reads(4);
    const { above } = splitByThreshold(
      [seenIn("c", 2, "C"), seenIn("b", 2, "B"), seenIn("a", 4, "A")],
      readSampleCount(samples),
      50,
    );
    expect(above.map((c) => c.clusterId)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// ⚠️ The denominator
// ---------------------------------------------------------------------------

describe("⚠️ the denominator is samples read, never samples picked", () => {
  const samples: SampleRead[] = [
    ...reads(14),
    failed("s15", "rateLimited"),
    failed("s16", "timeout"),
    failed("s17"),
    failed("s18"),
    failed("s19"),
    failed("s20", "session"),
  ];

  it("counts the reads and the misses separately", () => {
    expect(samples.length).toBe(20);
    expect(readSampleCount(samples)).toBe(14);
    expect(unreadSampleCount(samples)).toBe(6);
  });

  it("keeps a field present in half the READ samples at a 50% threshold", () => {
    // 7 of 14 read is 50% and stays. 7 of 20 picked would be 35% and would be
    // dropped — silently, under a percentage the user chose believing it meant
    // half the documents.
    const seven = seenIn("c", 7, "Preț vânzare");
    const read = readSampleCount(samples);
    expect(clusterSharePercent(seven, read)).toBe(50);
    expect(meetsThreshold(seven, read, 50)).toBe(true);
    expect(meetsThreshold(seven, samples.length, 50)).toBe(false);
  });

  it("⚠️ counts the denominator by distinct sample, like the numerator", () => {
    // A round found `readSampleCount` counting ARRAY ENTRIES while
    // `sampleCount` de-duped by id, so one repeated entry deflated every share
    // on the screen. Two counts of the same thing, counted two ways.
    const dup: SampleRead[] = [ok("s1"), ok("s1"), ok("s2")];
    expect(readSampleCount(dup)).toBe(2);
    expect(readSampleIds(dup).size).toBe(2);
    expect(unreadSampleCount([failed("s9"), failed("s9"), failed("s10")])).toBe(2);
    expect(
      distilFields({ samples: [...dup, failed("s3")], clusters: [], percent: 50, existing: [] })
        .samplesPicked,
    ).toBe(3);
    const c = seenIn("x", 2, "L");
    expect(clusterSharePercent(c, readSampleCount(dup))).toBe(100);
  });

  it("⚠️ cannot report a share above 100, whatever the cluster claims", () => {
    // The clusters come back from a model call. Nothing used to tie their
    // sample ids to the ids that were actually read, so a cluster naming twelve
    // samples over a run that read six produced `sharePercent: 200` and sat
    // above a 100% threshold. Every entry point restricts to the read set now.
    const samples: SampleRead[] = [...reads(6), failed("s7"), failed("s8")];
    const wild = cluster(
      "wild",
      Array.from({ length: 12 }, (_, i) => [`s${i + 1}`, "Nr. cadastral", "x"] as const),
    );
    expect(sampleCount(restrictToRead(wild, readSampleIds(samples)))).toBe(6);
    const out = distilFields({ samples, clusters: [wild], percent: 100, existing: [] });
    expect(out.fields[0].sharePercent).toBe(100);
    expect(out.fields[0].foundIn).toBe(6);
  });

  it("reports both numbers so the screen can print them", () => {
    const out = distilFields({
      samples,
      clusters: [seenIn("c", 7, "Preț vânzare")],
      percent: 50,
      existing: [],
    });
    expect({ picked: out.samplesPicked, read: out.samplesRead }).toEqual({ picked: 20, read: 14 });
    expect(out.fields).toHaveLength(1);
    expect(out.fields[0].sharePercent).toBe(50);
    expect(out.fields[0].foundIn).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// ⚠️ One document cannot vote twice
// ---------------------------------------------------------------------------

describe("⚠️ a cluster counts distinct samples, not members", () => {
  it("counts a deed that names two sellers once", () => {
    const twoSellersInOneDeed = cluster("vanzator", [
      ["s1", "Vânzător", "ION POPESCU"],
      ["s1", "Vânzător", "MARIA POPESCU"],
    ]);
    expect(twoSellersInOneDeed.members).toHaveLength(2);
    expect(sampleCount(twoSellersInOneDeed)).toBe(1);
    // Two members over two read samples would be 100%; one sample is 50%.
    expect(meetsThreshold(twoSellersInOneDeed, 2, 100)).toBe(false);
    expect(meetsThreshold(twoSellersInOneDeed, 2, 50)).toBe(true);
  });

  it("shows one evidence row per sample, not one per member", () => {
    const out = distilFields({
      samples: reads(2),
      clusters: [
        cluster("vanzator", [
          ["s1", "Vânzător", "ION POPESCU"],
          ["s1", "Vânzător", "MARIA POPESCU"],
          ["s2", "Vânzător", "GHEORGHE ENE"],
        ]),
      ],
      percent: 50,
      existing: [],
    });
    expect(out.fields[0].evidence.map((e) => e.sampleId)).toEqual(["s1", "s2"]);
    expect(out.fields[0].evidence[0].value).toBe("ION POPESCU");
  });
});

// ---------------------------------------------------------------------------
// Captions into aiHint — the win many samples buy that one could not
// ---------------------------------------------------------------------------

describe("the observed caption wordings", () => {
  it("keeps a wording seen in more than one sample", () => {
    const c = cluster("pret", [
      ["s1", "Preţul vânzării", "100.000 RON"],
      ["s2", "Preţul vânzării", "250.000 RON"],
      ["s3", "Preț vânzare", "80.000 RON"],
      ["s4", "Preț vânzare", "95.000 RON"],
    ]);
    // Both wordings cover two of the four samples, so the tie is broken by
    // `localeCompare` and the order is deterministic across runs.
    expect(captionVariants(c)).toEqual(["Preț vânzare", "Preţul vânzării"]);
  });

  it("⚠️ refuses a wording one document repeats but the others do not print", () => {
    // ⚠️ **THE FIXTURE IS DELIBERATELY MEMBER-HEAVY, AFTER A MUTATION ROUND
    // SHOWED THE OLD ONE COULD NOT DISCRIMINATE THE RULE IT NAMED.** With one
    // member per once-seen caption, an implementation that counted MEMBERS
    // instead of distinct samples passed every assertion. Here the glued-on
    // notary is printed FOUR times inside a single deed and the bare caption
    // twice, across two — so member-counting picks exactly the wrong one.
    const c = cluster("notar", [
      ["s1", "Notar Public MARIA IONESCU", "..."],
      ["s1", "Notar Public MARIA IONESCU", "..."],
      ["s1", "Notar Public MARIA IONESCU", "..."],
      ["s1", "Notar Public MARIA IONESCU", "..."],
      ["s2", "Notar public", "..."],
      ["s3", "Notar public", "..."],
    ]);
    expect(captionVariants(c)).toEqual(["Notar public"]);
    expect(distilledLabel(c)).toBe("Notar public");
  });

  it("⚠️ refuses a wording two documents share when the rest print another (share rule)", () => {
    // ⚠️ **THIS IS THE CASE THAT KILLED THE FIRST RULE.** It was "seen in more
    // than one sample", defended by "two different documents cannot share a
    // value". They can: a folder of sample deeds is normally deeds from ONE
    // notary office, so the same person is printed on two of the twenty — and
    // the earlier rule let „Notar Public MARIA IONESCU" onto the type every
    // future contract of the kind is read against. F5, verbatim.
    const members: (readonly [string, string, string])[] = [
      ["s1", "Notar Public MARIA IONESCU", "x"],
      ["s2", "Notar Public MARIA IONESCU", "x"],
    ];
    for (let i = 3; i <= 20; i += 1) members.push([`s${i}`, "Notar public", "x"]);
    const c = cluster("notar", members);
    expect(captionVariants(c)).toEqual(["Notar public"]);
    expect(distilledLabel(c)).toBe("Notar public");
  });

  it("⚠️ emits no hint at all when nothing repeated", () => {
    const c = cluster("x", [
      ["s1", "Către SC ALFA SRL", "..."],
      ["s2", "Către SC BETA SRL", "..."],
    ]);
    expect(captionVariants(c)).toEqual([]);
    expect(distilledHint([])).toBeNull();
  });

  it("caps the list rather than listing twenty", () => {
    // Four wordings, all within a third of the commonest, so all four qualify —
    // and three are emitted, because `aiHint` lands on one line of a prompt
    // charged by the token.
    const members: (readonly [string, string, string])[] = [];
    const push = (caption: string, from: number, to: number) => {
      for (let i = from; i <= to; i += 1) members.push([`s${i}`, caption, "v"]);
    };
    push("Alfa", 1, 9);
    push("Beta", 1, 5);
    push("Gama", 1, 4);
    push("Delta", 1, 3);
    const c = cluster("x", members);
    expect(captionVariants(c, 99)).toHaveLength(4);
    expect(captionVariants(c)).toEqual(["Alfa", "Beta", "Gama"]);
  });

  it("⚠️ a wording carrying the office's own notary REACHES the label when that office is the plurality", () => {
    // ⚠️ **THE RESIDUAL, ASSERTED RATHER THAN HIDDEN — this is what the module
    // does NOT do, pinned so nobody assumes otherwise.** Three rounds wrote a
    // rule to read the difference between two wordings and tell a name from a
    // qualifier; measured over realistic Romanian captions it missed 47% of
    // names and deleted 39% of qualifiers, so it was removed. When one office
    // certifies most of a folder its notary's name IS the commonest wording,
    // and it becomes the proposed label. The answer is not a cleverer rule: it
    // is that the label is a text box the user is looking at, with the key
    // derived from it printed live underneath, and nothing is written until
    // they press a button.
    const members: (readonly [string, string, string])[] = [];
    for (let i = 1; i <= 12; i += 1) members.push([`s${i}`, "Notar public MARIA IONESCU", "x"]);
    for (let i = 13; i <= 17; i += 1) members.push([`s${i}`, "Notar public", "x"]);
    const c = cluster("notar", members);
    expect(distilledLabel(c)).toBe("Notar public MARIA IONESCU");
    // …and BOTH wordings are drawn on the row, so the user can see the other
    // one exists. A rule that deleted a wording deleted it from the screen too.
    expect(captionVariants(c)).toEqual(["Notar public MARIA IONESCU", "Notar public"]);
  });

  it("⚠️ a qualifier is never silently deleted, which is what the removed rule did 39% of the time", () => {
    const members: (readonly [string, string, string])[] = [];
    for (let i = 1; i <= 15; i += 1) {
      members.push([`s${i}`, "Suprafata construita desfasurata", "120"]);
    }
    for (let i = 16; i <= 20; i += 1) members.push([`s${i}`, "Suprafata", "300"]);
    const c = cluster("supr", members);
    expect(distilledLabel(c)).toBe("Suprafata construita desfasurata");
    expect(captionVariants(c)).toEqual(["Suprafata construita desfasurata", "Suprafata"]);
  });

  it("⚠️ RULE 2 — refuses a wording one deed in twenty prints, even beside two good ones", () => {
    // ⚠️ **RULE 2 WAS COMPLETELY UNASSERTED UNTIL A MUTATION ROUND SAID SO:
    // every fixture that named it was decided by rule 1 or rule 3 first.** It
    // is load-bearing. With it deleted, a single deed's „Birou notarial IONESCU
    // MARIA" joins the two legitimate wordings and a name from ONE document
    // reaches the type.
    const members: (readonly [string, string, string])[] = [];
    for (let i = 1; i <= 12; i += 1) members.push([`s${i}`, "Notar public", "x"]);
    for (let i = 13; i <= 19; i += 1) members.push([`s${i}`, "Semnatura notarului", "x"]);
    members.push(["s20", "Birou notarial IONESCU MARIA", "x"]);
    expect(captionVariants(cluster("notar", members))).toEqual([
      "Notar public",
      "Semnatura notarului",
    ]);
  });

  it("⚠️ emits nothing from a cluster too thin to have a settled wording", () => {
    // Rule 1's floor is a FRACTION of the cluster's samples, so it loosens as
    // the cluster shrinks — a run the limiter cut down to two readings gave a
    // two-sample cluster a floor of two, and one notary's name on both cleared
    // every rule. There is an absolute floor underneath the fraction.
    const c = cluster("notar", [
      ["s1", "Notar Public MARIA IONESCU", "x"],
      ["s2", "Notar Public MARIA IONESCU", "y"],
    ]);
    expect(captionVariants(c)).toEqual([]);
    expect(distilledHint(captionVariants(c))).toBeNull();
  });

  it("⚠️ emits nothing when no wording is settled across the folder", () => {
    // Rule 1. Twenty deeds, twenty notaries, no bare caption anywhere: the
    // commonest wording covers two of twenty, so there is no caption to report
    // and the hint box is left empty — which is exactly today's behaviour, and
    // never worse than a wrong hint on a type every future document is read
    // against.
    const members: (readonly [string, string, string])[] = [];
    members.push(["s1", "Notar Public MARIA IONESCU", "x"]);
    members.push(["s2", "Notar Public MARIA IONESCU", "x"]);
    for (let i = 3; i <= 20; i += 1) members.push([`s${i}`, `Notar Public NUME ${i}`, "x"]);
    expect(captionVariants(cluster("notar", members))).toEqual([]);
  });

  it("masks a long digit run, in case a number ever rides in on a caption", () => {
    const c = cluster("cf", [
      ["s1", "Carte funciară 123456", "x"],
      ["s2", "Carte funciară 123456", "y"],
      ["s3", "Carte funciară 123456", "z"],
    ]);
    expect(captionVariants(c)).toEqual(["Carte funciară …"]);
  });

  it("⚠️ masks on the way OUT, so masking cannot manufacture agreement", () => {
    // ⚠️ A round found the first draft masking BEFORE counting, which collapsed
    // two once-seen captions carrying their own documents' case numbers into a
    // single wording "seen in two samples" — the belt-and-braces step
    // manufacturing the very multi-sample evidence the safety rule rests on.
    const c = cluster("dosar", [
      ["s1", "Dosar nr. 4471/2023", "x"],
      ["s2", "Dosar nr. 9902/2024", "y"],
    ]);
    expect(captionVariants(c)).toEqual([]);
    expect(distilledHint(captionVariants(c))).toBeNull();
  });

  it("⚠️ never lets a sample's value into the hint, end to end", () => {
    // ⚠️ **REWRITTEN AFTER A MUTATION ROUND SHOWED THE FIRST VERSION WAS A
    // TAUTOLOGY.** It called `distilledHint(captionVariants(c))`, and
    // `distilledHint` takes `readonly string[]` — it is not GIVEN the values,
    // so no implementation of it could ever fail the assertion. It restated a
    // type signature. This drives the whole pipeline instead, which is the only
    // level at which "a value cannot reach the prompt" is a claim about
    // behaviour.
    const out = distilFields({
      samples: reads(4),
      clusters: [
        cluster("pret", [
          ["s1", "Preț", "100.000 RON"],
          ["s2", "Preț", "250.000 RON"],
          ["s3", "Preț", "80.000 RON"],
          ["s4", "Preț", "95.000 RON"],
        ]),
      ],
      percent: 50,
      existing: [],
    });
    const hint = out.fields[0].aiHint ?? "";
    expect(hint).toContain("Preț");
    for (const value of ["100.000", "250.000", "80.000", "95.000", "RON"]) {
      expect(hint).not.toContain(value);
    }
  });

  it("emits a hint for a date field too, where an example value would contradict the line", () => {
    // buildFieldHint refuses date/number because a Romanian EXAMPLE contradicts
    // the ISO instruction printed beside it. A CAPTION contradicts nothing.
    const c = cluster("data", [
      ["s1", "Data autentificării", "12.04.2021"],
      ["s2", "Data autentificării", "03.11.2019"],
      ["s3", "Data autentificării", "28.02.2020"],
    ]);
    expect(distilledType(c)).toBe("date");
    expect(distilledHint(captionVariants(c))).toBe(
      "printed on the document as 'Data autentificării'",
    );
  });
});

// ---------------------------------------------------------------------------
// Label and type
// ---------------------------------------------------------------------------

describe("the label offered for renaming", () => {
  it("is the commonest wording", () => {
    const c = cluster("pret", [
      ["s1", "Preț vânzare", "1"],
      ["s2", "Preț vânzare", "2"],
      ["s3", "Preţul total al vânzării", "3"],
      ["s4", "Preţul total al vânzării", "4"],
      ["s5", "Preț vânzare", "5"],
    ]);
    expect(distilledLabel(c)).toBe("Preț vânzare");
  });

  it("is the alphabetically first of the equally common ones, deterministically", () => {
    // ⚠️ A mutation round showed the old assertion passed on first-seen order
    // rather than on any tie-break at all. The tie is broken by `localeCompare`
    // in `captionVariants`, so the fixture puts the winner SECOND: an
    // implementation with no tie-break returns the other one.
    const c = cluster("pret", [
      ["s1", "Zzz preț", "1"],
      ["s2", "Zzz preț", "2"],
      ["s3", "Aaa preț", "3"],
      ["s4", "Aaa preț", "4"],
    ]);
    expect(distilledLabel(c)).toBe("Aaa preț");
  });

  it("⚠️ falls back to the SHORTEST wording, not the first, when none repeats", () => {
    // Twenty deeds, twenty notaries: no wording is settled, and this still has
    // to return something because the key is derived from it. A caption with a
    // person or a value glued on is LONGER than the bare caption, so the
    // shortest is the least contaminated available.
    const c = cluster("notar", [
      ["s1", "Notar Public MARIA IONESCU", "x"],
      ["s2", "Notar", "y"],
      ["s3", "Notar Public GHEORGHE ENE", "z"],
    ]);
    expect(captionVariants(c)).toEqual([]);
    expect(distilledLabel(c)).toBe("Notar");
  });

  it("⚠️ is NOT decided by the hint's three-sample floor", () => {
    // ⚠️ A third round found the label routed through `captionVariants`, so a
    // two-sample cluster fell to the shortest-caption fallback and was named
    // „Sc" — a one-off abbreviation seen once beating the wording printed on
    // both deeds. The floor is about whether a wording is settled enough to
    // teach the MODEL; it has no business deciding what the field is called.
    const c = cluster("supr", [
      ["s1", "Suprafata construita desfasurata", "120"],
      ["s1", "Sc", "120"],
      ["s2", "Suprafata construita desfasurata", "300"],
    ]);
    expect(captionVariants(c)).toEqual([]);
    expect(distilledLabel(c)).toBe("Suprafata construita desfasurata");
  });

  it("⚠️ trims a too-long caption on a word boundary, never mid-word", () => {
    // F5 reported two keys "truncated mid-word at 40 characters".
    const long = "Prețul total al vânzării convenit de comun acord între părțile contractante";
    const c = cluster("x", [["s1", long, "1"]]);
    const label = distilledLabel(c);
    expect(label.length).toBeLessThan(long.length);
    expect(long.startsWith(label)).toBe(true);
    expect(long[label.length]).toBe(" ");
  });

  it("falls back to the one wording there is when nothing repeated", () => {
    const c = cluster("x", [["s1", "Obiectul contractului", "..."]]);
    expect(distilledLabel(c)).toBe("Obiectul contractului");
  });
});

describe("the type, voted for by every value rather than guessed from one", () => {
  it("reads a column of Romanian dates as a date", () => {
    const c = cluster("d", [
      ["s1", "Data", "12.04.2021"],
      ["s2", "Data", "03.11.2019"],
      ["s3", "Data", "28.02.2020"],
    ]);
    expect(distilledType(c)).toBe("date");
  });

  it("⚠️ falls back to text when the values disagree", () => {
    // A field that is a date in half the deeds and prose in the rest is stored
    // as text. <input type="date"> renders a non-ISO stored value as BLANK —
    // stored, invisible and uneditable — where a text input renders anything.
    const c = cluster("d", [
      ["s1", "Data", "12.04.2021"],
      ["s2", "Data", "conform anexei"],
      ["s3", "Data", "03.11.2019"],
      ["s4", "Data", "nespecificat"],
    ]);
    expect(distilledType(c)).toBe("text");
  });

  it("⚠️ does not let one deed with a six-row table outvote four other deeds", () => {
    // ⚠️ **A ROUND CAUGHT THIS COUNTING MEMBERS — the exact discipline the
    // module declares for `sampleCount` and had not applied here.** One deed
    // listing six parcels contributed six numeric members against four other
    // deeds' one prose member each, and the field was stored as `number`, which
    // renders BLANK on four documents out of five.
    const members: (readonly [string, string, string])[] = [];
    for (let i = 0; i < 6; i += 1) members.push(["s1", "Cotă", "1.50"]);
    for (let i = 2; i <= 5; i += 1) members.push([`s${i}`, "Cotă", "o doime"]);
    expect(distilledType(cluster("cota", members))).toBe("text");
  });

  it("⚠️ needs every sample to agree before it stores a date", () => {
    // A sample-level MAJORITY is not enough either: three date-shaped deeds
    // against two that print „conform anexei" is 60/40, and 40% of the type's
    // documents would render an empty box. `<input type="text">` renders
    // anything, so being wrong in that direction costs a wider input.
    const members: (readonly [string, string, string])[] = [
      ["s1", "Data", "12.04.2021"],
      ["s2", "Data", "03.11.2019"],
      ["s3", "Data", "28.02.2020"],
      ["s4", "Data", "conform anexei"],
      ["s5", "Data", "nespecificat"],
    ];
    expect(distilledType(cluster("data", members))).toBe("text");
    expect(distilledType(cluster("data", members.slice(0, 3)))).toBe("date");
  });

  it("⚠️ widens to a textarea when any sample prints prose", () => {
    // The one branch where a single sample decides, and deliberately: a
    // textarea renders a short value perfectly, while a text input shows a
    // 400-character clause through a one-line window. Widening is the safe
    // direction, which is why it is not held to the unanimity the narrow types
    // are.
    const long = "x".repeat(200);
    const c = cluster("obs", [
      ["s1", "Observații", "scurt"],
      ["s2", "Observații", long],
      ["s3", "Observații", "scurt"],
    ]);
    expect(distilledType(c)).toBe("textarea");
  });

  it("⚠️ a Romanian date on the page is evidence of a DATE, not of what gets stored", () => {
    // Worth saying because it reads like a defect and is not. The values here
    // are what is PRINTED, in Romanian order — but the extraction prompt built
    // from this field will carry `templateFieldFormatHint("date")`, which tells
    // the model to answer "ISO yyyy-mm-dd". So the stored value on every future
    // document is ISO and `<input type="date">` renders it. The blank-render
    // failure this type choice is guarded against comes from DISAGREEMENT
    // between samples, not from the printed format.
    const c = cluster("data", [
      ["s1", "Data", "12.04.2021"],
      ["s2", "Data", "03.11.2019"],
      ["s3", "Data", "28.02.2020"],
    ]);
    expect(distilledType(c)).toBe("date");
  });

  it("does not call one deed's bare number a number field on its own", () => {
    const c = cluster("n", [
      ["s1", "Cotă", "1.50"],
      ["s2", "Cotă", "o doime"],
      ["s3", "Cotă", "1/2"],
    ]);
    expect(distilledType(c)).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// Keys, and the ceilings that already exist
// ---------------------------------------------------------------------------

describe("the keys it mints", () => {
  it("⚠️ does not offer a field the type already stores under another convention", () => {
    // ⚠️ **THE FIRST DRAFT SUFFIXED IT TO `pret_total_2`, AND AN ADVERSARIAL
    // ROUND SHOWED THAT REBUILDS F5's OWN DEFECT.** The save route collapses an
    // accepted key that NORMALISES onto a stored one — `pret_total` onto
    // `pretTotal` — and a key renamed to dodge the collision no longer
    // normalises onto anything, so `mergeAcceptedFields` kept both. Two
    // columns, identical labels, one meaning, and every future document's data
    // split between them. A cluster the type already holds is reported as
    // already captured and never offered.
    const out = distilFields({
      samples: reads(2),
      clusters: [seenIn("c", 2, "Preț total")],
      percent: 50,
      existing: [field({ key: "pretTotal", labelRo: "Preț total" })],
    });
    expect(out.fields).toEqual([]);
    expect(out.alreadyCaptured.map((a) => a.labelRo)).toEqual(["Preț total"]);
  });


});

// ---------------------------------------------------------------------------
// The below-the-line half
// ---------------------------------------------------------------------------

describe("what falls below the line", () => {
  it("is named, with its share and one value, so the user can see the consequence", () => {
    const out = distilFields({
      samples: reads(10),
      clusters: [seenIn("rare", 2, "Mențiuni speciale", "ceva")],
      percent: 50,
      existing: [],
    });
    expect(out.fields).toHaveLength(0);
    expect(out.below).toEqual([
      {
        clusterId: "rare",
        labelRo: "Mențiuni speciale",
        foundIn: 2,
        sharePercent: 20,
        sampleValue: "ceva0",
      },
    ]);
  });

  it("⚠️ drops a cluster whose captions carry no letters — no `camp`, no `camp_2`", () => {
    // ⚠️ A round found page numbers and cadastral numbers OCR'd into the label
    // position surviving as „…", which is not empty — so two nameless rows
    // reached the screen keyed `camp` and `camp_2`, which is literally the pair
    // of defects F5 reports.
    const out = distilFields({
      samples: reads(3),
      clusters: [
        cluster("n1", [["s1", "123456", "a"], ["s2", "123456", "b"], ["s3", "123456", "c"]]),
        cluster("n2", [["s1", "998877", "a"], ["s2", "998877", "b"], ["s3", "998877", "c"]]),
      ],
      percent: 50,
      existing: [],
    });
    expect(out.fields).toEqual([]);
    expect(out.below).toEqual([]);
    expect(out.alreadyCaptured).toEqual([]);
  });

  it("⚠️ recognises a field the type already holds under any wording it was printed with", () => {
    // ⚠️ The caption rules can SHORTEN the label, and a round showed the
    // shortened slug no longer normalising onto the stored key — so a second
    // permanent column was proposed for a field the type already had, which is
    // the outcome the already-captured branch exists to prevent, arriving
    // through the front door.
    const members: (readonly [string, string, string])[] = [];
    for (let i = 1; i <= 13; i += 1) members.push([`s${i}`, "Data autentificarii", "12.04.2021"]);
    for (let i = 14; i <= 20; i += 1) members.push([`s${i}`, "Data", "03.11.2019"]);
    const out = distilFields({
      samples: reads(20),
      clusters: [cluster("d", members)],
      percent: 50,
      existing: [field({ key: "dataAutentificarii", labelRo: "Data autentificării" })],
    });
    expect(out.fields).toEqual([]);
    expect(out.alreadyCaptured).toHaveLength(1);
  });

  it("⚠️ …including when the wording it settled on is the SHORT one", () => {
    // ⚠️ The case a mutation round found unasserted: with ten deeds printing
    // each wording, the label settles on „Data", whose slug does NOT normalise
    // onto the stored `dataAutentificarii`. Only testing every observed caption
    // catches it — and missing it proposes a second permanent column for a
    // field the type already has, which the save route cannot collapse either.
    const members: (readonly [string, string, string])[] = [];
    for (let i = 1; i <= 10; i += 1) members.push([`s${i}`, "Data autentificarii", "12.04.2021"]);
    for (let i = 11; i <= 20; i += 1) members.push([`s${i}`, "Data", "03.11.2019"]);
    const out = distilFields({
      samples: reads(20),
      clusters: [cluster("d", members)],
      percent: 50,
      existing: [field({ key: "dataAutentificarii", labelRo: "Data autentificării" })],
    });
    expect(distilledLabel(cluster("d", members))).toBe("Data");
    expect(out.fields).toEqual([]);
    expect(out.alreadyCaptured).toHaveLength(1);
  });

  it("⚠️ drops a cluster with no readable caption rather than showing a nameless row", () => {
    // Blank OCR captions used to reach the screen as an empty label with the
    // key „camp" — a row the user cannot judge and cannot name.
    const out = distilFields({
      samples: reads(2),
      clusters: [
        cluster("blank", [
          ["s1", "   ", "x"],
          ["s2", "\t\n ", "y"],
        ]),
        seenIn("real", 2, "Nr. cadastral"),
      ],
      percent: 50,
      existing: [],
    });
    expect(out.fields.map((f) => f.labelRo)).toEqual(["Nr. cadastral"]);
    expect(out.below).toEqual([]);
  });

  it("moves across the line when the percentage is lowered, with nothing re-read", () => {
    // ⚠️ Both thresholds are values the dropdown can actually produce, because
    // `percent` is `MatchingPercent` and not `number` — a fixture at 20% would
    // be testing a state the screen cannot reach. (It was, until `npx tsc`
    // caught it: the typecheck project I could run here did not include the
    // test files, which is the gap that let it through.)
    const samples = reads(10);
    const clusters = [seenIn("rare", 6, "Mențiuni speciale")];
    // 6 of 10 is 60%: below a 75% line, above a 50% one — and moving the line
    // is arithmetic over the cluster table, with no sample re-read.
    const strict = distilFields({ samples, clusters, percent: 75, existing: [] });
    expect(strict.fields).toHaveLength(0);
    expect(strict.below.map((b) => b.sharePercent)).toEqual([60]);

    const relaxed = distilFields({ samples, clusters, percent: 50, existing: [] });
    expect(relaxed.below).toHaveLength(0);
    expect(relaxed.fields.map((f) => f.labelRo)).toEqual(["Mențiuni speciale"]);
  });
});

// ---------------------------------------------------------------------------
// ⚠️ F5, replayed
// ---------------------------------------------------------------------------

describe("⚠️ F5 — the thirty-five fragments one deed produced", () => {
  // The #29.01 report: a form discovered from ONE notarial deed produced
  // thirty-five fields that were sentence fragments cut at the value, plus four
  // that were the same field twice with a _2 suffix because the deed named two
  // parties. Nineteen other deeds of the same kind do not carry those
  // fragments, and that is the whole structural answer.
  const samples = reads(20);

  const fragments = [
    "pretul vanzarii este de",
    "s-a taxat cu",
    "din totalul de",
  ].map((label, i) => cluster(`frag${i}`, [["s1", label, "…"]]));

  const real = [
    seenIn("nr", 20, "Nr. cadastral"),
    seenIn("supr", 19, "Suprafață"),
    seenIn("pret", 18, "Preț vânzare"),
  ];

  const twoPartiesInOneDeed = cluster("parti", [
    ["s1", "Vânzător", "ION POPESCU"],
    ["s1", "Vânzător", "MARIA POPESCU"],
  ]);

  it("keeps the three fields every deed carries and none of the fragments", () => {
    const out = distilFields({
      samples,
      clusters: [...fragments, ...real, twoPartiesInOneDeed],
      percent: 75,
      existing: [],
    });
    expect(out.fields.map((f) => f.labelRo)).toEqual([
      "Nr. cadastral",
      "Suprafață",
      "Preț vânzare",
    ]);
  });

  it("offers no field at all for the deed that named two parties", () => {
    // F5's `_2` suffix came from ONE deed naming two sellers. Counting distinct
    // samples makes that one document, so at 75% over twenty it is not a field
    // — and no key, suffixed or otherwise, is ever minted for it. (The key
    // itself is minted on the screen, from the label the user approves.)
    const out = distilFields({
      samples,
      clusters: [...fragments, ...real, twoPartiesInOneDeed],
      percent: 75,
      existing: [],
    });
    expect(out.fields.map((f) => f.clusterId)).not.toContain("parti");
    expect(out.below.map((b) => b.clusterId)).toContain("parti");
  });

  it("carries no deed's own parcel or price into any hint", () => {
    const out = distilFields({
      samples,
      clusters: [
        cluster(
          "tarla",
          Array.from(
            { length: 16 },
            (_, i) => [`s${i + 1}`, "Tarla", `T ${[42, 7, 118, 9][i % 4]}`] as const,
          ),
        ),
        ...real,
      ],
      percent: 50,
      existing: [],
    });
    const hints = out.fields.map((f) => f.aiHint ?? "").join(" | ");
    expect(hints).not.toMatch(/T 42|T 7|T 118/);
    expect(hints).toContain("printed on the document as 'Tarla'");
  });

  it("names the fragments below the line rather than dropping them off the screen", () => {
    const out = distilFields({
      samples,
      clusters: [...fragments, ...real],
      percent: 75,
      existing: [],
    });
    expect(out.below.map((b) => b.labelRo).sort()).toEqual([
      "din totalul de",
      "pretul vanzarii este de",
      "s-a taxat cu",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

describe("pacing a run against the limiter", () => {
  const T = 1_000_000;

  it("does not wait while there is capacity", () => {
    const starts = Array.from({ length: OCR_MAX_REQUESTS - 1 }, (_, i) => T + i);
    expect(msUntilNextSlot(starts, T + 100)).toBe(0);
  });

  it("waits for the oldest request in the window to expire", () => {
    const starts = Array.from({ length: OCR_MAX_REQUESTS }, (_, i) => T + i * 100);
    // The oldest started at T; its slot frees at T + window, plus three seconds
    // of clock safety — measured from now, which is T + 1000.
    expect(msUntilNextSlot(starts, T + 1_000)).toBe(OCR_WINDOW_MS + 2_000);
  });

  it("⚠️ picks the slot that frees next, not the oldest start", () => {
    // ⚠️ A mutation round replaced `inWindow[length - MAX]` with `inWindow[0]`
    // and every test still passed, because the one fixture used exactly
    // OCR_MAX_REQUESTS starts, where the two indices coincide. With MORE starts
    // in the window than the limit — which is what a retried run produces — the
    // difference is the whole wait.
    const starts = Array.from({ length: OCR_MAX_REQUESTS + 5 }, (_, i) => T + i * 1_000);
    // The window holds 15; the 6th (index 5) is the one whose expiry frees a slot.
    expect(msUntilNextSlot(starts, T + 20_000)).toBe(T + 5_000 + OCR_WINDOW_MS + 3_000 - (T + 20_000));
  });

  it("⚠️ never promises a wait longer than a slot can take, even on a clock that jumps", () => {
    // `Date.now()` is not monotonic. A start recorded before a backward step
    // sits in the future, and an adversarial round produced an eleven-minute
    // „waiting for a slot" from a ten-minute jump — uncapped, while
    // `retryAfterMs` beside it was capped.
    const future = Array.from({ length: OCR_MAX_REQUESTS }, (_, i) => T + 600_000 + i);
    expect(msUntilNextSlot(future, T)).toBe(OCR_WINDOW_MS + 3_000);
  });

  it("⚠️ ignores starts that have already left the window", () => {
    // ⚠️ The old fixture (all stale) passed with the window filter DELETED,
    // because `Math.max(0, …)` clamps the negative result either way. This one
    // mixes stale with fresh: without the filter there are twenty starts and
    // the oldest is used, which produces a wait; with it there are nine and the
    // answer is 0.
    const stale = Array.from({ length: OCR_MAX_REQUESTS }, (_, i) => T + i);
    const fresh = Array.from(
      { length: OCR_MAX_REQUESTS - 1 },
      (_, i) => T + OCR_WINDOW_MS + 2_000 + i,
    );
    expect(msUntilNextSlot([...stale, ...fresh], T + OCR_WINDOW_MS + 5_000)).toBe(0);
    expect(msUntilNextSlot(stale, T + 1_000)).toBeGreaterThan(0);
  });

  it("reads Retry-After, and survives a header that is not a number", () => {
    expect(retryAfterMs("30")).toBe(33_000);
    expect(retryAfterMs(null)).toBe(OCR_WINDOW_MS);
    expect(retryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT")).toBe(OCR_WINDOW_MS);
    expect(retryAfterMs("-5")).toBe(OCR_WINDOW_MS);
    expect(retryAfterMs("99999")).toBe(120_000);
  });

  it("⚠️ treats a blank Retry-After as no header, not as zero seconds", () => {
    // ⚠️ `Number("".trim())` is 0, not NaN, so a whitespace-only header slipped
    // past the isFinite guard and became a near-instant retry against a limiter
    // that was still refusing — the loop the guard exists to prevent.
    expect(retryAfterMs("")).toBe(OCR_WINDOW_MS);
    expect(retryAfterMs(" ")).toBe(OCR_WINDOW_MS);
    expect(retryAfterMs("  \t ")).toBe(OCR_WINDOW_MS);
    expect(retryAfterMs("0")).toBe(OCR_WINDOW_MS);
  });

  it("states a floor for how long the run will take, before it is paid for", () => {
    expect(minimumRunMs(10)).toBe(0);
    expect(minimumRunMs(11)).toBe(OCR_WINDOW_MS);
    expect(minimumRunMs(20)).toBe(OCR_WINDOW_MS);
    expect(minimumRunMs(21)).toBe(2 * OCR_WINDOW_MS);
  });
});
