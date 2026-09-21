/**
 * @jest-environment node
 */

/**
 * Slice #36.03 — the instruments a deed cites come back as structured
 * references, and the ranking that suggests what each one might be.
 *
 * ---------------------------------------------------------------------------
 * THE CORPUS IS REAL, AND THAT IS THE POINT OF IT
 * ---------------------------------------------------------------------------
 *
 * `CITATIONS` below is every instrument cited by the six deeds transcribed in
 * full in
 * `C:\dev.docs\01.Slice.Inputs\Slices.36.nn.CVC.etc\Grok.CVC-semantic-template-filled-examples-v01.docx`
 * — six of the thirty-two deed folders under
 * `C:\dev\TEST.DATA\Modele.Acte\ZZZ Modele acte`, one of each of the six kinds
 * that document sets out. **45 citations, 43 distinct instruments.**
 *
 * ⚠️ **IT IS A TRANSCRIPTION, NOT A RE-READ, AND SAYING SO IS THE POINT.** The
 * sample folders hold SCANS. Reading them again to build this corpus would be
 * thirty-two billed vision calls, which is the cost this whole slice is
 * arranged around not paying twice. The transcription was made from those
 * scans by a person, it is in the repository's own input folder, and it is what
 * the numbers in `referenced-instruments.ts` were measured over. A later slice
 * that re-reads the scans and finds a number transcribed wrong should fix it
 * HERE and re-run — the thresholds are derived from this list, and both will
 * move together or neither should.
 *
 * ⚠️ **SO THE NUMBERS IN THE MODULE'S COMMENTS ARE NOT DECORATION — THIS FILE
 * IS WHAT MAKES THEM TRUE.** §1 recomputes the digit histogram and the cost of
 * each candidate threshold, and fails if `isCommonDocumentNumber` is changed
 * without the comment changing with it. That is the difference between a
 * measured threshold and a remembered one.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT CHECKED HERE, AND WHY
 * ---------------------------------------------------------------------------
 *
 * The direction column, the four seeded roles and the unique index are
 * statements about SQL, and there is no database in this suite. A mock would be
 * asserting what the mock was written to do. `scripts/Verify-Rebuild.ps1` is
 * what exercises those, on a real Postgres 16, and it is in the handover. What
 * IS checkable here — and is what a later slice can undo by accident — is that
 * the migration and the schema declaration AGREE, that the ranker behaves, that
 * `linkDirection` converts a purpose into the stored flag correctly in BOTH
 * uuid orders, and that every sentence exists in both locales.
 */

import fs from "fs";
import path from "path";

import {
  PURPOSE_READS_CITED_TO_CITING,
  PURPOSE_ROLE_NAME,
  INSTRUMENT_PURPOSES,
  foldDocumentNumber,
  isCommonDocumentNumber,
  linkDirection,
  parseReferencedInstruments,
  rankInstrumentCandidates,
  sanitizeExtractedInstrument,
  type InstrumentCandidateDoc,
  type InstrumentPurpose,
} from "@/lib/documents/referenced-instruments";

const ROOT = process.cwd();

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(read("messages", `${locale}.json`)) as Record<string, unknown>;
}

function at(obj: unknown, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

const LOCALES = ["ro-RO", "en-GB"] as const;

// ---------------------------------------------------------------------------
// The corpus
// ---------------------------------------------------------------------------

type Citation = {
  deed: string;
  typeLabel: string;
  nr: string;
  date: string;
  issuer: string;
  purpose: InstrumentPurpose;
};

const c = (
  deed: string, typeLabel: string, nr: string, date: string, issuer: string, purpose: InstrumentPurpose,
): Citation => ({ deed, typeLabel, nr, date, issuer, purpose });

const CITATIONS: Citation[] = [
  // Tip 1 — folder „1-CVC 3-45-2500", CVC 3211/10.10.2006 BNP Dumitrescu
  c("D1", "Titlu de proprietate",         "65106", "1996-06-11", "CJSDPT Giurgiu",            "TITLE_CHAIN"),
  c("D1", "Certificat fiscal",            "3173",  "2006-09-25", "Primăria Grădinari",        "SUPPORTING"),
  c("D1", "Extras de carte funciară",     "26373", "2006-10-04", "OCPI Giurgiu",              "SUPPORTING"),
  c("D1", "Procură",                      "2585",  "2006-08-25", "BNP Dumitrescu Florentina", "SUPPORTING"),
  // Tip 2 — folder „2-CVC 40per6-14-5000 com 2006", CVC 664/02.03.2006
  c("D2", "Titlu de proprietate",         "68892", "2004-03-29", "CJSDPT Ilfov",              "TITLE_CHAIN"),
  c("D2", "Certificat fiscal",            "914",   "2006-02-08", "Primăria Ciorogârla",       "SUPPORTING"),
  c("D2", "Antecontract",                 "918",   "2005-04-08", "BNP Dumitrescu Florentina", "PROMISE"),
  c("D2", "Procură",                      "898",   "2005-04-07", "BNP Dumitrescu Florentina", "SUPPORTING"),
  c("D2", "Procură",                      "1453",  "2004-08-26", "BNP Beanga",                "SUPPORTING"),
  c("D2", "Procură",                      "828",   "2005-04-13", "BNP Daniela Gorcia",        "SUPPORTING"),
  // Tip 3 — folder „3-CVC 3-11-3400 comasare completare"
  c("D3", "Certificat de moștenitor",     "325",   "2006-12-14", "BNP Răducan Mitică",        "TITLE_CHAIN"),
  c("D3", "Titlu de proprietate",         "65127", "1996-06-11", "CJSDPT Giurgiu",            "TITLE_CHAIN"),
  c("D3", "Certificat fiscal",            "3637",  "2007-09-27", "Primăria Grădinari",        "SUPPORTING"),
  c("D3", "Procură",                      "310",   "2007-02-02", "BNP Dumitrescu Florentina", "SUPPORTING"),
  c("D3", "Încheiere de completare",      "10",    "2015-02-18", "BNP Haiduc",                "SUPPORTING"),
  // Tip 4 — folder „4-CVC parcela si cota drum Busuioc", CVC 1537/16.05.2008
  c("D4", "Contract de vânzare-cumpărare","1807",  "2005-06-29", "BNP Dumitrescu",            "TITLE_CHAIN"),
  c("D4", "Act de lotizare",              "1374",  "2005-05-20", "BNP Dumitrescu",            "TITLE_CHAIN"),
  c("D4", "Certificat de moștenitor",     "128",   "2004-07-01", "BNP Savu Nicolae",          "TITLE_CHAIN"),
  c("D4", "Titlu de proprietate",         "12575", "1994-10-17", "CJSDPT Ilfov",              "TITLE_CHAIN"),
  c("D4", "Certificat fiscal",            "1210",  "2008-05-14", "Primăria Clinceni",         "SUPPORTING"),
  c("D4", "Extras de carte funciară",     "74868", "2008-05-13", "OCPI Ilfov",                "SUPPORTING"),
  c("D4", "Extras de carte funciară",     "74864", "2008-05-13", "OCPI Ilfov",                "SUPPORTING"),
  c("D4", "Certificat de urbanism",       "574",   "2007-07-18", "Primăria Clinceni",         "SUPPORTING"),
  c("D4", "Act de lotizare",              "770",   "2008-03-11", "BNP Dumitrescu Florentina", "SUPPORTING"),
  c("D4", "Procură",                      "846",   "2008-03-17", "BNP Dumitrescu",            "SUPPORTING"),
  // Tip 5 — folder „5-CVC 2-2-5000 CRH 2016"
  c("D5", "Contract de vânzare-cumpărare","3264",  "2007-11-23", "BNP Nicoleta Tudor",        "TITLE_CHAIN"),
  c("D5", "Act de partaj",                "2794",  "2005-11-18", "BNP Nicoleta Tudor",        "TITLE_CHAIN"),
  c("D5", "Certificat de moștenitor",     "443",   "2005-11-01", "BNP Nicoleta Tudor",        "TITLE_CHAIN"),
  c("D5", "Titlu de proprietate",         "64338", "1996-05-14", "CJSDPT Giurgiu",            "TITLE_CHAIN"),
  c("D5", "Extras de carte funciară",     "30495", "2016-06-30", "OCPI-BCPI Giurgiu",         "SUPPORTING"),
  c("D5", "Certificat fiscal",            "305",   "2016-07-01", "Primăria Grădinari",        "SUPPORTING"),
  c("D5", "Ofertă de vânzare",            "165/2754", "2016-05-31", "Primăria Grădinari",     "SUPPORTING"),
  c("D5", "Adeverință",                   "3245",  "2016-07-01", "Primăria Grădinari",        "SUPPORTING"),
  c("D5", "Adeverință",                   "3247",  "2016-07-01", "Primăria Grădinari",        "SUPPORTING"),
  c("D5", "Adresă",                       "3246",  "2016-07-01", "Primăria Grădinari",        "SUPPORTING"),
  c("D5", "Promisiune bilaterală",        "1761",  "2015-08-07", "Marius Petcu",              "PROMISE"),
  c("D5", "Procură",                      "1762",  "2016-08-07", "Marius Petcu",              "SUPPORTING"),
  c("D5", "Procură",                      "1569",  "2015-09-28", "SPN Manciu & Moțatu",       "SUPPORTING"),
  // Tip 6 — folder „6-Act aditional 2-2-5000 2016", act adițional 1410/24.05.2016
  c("D6", "Contract de vânzare-cumpărare","3264",  "2007-11-23", "BNP Nicoleta Tudor",        "PARENT"),
  c("D6", "Certificat de sarcini",        "23317", "2016-05-18", "OCPI-BCPI Giurgiu",         "SUPPORTING"),
  c("D6", "Certificat fiscal",            "220",   "2016-05-16", "Primăria Grădinari",        "SUPPORTING"),
  c("D6", "Titlu de proprietate",         "64338", "1996-05-14", "CJSDPT Giurgiu",            "TITLE_CHAIN"),
  c("D6", "Procură",                      "1232",  "2016-05-10", "Marius Petcu",              "SUPPORTING"),
  c("D6", "Procură",                      "1762",  "2015-08-07", "Marius Petcu",              "SUPPORTING"),
  c("D6", "Procură rectificativă",        "53",    "2015-08-07", "Marius Petcu",              "SUPPORTING"),
];

const instrumentKey = (x: Citation) => `${foldDocumentNumber(x.nr)}|${x.date}`;

/** One archived document per distinct instrument the corpus names. */
function buildArchive(): InstrumentCandidateDoc[] {
  const byKey = new Map<string, InstrumentCandidateDoc>();
  for (const x of CITATIONS) {
    const key = instrumentKey(x);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      id:              key,
      code:            `DOC${10000 + byKey.size}`,
      title:           `${x.typeLabel} ${x.nr}`,
      typeName:        x.typeLabel,
      nrDocument:      x.nr,
      dateDocument:    x.date,
      institutionName: x.issuer,
      isStub:          false,
    });
  }
  return [...byKey.values()];
}

const refOf = (x: Citation) => ({
  nrDocument:   x.nr,
  dateDocument: x.date,
  typeLabel:    x.typeLabel,
  issuer:       x.issuer,
});

/** The ranker's own rule 2: the pool is narrowed by the folded number. */
const poolFor = (x: Citation, docs: InstrumentCandidateDoc[]) =>
  docs.filter((d) => foldDocumentNumber(d.nrDocument) === foldDocumentNumber(x.nr));

// ---------------------------------------------------------------------------
// 1. The corpus, and the thresholds measured over it
// ---------------------------------------------------------------------------

describe("the measured corpus", () => {
  it("is 45 citations naming 43 distinct instruments", () => {
    expect(CITATIONS.length).toBe(45);
    expect(new Set(CITATIONS.map(instrumentKey)).size).toBe(43);
  });

  it("has the digit-length distribution the threshold comment quotes", () => {
    const hist: Record<number, number> = {};
    for (const x of CITATIONS) {
      const n = foldDocumentNumber(x.nr).replace(/\D/g, "").length;
      hist[n] = (hist[n] ?? 0) + 1;
    }
    expect(hist).toEqual({ 2: 2, 3: 13, 4: 18, 5: 11, 7: 1 });
  });

  /**
   * ⚠️ **THIS IS THE TEST THAT MAKES THE THRESHOLD MEASURED RATHER THAN
   * REMEMBERED.** `isCommonDocumentNumber` is `< 3`, and the module's comment
   * justifies that by naming what `< 4` and `< 5` would have cost. Recomputing
   * all three here means a later slice cannot loosen the rule while leaving a
   * paragraph behind that argues for the old one.
   */
  it("pays 2 of 45 at the threshold that shipped, where < 4 would pay 15 and < 5 would pay 33", () => {
    const lens = CITATIONS.map((x) => foldDocumentNumber(x.nr).replace(/\D/g, "").length);
    expect(CITATIONS.filter((x) => isCommonDocumentNumber(foldDocumentNumber(x.nr))).length).toBe(2);
    expect(lens.filter((n) => n < 4).length).toBe(15);
    expect(lens.filter((n) => n < 5).length).toBe(33);
  });

  it("names the two short numbers the rule is written for", () => {
    const short = CITATIONS
      .filter((x) => isCommonDocumentNumber(foldDocumentNumber(x.nr)))
      .map((x) => x.nr);
    expect(short.sort()).toEqual(["10", "53"]);
  });
});

// ---------------------------------------------------------------------------
// 2. The number fold
// ---------------------------------------------------------------------------

describe("foldDocumentNumber", () => {
  it("makes two spellings of one number equal", () => {
    expect(foldDocumentNumber("nr. 03264")).toBe(foldDocumentNumber("3264"));
    expect(foldDocumentNumber(" 3 264 ")).toBe("3264");
    expect(foldDocumentNumber("165 / 02754")).toBe("165/2754");
  });

  /**
   * ⚠️ **THE REGRESSION THIS FILE EXISTS TO PREVENT, AND IT SHIPPED BROKEN IN
   * THE FIRST DRAFT.** The leading-zero rule was `/0+(\d)/g`, which matches
   * ANYWHERE: the real titlu de proprietate number 65106 folded to 6516 — an
   * internal zero eaten, silently, producing a plausible string that matches
   * nothing. The measurement over the corpus above is what caught it on its
   * first run. Three of the corpus's own numbers carry an internal zero.
   */
  it("strips LEADING zeros only, and never an internal one", () => {
    expect(foldDocumentNumber("65106")).toBe("65106");
    expect(foldDocumentNumber("30495")).toBe("30495");
    expect(foldDocumentNumber("1807")).toBe("1807");
    expect(foldDocumentNumber("00123")).toBe("123");
    expect(foldDocumentNumber("165/02754")).toBe("165/2754");
  });

  it("keeps an all-zero run as a number rather than folding it away", () => {
    expect(foldDocumentNumber("0")).toBe("0");
    expect(foldDocumentNumber("00")).toBe("0");
  });

  it("answers the empty string for nothing usable, which the ranker treats as no number", () => {
    expect(foldDocumentNumber(null)).toBe("");
    expect(foldDocumentNumber("—")).toBe("");
    expect(rankInstrumentCandidates({ nrDocument: null, dateDocument: "2006-01-01", typeLabel: null, issuer: null }, buildArchive())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. The ranking, measured over the corpus
// ---------------------------------------------------------------------------

describe("rankInstrumentCandidates over the sample corpus", () => {
  type Outcome = { offered: number; correctAtRank1: number; ambiguous: number; tiers: Record<string, number> };

  function measure(mutate: (d: InstrumentCandidateDoc) => InstrumentCandidateDoc): Outcome {
    const docs = buildArchive().map(mutate);
    const out: Outcome = { offered: 0, correctAtRank1: 0, ambiguous: 0, tiers: { strong: 0, fair: 0, weak: 0 } };
    for (const x of CITATIONS) {
      const ranked = rankInstrumentCandidates(refOf(x), poolFor(x, docs));
      if (ranked.length === 0) continue;
      out.offered += 1;
      out.tiers[ranked[0].tier] += 1;
      if (ranked.length > 1) out.ambiguous += 1;
      if (ranked[0].document.id === instrumentKey(x)) out.correctAtRank1 += 1;
    }
    return out;
  }

  it("finds the right document at rank 1 for every citation, against a complete archive", () => {
    const m = measure((d) => d);
    expect(m.offered).toBe(45);
    expect(m.correctAtRank1).toBe(45);
    expect(m.ambiguous).toBe(0);
    expect(m.tiers.strong).toBe(45);
  });

  /**
   * The commonest real state of this archive: `institution_id` is null on most
   * documents. It must cost nothing, which is rule 3's whole argument — an
   * issuer is a free-text reading of a notary's stamp, not identity.
   */
  it("is unaffected when the archive has no institution recorded", () => {
    const m = measure((d) => ({ ...d, institutionName: null }));
    expect(m.correctAtRank1).toBe(45);
    expect(m.tiers.strong).toBe(45);
  });

  /**
   * „Contract de Vânzare" and „contract de vânzare-cumpărare" are one
   * instrument under two filing names. A disagreeing type DEMOTES and must
   * never disqualify — the three affected citations drop from `strong` to
   * `fair` and stay at rank 1.
   */
  it("demotes rather than drops a candidate whose type is filed under another name", () => {
    const m = measure((d) => ({
      ...d,
      typeName: d.typeName === "Contract de vânzare-cumpărare" ? "Contract de Vânzare" : d.typeName,
    }));
    expect(m.correctAtRank1).toBe(45);
    expect(m.tiers.strong).toBe(42);
    expect(m.tiers.fair).toBe(3);
  });

  it("still offers every citation against an archive with no dates, all at the weakest tier", () => {
    const m = measure((d) => ({ ...d, dateDocument: null }));
    expect(m.offered).toBe(45);
    expect(m.tiers.weak).toBe(45);
    // Exactly the „procură 1762" pair, which is one instrument transcribed with
    // two different years — see §4.
    expect(m.ambiguous).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. The individual rules
// ---------------------------------------------------------------------------

describe("the ranking rules", () => {
  const doc = (over: Partial<InstrumentCandidateDoc>): InstrumentCandidateDoc => ({
    id: "d", code: "DOC00001", title: "t", typeName: null,
    nrDocument: null, dateDocument: null, institutionName: null, isStub: false, ...over,
  });

  it("ranks number + date + type above number + date alone", () => {
    const all  = doc({ id: "all",  code: "DOC00002", nrDocument: "3264", dateDocument: "2007-11-23", typeName: "Contract de vânzare-cumpărare" });
    const some = doc({ id: "some", code: "DOC00001", nrDocument: "3264", dateDocument: "2007-11-23", typeName: "Proces-verbal" });
    const out = rankInstrumentCandidates(
      { nrDocument: "3264", dateDocument: "2007-11-23", typeLabel: "Contract de vânzare-cumpărare", issuer: null },
      [some, all],
    );
    expect(out.map((r) => r.document.id)).toEqual(["all", "some"]);
    expect(out[0].tier).toBe("strong");
    expect(out[1].tier).toBe("fair");
    // …and the winner is second in the input and first by CODE nowhere: the
    // order is the tier, not the array and not the code.
    expect(out[0].document.code > out[1].document.code).toBe(true);
  });

  /**
   * ⚠️ **A DISAGREEMENT IS FATAL — RULE 1 — AND THE COST IS REAL AND MEASURED.**
   * „procură 1762" is cited on the 2016 sale as 07.08.2016 and on the act
   * adițional as 07.08.2015. It is one instrument and one transcription is
   * wrong, and this ranker offers NOTHING for it rather than presenting two
   * instruments as one in the part of the archive that proves a chain of title.
   * The residual is named in the module header: the user links it by hand from
   * the References tab.
   */
  it("offers nothing when the dates disagree, however well the number matches", () => {
    const only2015 = doc({ id: "p2015", nrDocument: "1762", dateDocument: "2015-08-07", typeName: "Procură", institutionName: "Marius Petcu" });
    const out = rankInstrumentCandidates(
      { nrDocument: "1762", dateDocument: "2016-08-07", typeLabel: "Procură", issuer: "Marius Petcu" },
      [only2015],
    );
    expect(out).toEqual([]);
  });

  it("offers no candidate for a bare common number with nothing else to go on", () => {
    const noise = [1, 2, 3, 4, 5].map((i) =>
      doc({ id: `n${i}`, code: `DOC9000${i}`, nrDocument: "10", typeName: "Proces-verbal" }),
    );
    expect(rankInstrumentCandidates({ nrDocument: "10", dateDocument: null, typeLabel: null, issuer: null }, noise)).toEqual([]);
    // …while a LONG number with just as little to go on still is a candidate:
    // the rule is about the number being common, not about having little else.
    const long = [doc({ id: "l", nrDocument: "65106" })];
    expect(rankInstrumentCandidates({ nrDocument: "65106", dateDocument: null, typeLabel: null, issuer: null }, long)).toHaveLength(1);
  });

  it("still offers a common number once a date agrees, and offers only that one", () => {
    const dated = doc({ id: "right", code: "DOC70001", nrDocument: "10", dateDocument: "2015-02-18", typeName: "Încheiere" });
    const noise = [1, 2, 3].map((i) => doc({ id: `n${i}`, code: `DOC7100${i}`, nrDocument: "10", typeName: "Proces-verbal" }));
    const out = rankInstrumentCandidates(
      { nrDocument: "10", dateDocument: "2015-02-18", typeLabel: "Încheiere de completare", issuer: "BNP Haiduc" },
      [...noise, dated],
    );
    expect(out.map((r) => r.document.id)).toEqual(["right"]);
    expect(out[0].tier).toBe("fair");
  });

  /**
   * The stub rule's load-bearing half: a second deed citing the same titlu de
   * proprietate is OFFERED the first deed's stub rather than being left to mint
   * a second one. If this ever stops being true, thirty-two deeds citing five
   * instruments each become a hundred and sixty ghost documents.
   */
  it("offers an existing stub to the next deed citing the same instrument", () => {
    const stub = doc({
      id: "stub", code: "DOC80001", isStub: true,
      title: "Titlu de proprietate · nr. 64338 · 1996-05-14 (schiță, citat în DOC00042)",
      typeName: "Titlu de Proprietate", nrDocument: "64338", dateDocument: "1996-05-14",
    });
    const out = rankInstrumentCandidates(
      { nrDocument: "64338", dateDocument: "1996-05-14", typeLabel: "Titlu de proprietate", issuer: "CJSDPT Giurgiu" },
      [stub],
    );
    expect(out).toHaveLength(1);
    expect(out[0].document.isStub).toBe(true);
    expect(out[0].tier).toBe("strong");
    expect(out[0].matched).toEqual(["number", "date", "type"]);
    // The archive row has no institution, so the issuer could not be compared —
    // which is „missing", not „disagrees", and the screen says so.
    expect(out[0].missing).toEqual(["issuer"]);
  });

  it("puts a real document ahead of a stub at the same tier", () => {
    const stub = doc({ id: "s", code: "DOC80001", isStub: true,  typeName: "Titlu de Proprietate", nrDocument: "64338", dateDocument: "1996-05-14" });
    const real = doc({ id: "r", code: "DOC80002", isStub: false, typeName: "Titlu de Proprietate", nrDocument: "64338", dateDocument: "1996-05-14" });
    const out = rankInstrumentCandidates(
      { nrDocument: "64338", dateDocument: "1996-05-14", typeLabel: "Titlu de Proprietate", issuer: null },
      [stub, real],
    );
    expect(out.map((r) => r.document.id)).toEqual(["r", "s"]);
  });
});

// ---------------------------------------------------------------------------
// 5. Direction — the same role, read in opposite senses
// ---------------------------------------------------------------------------

describe("linkDirection", () => {
  /**
   * ⚠️ **THE WHOLE DEFECT #36.03 FIXES, IN ONE TEST.** The relationship is
   * identical in both cases — a deed and the titlu its seller's right came from
   * — and the uuid order is the only difference. The stored flag must absorb
   * that difference entirely, so the role reads the same way round both times.
   * If the flag ever stopped flipping, „Titlu anterior al" would mean its own
   * opposite on roughly half the archive, silently.
   */
  it("flips the stored flag so one relationship reads the same way in both uuid orders", () => {
    const deedFirst  = linkDirection("aaaa", "bbbb", "TITLE_CHAIN"); // deed sorts first
    const deedSecond = linkDirection("zzzz", "bbbb", "TITLE_CHAIN"); // deed sorts second

    expect(deedFirst.documentIdA).toBe("aaaa");
    expect(deedFirst.roleReadsAToB).toBe(false);   // the titlu is B, and it is the "from"
    expect(deedSecond.documentIdA).toBe("bbbb");
    expect(deedSecond.roleReadsAToB).toBe(true);   // the titlu is A, and it is the "from"

    // Resolved back to the sentence, both say the same thing: the cited
    // instrument points at the deed.
    const fromOf = (d: { documentIdA: string; documentIdB: string; roleReadsAToB: boolean }) =>
      d.roleReadsAToB ? d.documentIdA : d.documentIdB;
    expect(fromOf(deedFirst)).toBe("bbbb");
    expect(fromOf(deedSecond)).toBe("bbbb");
  });

  it("points PARENT the other way, because an act adițional is the dependent one", () => {
    // Every other purpose names something the deed leans on; PARENT names the
    // thing the deed is attached to.
    expect(PURPOSE_READS_CITED_TO_CITING.PARENT).toBe(false);
    const d = linkDirection("aaaa", "bbbb", "PARENT");
    expect(d.roleReadsAToB).toBe(true);            // the act adițional is A, and it is the "from"
  });

  it("always satisfies the CHECK the table carries", () => {
    for (const p of INSTRUMENT_PURPOSES) {
      for (const [citing, cited] of [["aaaa", "bbbb"], ["zzzz", "bbbb"]] as const) {
        const d = linkDirection(citing, cited, p);
        expect(d.documentIdA < d.documentIdB).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Sanitising the model's answer
// ---------------------------------------------------------------------------

describe("sanitizeExtractedInstrument", () => {
  /**
   * ⚠️ **A MODEL MUST NOT BE ABLE TO CLAIM A LINK NOBODY MADE.** `status` and
   * `linkedDocumentId` are FORCED on this path, whatever the answer contains —
   * only `parseReferencedInstruments`, which reads the column the ROUTE wrote
   * after a person pressed a button, keeps them.
   */
  it("forces PENDING however confident the model's answer is", () => {
    const out = sanitizeExtractedInstrument({
      rawText: "…în baza titlului 65106/11.06.1996…",
      status: "LINKED",
      linkedDocumentId: "00000000-0000-0000-0000-000000000000",
    });
    expect(out?.status).toBe("PENDING");
    expect(out?.linkedDocumentId).toBeNull();
  });

  it("keeps a citation with nothing but its wording, because „lasă” is its answer", () => {
    const out = sanitizeExtractedInstrument({ rawText: "titlul de proprietate al autoarei" });
    expect(out).not.toBeNull();
    expect(out?.nrDocument).toBeNull();
    expect(out?.dateDocument).toBeNull();
  });

  it("drops an entry with no wording at all, which is not a citation", () => {
    expect(sanitizeExtractedInstrument({ nrDocument: "3264" })).toBeNull();
    expect(sanitizeExtractedInstrument({ rawText: "   " })).toBeNull();
    expect(sanitizeExtractedInstrument(null)).toBeNull();
    expect(sanitizeExtractedInstrument(["3264"])).toBeNull();
  });

  it("refuses a date that is not a real ISO date", () => {
    const bad = (d: unknown) => sanitizeExtractedInstrument({ rawText: "x", dateDocument: d })?.dateDocument;
    expect(bad("2006-02-31")).toBeNull();   // does not exist
    expect(bad("11.06.1996")).toBeNull();   // not ISO
    expect(bad("2006-13-01")).toBeNull();
    expect(bad("1996-06-11")).toBe("1996-06-11");
  });

  it("refuses a purpose outside the closed list", () => {
    expect(sanitizeExtractedInstrument({ rawText: "x", purpose: "MORTGAGE" })?.purpose).toBeNull();
    expect(sanitizeExtractedInstrument({ rawText: "x", purpose: "TITLE_CHAIN" })?.purpose).toBe("TITLE_CHAIN");
  });

  it("keeps a stored status through parseReferencedInstruments, where the route wrote it", () => {
    const parsed = parseReferencedInstruments([
      { rawText: "x", status: "LINKED", linkedDocumentId: "abc" },
      { rawText: "y", status: "LEFT",   linkedDocumentId: "ignored" },
      { rawText: "z", status: "NONSENSE" },
    ]);
    expect(parsed.map((p) => p.status)).toEqual(["LINKED", "LEFT", "PENDING"]);
    expect(parsed[0].linkedDocumentId).toBe("abc");
    // LEFT is not a link, so it carries no document even when one is supplied.
    expect(parsed[1].linkedDocumentId).toBeNull();
  });

  it("answers [] for a column that is not an array", () => {
    expect(parseReferencedInstruments(null)).toEqual([]);
    expect(parseReferencedInstruments({ rawText: "x" })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. The migration, the schema declaration and the seed must agree
// ---------------------------------------------------------------------------

describe("migration_086 and the code that has to match it", () => {
  const MIGRATION = "src/db/migration_086_document_reference_direction.sql";

  /**
   * ⚠️ **READ THE SQL WITHOUT ITS COMMENTS.** migration_086's header ARGUES at
   * length about the reshape it declines — it names `from`/`to` and says why
   * the CHECK stays — so a guard written against the raw file matches the
   * sentence explaining the absence and reports the change as present. The same
   * trap bit `person-document-multi-role.test.ts` one slice earlier.
   */
  const sqlBody = read(MIGRATION)
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");

  it("adds the direction flag NOT NULL with a default, so no reader has a third state", () => {
    expect(sqlBody).toMatch(/role_reads_a_to_b\s+boolean\s+NOT NULL\s+DEFAULT true/i);
  });

  /**
   * ⚠️ **THE FIRST DRAFT OF THIS GUARD FAILED ON THE FILE IT WAS MEANT TO
   * PASS, AND THE REASON IS WORTH KEEPING.** It asserted the SQL never mentions
   * `document_document_order` at all — and migration_086's `COMMENT ON COLUMN`
   * text NAMES that constraint, on purpose, to explain why the column exists.
   * A `COMMENT ON` body is a string literal, not a `--` comment, so stripping
   * comment lines does not remove it and never should.
   *
   * So the guard asks what it actually means: nothing here DROPS, ALTERS or
   * RENAMES the index or the CHECK. Talking about them is the file doing its
   * job.
   */
  it("leaves the unique index and the CHECK alone", () => {
    expect(sqlBody).not.toMatch(/DROP\s+INDEX/i);
    expect(sqlBody).not.toMatch(/DROP\s+CONSTRAINT/i);
    expect(sqlBody).not.toMatch(/ADD\s+CONSTRAINT/i);
    expect(sqlBody).not.toMatch(/RENAME\s+(COLUMN|TO)/i);
    expect(sqlBody).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX/i);
  });

  it("counts the existing rows before it changes anything", () => {
    const beforeAlter = sqlBody.slice(0, sqlBody.search(/ALTER TABLE document_document/i));
    expect(beforeAlter).toMatch(/count\(\*\)/i);
    expect(beforeAlter).toMatch(/document_document/i);
  });

  it("adds the reading column, which is the one this slice persists", () => {
    expect(sqlBody).toMatch(/referenced_instruments\s+jsonb/i);
  });

  /**
   * ⚠️ **PER-ROW, BECAUSE migration_055's OWN INSERT IS A NO-OP ON A NON-EMPTY
   * TABLE.** Copying its `WHERE NOT EXISTS (SELECT 1 FROM … LIMIT 1)` guard
   * would seed nothing on every database that has ever run it — which is all of
   * them. This is the one shape of mistake that would look completely fine in
   * review and ship four roles that never appear.
   */
  it("seeds the four roles per row, not behind a whole-table guard", () => {
    expect(sqlBody).not.toMatch(/WHERE NOT EXISTS\s*\(\s*SELECT 1 FROM lookup_document_document_role\s+LIMIT 1\s*\)/i);
    expect(sqlBody).toMatch(/FOR i IN 1 \.\. array_length/i);
  });

  it("declares both columns in the drizzle schema", () => {
    const schema = read("src/db/schema/index.ts");
    expect(schema).toContain('boolean("role_reads_a_to_b").notNull().default(true)');
    expect(schema).toContain('jsonb("referenced_instruments")');
  });

  it("names the same four roles, with the same sort orders, in the migration and the rebuild seed", () => {
    const seed = read("src/db/sync-reference-data.sql");
    const rows: [string, number][] = [
      ["Titlu anterior al", 9],
      ["Înscris doveditor pentru", 10],
      ["Act adițional la", 11],
      ["Antecontract al", 12],
    ];
    for (const [name, order] of rows) {
      expect(read(MIGRATION)).toContain(`'${name}'`);
      expect(seed).toContain(`'${name}'`);
      // ⚠️ The sort_order has to agree on BOTH sides: verify-rebuild.ts compares
      // reference rows as whole tuples, so one row with two different orders is
      // two differences, not one agreement.
      expect(read(MIGRATION)).toMatch(new RegExp(`'${name}'[^\\n]*'${order}'`));
      expect(seed).toMatch(new RegExp(`'${name}'[^\\n]*,\\s*${order}\\)`));
    }
  });

  /**
   * The role names are also a CODE constant, because the route resolves a
   * purpose to a role by name. Three copies that must agree; this is what
   * notices when one of them moves.
   */
  it("agrees with PURPOSE_ROLE_NAME", () => {
    expect(Object.values(PURPOSE_ROLE_NAME).sort()).toEqual(
      ["Act adițional la", "Antecontract al", "Titlu anterior al", "Înscris doveditor pentru"].sort(),
    );
    for (const name of Object.values(PURPOSE_ROLE_NAME)) {
      expect(read(MIGRATION)).toContain(`'${name}'`);
      expect(read("src/db/sync-reference-data.sql")).toContain(`'${name}'`);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. The prompt, and the route that must not write
// ---------------------------------------------------------------------------

describe("the extraction prompt and the route", () => {
  const prompts = read("src/lib/import/classify-prompts.ts");
  const route = read("src/app/api/documents/[id]/ai-interpret/route.ts");

  it("asks for referencedInstruments with all four purposes", () => {
    expect(prompts).toContain('"referencedInstruments"');
    for (const p of INSTRUMENT_PURPOSES) expect(prompts).toContain(p);
  });

  it("tells the model not to name the document itself", () => {
    expect(prompts).toMatch(/NEVER an entry for THIS document itself/);
  });

  it("whitelists the returned type key through the same door as suggestedTypeKey", () => {
    expect(route).toMatch(/typeKey: canonicalTypeKey\(clean\.typeKey\)/);
  });

  /**
   * ⚠️ **THE `parties[]` CONTRACT, PINNED.** This route extracts and reports;
   * every association in the archive was confirmed by a person. A later slice
   * that "helpfully" auto-links a strong match would be reintroducing exactly
   * what this slice refused, and the refusal is only a comment unless something
   * checks it.
   */
  it("never writes an association from the reading itself", () => {
    expect(route).not.toContain("associateDocumentToDocument");
    expect(route).not.toContain("createInstrumentStub");
  });
});

// ---------------------------------------------------------------------------
// 9. Every sentence exists in both locales
// ---------------------------------------------------------------------------

describe("copy", () => {
  const LINKER_KEYS = [
    "title", "subtitle", "close", "rawTextLabel", "unnamedInstrument", "printedNumber",
    "purposeUnknown", "reasonMatched", "reasonMissing", "candidatesTitle", "noCandidates",
    "noCandidatesBody", "isStub", "link", "leave", "stub", "stubTitle", "stubWarning",
    "stubType", "stubTypePlaceholder", "stubConfirm", "stubCancel",
    "alreadyAssociated", "alreadyAssociatedAs", "roleMissing", "noPurpose",
    "referenceGone", "selfReference", "saveError",
    "purpose.TITLE_CHAIN", "purpose.SUPPORTING", "purpose.PARENT", "purpose.PROMISE",
    "signal.number", "signal.date", "signal.type", "signal.issuer",
  ];

  const REFERENCES_KEYS = [
    "roleForward", "roleBackward", "instrumentsTitle", "instrumentsNeverRead",
    "instrumentsAllAnswered", "instrumentsPending", "openLinker", "reread", "rereading",
    "rereadCost", "rereadConfirm", "rereadBusy", "rereadNoPages", "rereadNotConfigured",
    "rereadError",
  ];

  it.each(LOCALES)("%s has every reference-linker sentence", (locale) => {
    const m = messages(locale);
    for (const k of LINKER_KEYS) {
      expect(typeof at(m, `document.aiReferenceLinker.${k}`)).toBe("string");
    }
    for (const k of REFERENCES_KEYS) {
      expect(typeof at(m, `document.references.${k}`)).toBe("string");
    }
    expect(typeof at(m, "document.associateReference.alreadyAssociated")).toBe("string");
  });

  /**
   * ⚠️ **`DEFAULT_LOCALE` IS `ro-RO`, so a missing key renders as a raw key
   * path in the SHIPPING locale** — not in a fallback nobody sees. And the
   * Romanian is written with diacritics, which is what every other sentence in
   * this archive carries; a suite that only checked presence would pass over
   * „Inscris doveditor" and „Antecontract al" sitting side by side.
   */
  it("writes the Romanian with diacritics", () => {
    const ro = messages("ro-RO");
    expect(at(ro, "document.aiReferenceLinker.purpose.TITLE_CHAIN")).toMatch(/[ăâîșț]/i);
    expect(at(ro, "document.aiReferenceLinker.stubWarning")).toMatch(/[ăâîșț]/i);
    expect(at(ro, "document.references.instrumentsTitle")).toMatch(/[ăâîșț]/i);
  });

  /**
   * The interpolation arguments each sentence must carry. A key whose
   * placeholder is renamed compiles, renders, and shows „{roleName}" to
   * Ciprian.
   */
  it.each(LOCALES)("%s keeps the interpolation arguments the components pass", (locale) => {
    const m = messages(locale);
    const has = (keyPath: string, arg: string) =>
      expect(String(at(m, keyPath))).toContain(`{${arg}`);
    has("document.aiReferenceLinker.subtitle", "current");
    has("document.aiReferenceLinker.subtitle", "total");
    has("document.aiReferenceLinker.printedNumber", "nr");
    has("document.aiReferenceLinker.reasonMatched", "signals");
    has("document.aiReferenceLinker.reasonMissing", "signals");
    has("document.aiReferenceLinker.alreadyAssociatedAs", "roleName");
    has("document.aiReferenceLinker.roleMissing", "roleName");
    has("document.references.roleForward", "role");
    has("document.references.roleForward", "other");
    has("document.references.roleBackward", "role");
    has("document.references.roleBackward", "other");
    has("document.references.instrumentsPending", "count");
    has("document.references.instrumentsAllAnswered", "total");
    has("document.associateReference.alreadyAssociated", "documents");
  });

  /**
   * ⚠️ **LITERAL KEYS, NOT `t(`purpose.${p}`)`, AND THIS IS THE GUARD THAT
   * MAKES IT STICK.** Several copy suites in this repo find a component's keys
   * by reading its SOURCE, so a template literal is invisible to them and ships
   * a missing translation nothing catches. `ai-party-linker-dialog.tsx` spells
   * its `cotaMod` labels out for the same reason.
   */
  it("uses literal message keys in the linker dialog", () => {
    const dialog = read("src/app/documents/_components/ai-reference-linker-dialog.tsx");
    for (const p of INSTRUMENT_PURPOSES) expect(dialog).toContain(`t("purpose.${p}")`);
    for (const s of ["number", "date", "type", "issuer"]) expect(dialog).toContain(`t("signal.${s}")`);
    // No dynamic key anywhere in the file — comments are stripped first, since
    // the ⚠️ paragraph above quotes the very pattern it forbids.
    const body = dialog.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(body).not.toMatch(/\bt\(`/);
  });
});

// ---------------------------------------------------------------------------
// 10. The write path answers instead of swallowing
// ---------------------------------------------------------------------------

describe("the already-associated answer", () => {
  const queries = read("src/lib/documents/queries.ts");

  /**
   * ⚠️ **THE SAME DEFECT #36.02 FIXED ON `person_document`, ONE TABLE OVER.**
   * `.onConflictDoNothing()` over a unique index on the PAIR meant that linking
   * two already-linked documents did nothing, successfully and silently,
   * including when the user's whole reason for pressing the button was to change
   * the role. These guards read CODE and not comments, because the header of
   * that function explains the old behaviour in the words a lazy guard would
   * match.
   */
  const body = queries.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("reports what it wrote rather than returning void", () => {
    expect(body).toMatch(/associateDocumentToDocument[\s\S]{0,400}Promise<DocumentAssociationResult>/);
    expect(body).toContain(".returning({ documentIdA: documentDocument.documentIdA");
  });

  it("names the role an already-linked pair carries", () => {
    expect(body).toMatch(/alreadyLinked/);
    expect(body).toMatch(/roleName/);
  });

  it("refuses a direction alongside several targets, because the sort lands per pair", () => {
    expect(body).toMatch(/roleReadsAToB !== undefined && targets\.length !== 1/);
  });

  it("resolves the direction for the viewer rather than leaking the uuid order to a screen", () => {
    expect(body).toContain("roleReadsFromViewed");
    const tab = read("src/app/documents/_components/document-references-tab.tsx");
    const tabBody = tab.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(tabBody).toContain("roleReadsFromViewed");
    // The component must never compare ids itself — that is the defect the flag
    // closes, arriving through a different door.
    expect(tabBody).not.toMatch(/documentIdA|documentIdB/);
  });

  it("renders the role as a sentence with a direction, not as a bare label", () => {
    const tab = read("src/app/documents/_components/document-references-tab.tsx");
    expect(tab).toContain('t("roleForward"');
    expect(tab).toContain('t("roleBackward"');
  });
});

// ---------------------------------------------------------------------------
// 11. The re-read is a button, never a sweep
// ---------------------------------------------------------------------------

describe("the per-document re-read", () => {
  /**
   * ⚠️ **A MIGRATION THAT RE-READ THREE HUNDRED DOCUMENTS WOULD BE A BILL AND
   * AN OUTAGE**, and this project has a written rule about that shape of
   * mistake. Every read is a billed vision call over every page;
   * `src/lib/rate-limit/ocr.ts` caps six routes from one shared bucket. So the
   * re-read is a button on one document, and the migration touches no page.
   */
  it("is not in the migration", () => {
    const sql = read("src/db/migration_086_document_reference_direction.sql");
    expect(sql).not.toMatch(/ai-interpret|anthropic|document_page/i);
  });

  it("says what it costs where the button is", () => {
    const tab = read("src/app/documents/_components/document-references-tab.tsx");
    expect(tab).toContain('t("rereadCost")');
    expect(tab).toContain('t("rereadConfirm")');
    for (const locale of LOCALES) {
      // The sentence has to mention the per-minute allowance, which is the half
      // a user can act on — „it costs money" tells them nothing they can do.
      expect(String(at(messages(locale), "document.references.rereadCost"))).toMatch(/minut|minute/i);
    }
  });

  it("stores [] rather than leaving the column NULL when a read finds nothing", () => {
    const tab = read("src/app/documents/_components/document-references-tab.tsx");
    expect(tab).toContain("payload.referencedInstruments ?? []");
  });
});
