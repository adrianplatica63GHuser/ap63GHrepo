/**
 * Discovery → a document type's custom form.   (Slice #26.11)
 *
 * The module under test is the whole of this slice's judgement: everything
 * else is plumbing that already existed. Four things are worth pinning.
 *
 * 1. **A STORED KEY IS PERMANENT.** `.claude/skills/onboard-document-type/`
 *    documents `key` as camelCase and "permanent once real data exists under
 *    it — renaming means a migration to move data". This module invents
 *    snake_case slugs, so both conventions coexist on one type: an existing
 *    key must come out byte-for-byte, and `pretTotal` must be recognised as
 *    the same field as a discovered `pret_total` rather than added beside it.
 *    Get either half wrong and every value already captured under that key is
 *    still in `document.custom_fields` and unreachable from the form.
 *
 * 2. **Keys must be stable and ASCII.** "Preț" and "Preţ" — the comma-below
 *    and cedilla forms, mixed freely across Romanian scans and fonts — must
 *    not become two fields.
 *
 * 3. **Nothing may carry a newline into the prompt.** buildExtractSystemPrompt
 *    renders each template field as ONE `//` comment line inside the JSON
 *    shape it shows the model. A label or hint with a line break in it splits
 *    that line and corrupts the shape. The prompt describe below asserts that
 *    against the real prompt builder rather than against a rule restated here.
 *
 * 4. **Accepting a discovery is additive.** A type that already has a curated
 *    form must gain fields and lose none — that is what makes the button safe
 *    to press on a type that already works.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  buildFieldHint,
  collapseWhitespace,
  capturedFieldNames,
  keysForReviewRows,
  looksLikeSentenceFragment,
  MAX_KEY_LENGTH,
  nameTooLongForKey,
  reviewRowIssues,
  rowName,
  seedReviewRows,
  formValueForField,
  inferFieldType,
  MAX_TEMPLATE_FIELDS,
  mergeAcceptedFields,
  normaliseKeyForComparison,
  proposeTemplateFields,
  sanitizeTemplateField,
  slugifyFieldKey,
  uniqueFieldKey,
} from "@/lib/documents/discover-to-template";
import { parseTemplateFields, type DocumentTemplateField } from "@/lib/documents/template-fields";
import { buildExtractSystemPrompt } from "@/lib/import/classify-prompts";
import type { DiscoverPair } from "@/lib/documents/discover-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pair(
  name: string,
  value: string,
  confidence: DiscoverPair["confidence"] = "high",
): DiscoverPair {
  return { name, value, confidence };
}

function field(over: Partial<DocumentTemplateField> = {}): DocumentTemplateField {
  return {
    key:     "camp",
    labelRo: "Câmp",
    labelEn: "Field",
    type:    "text",
    order:   0,
    aiHint:  null,
    groupRo: null,
    groupEn: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// slugifyFieldKey
// ---------------------------------------------------------------------------

describe("slugifyFieldKey", () => {
  it("folds Romanian diacritics to ASCII", () => {
    expect(slugifyFieldKey("Preț total")).toBe("pret_total");
    expect(slugifyFieldKey("Suprafață măsurată")).toBe("suprafata_masurata");
    expect(slugifyFieldKey("Încheiere de autentificare")).toBe("incheiere_de_autentificare");
  });

  it("treats the comma-below and cedilla forms as the same letter", () => {
    expect(slugifyFieldKey("Preţ")).toBe(slugifyFieldKey("Preț"));
    expect(slugifyFieldKey("Adresă imobil şi vecinătăţi")).toBe(
      slugifyFieldKey("Adresă imobil și vecinătăți"),
    );
  });

  it("collapses punctuation and trims separators", () => {
    expect(slugifyFieldKey("Nr. / dată document:")).toBe("nr_data_document");
    expect(slugifyFieldKey("   spaced   out   ")).toBe("spaced_out");
    expect(slugifyFieldKey("(C.F.)")).toBe("c_f");
  });

  it("never returns an empty key", () => {
    expect(slugifyFieldKey("")).toBe("camp");
    expect(slugifyFieldKey("§ — ///")).toBe("camp");
    expect(slugifyFieldKey("...")).toBe("camp");
  });

  it("clips a long label without leaving a trailing separator", () => {
    const key = slugifyFieldKey(
      "Denumirea completă a imobilului situat în intravilanul localității conform actelor",
    );
    expect(key.length).toBeLessThanOrEqual(40);
    expect(key.endsWith("_")).toBe(false);
    expect(key).toMatch(/^[a-z0-9_]+$/);
  });

  it("emits only characters that are safe in a JSON key and a form field name", () => {
    for (const label of ["Preț (RON)", "50%", "Ștampilă & semnătură", "A\nB"]) {
      expect(slugifyFieldKey(label)).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// normaliseKeyForComparison
// ---------------------------------------------------------------------------

describe("normaliseKeyForComparison", () => {
  it("makes the project's camelCase convention and this module's slug meet", () => {
    expect(normaliseKeyForComparison("pretTotal")).toBe(normaliseKeyForComparison("pret_total"));
    expect(normaliseKeyForComparison("nrCadastral")).toBe(normaliseKeyForComparison("nr_cadastral"));
  });

  it("does not collapse genuinely different keys", () => {
    expect(normaliseKeyForComparison("pretTotal")).not.toBe(normaliseKeyForComparison("pretPartial"));
  });
});

// ---------------------------------------------------------------------------
// uniqueFieldKey
// ---------------------------------------------------------------------------

describe("uniqueFieldKey", () => {
  it("returns the key untouched when it is free, and records it", () => {
    const taken = new Set<string>();
    expect(uniqueFieldKey("pret", taken)).toBe("pret");
    expect(taken.has("pret")).toBe(true);
  });

  it("suffixes collisions in order", () => {
    const taken = new Set(["pret"]);
    expect(uniqueFieldKey("pret", taken)).toBe("pret_2");
    expect(uniqueFieldKey("pret", taken)).toBe("pret_3");
  });

  it("collides across naming conventions, not just across identical strings", () => {
    // The stored key is camelCase; the proposal is a slug. Handing back
    // `pret_total` would put a second field beside `pretTotal` for one thing.
    const taken = new Set([normaliseKeyForComparison("pretTotal")]);
    expect(uniqueFieldKey("pret_total", taken)).toBe("pret_total_2");
  });

  it("shortens the base so a suffixed key still fits the limit", () => {
    const long = "a".repeat(40);
    const taken = new Set([long]);
    const next = uniqueFieldKey(long, taken);
    expect(next.length).toBeLessThanOrEqual(40);
    expect(next).not.toBe(long);
    expect(next.endsWith("_2")).toBe(true);
  });

  it("never hands out a key that is already taken", () => {
    const taken = new Set<string>();
    const issued = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const k = uniqueFieldKey("pret", taken);
      expect(issued.has(k)).toBe(false);
      issued.add(k);
    }
  });
});

// ---------------------------------------------------------------------------
// inferFieldType
// ---------------------------------------------------------------------------

describe("inferFieldType", () => {
  it("recognises ISO and Romanian dates", () => {
    expect(inferFieldType("2024-03-17")).toBe("date");
    expect(inferFieldType("17.03.2024")).toBe("date");
    expect(inferFieldType("17/03/2024")).toBe("date");
    expect(inferFieldType("17-03-2024")).toBe("date");
  });

  it("rejects impossible dates rather than proposing a date input for them", () => {
    expect(inferFieldType("2024-13-45")).toBe("text");
    expect(inferFieldType("47.02.2024")).toBe("text");
    expect(inferFieldType("225.3.24")).toBe("text");
  });

  it("asks the calendar, not just the digit ranges", () => {
    // 31 June and 29 February 2023 sit inside every bound and are not dates.
    // <input type="date"> blanks an impossible date string exactly the way it
    // blanks a Romanian-formatted one, so letting one through would store a
    // value the form can never show.
    expect(inferFieldType("31.06.2023")).toBe("text");
    expect(inferFieldType("30.02.2024")).toBe("text");
    expect(inferFieldType("29.02.2023")).toBe("text");
    // …and a real leap day still is one.
    expect(inferFieldType("29.02.2024")).toBe("date");
  });

  it("proposes number only for a dot-separated fraction", () => {
    expect(inferFieldType("1234.56")).toBe("number");
    expect(inferFieldType("0.5")).toBe("number");
    expect(inferFieldType("-12.25")).toBe("number");
  });

  it("leaves a Romanian comma decimal as text", () => {
    // The model is told to keep Romanian separators, nothing between it and
    // the column converts one, and <input type="number"> renders a comma
    // decimal as EMPTY — so the value would be stored, invisible and
    // un-editable, on every document of the type.
    expect(inferFieldType("1234,56")).toBe("text");
    expect(inferFieldType("-12,25")).toBe("text");
  });

  it("leaves identifiers and grouped/united numbers as text", () => {
    expect(inferFieldType("1800101123456")).toBe("text"); // CNP
    expect(inferFieldType("0123")).toBe("text");
    expect(inferFieldType("2716")).toBe("text");
    expect(inferFieldType("125.000")).toBe("text");       // 125 thousand, in RO
    expect(inferFieldType("1.234")).toBe("text");
    expect(inferFieldType("1.234,56 lei")).toBe("text");
    expect(inferFieldType("47/2")).toBe("text");
  });

  it("proposes textarea for prose and for anything with a line break", () => {
    expect(inferFieldType("linia unu\nlinia doi")).toBe("textarea");
    expect(inferFieldType("x".repeat(200))).toBe("textarea");
    expect(inferFieldType("scurt")).toBe("text");
  });

  it("falls back to text for an empty or blank value", () => {
    expect(inferFieldType("")).toBe("text");
    expect(inferFieldType("   ")).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// buildFieldHint — the one-document hint rule                        (#29.10)
// ---------------------------------------------------------------------------

/**
 * The six values F5 found sitting on a shared document type, verbatim from the
 * report.
 *
 * They are the fixtures rather than an illustration because the previous rule
 * was not careless — it masked runs of four or more digits, refused two
 * capitalised words in a row, and capped an example at forty characters, and
 * every one of these passed all three. The cadastral identity of one parcel and
 * the price one property sold for were then in the extraction prompt for every
 * future document of the type, and offered to the model as the answer wherever
 * it could not read the field.
 */
const LEAKED_ONTO_THE_TYPE = [
  "225/3/24",
  "47/2",
  "2.000 mp",
  "4.716 mp (din masuratori 4.716,22 mp)",
  "2.000,00 RON (douamii RON)",
  "O.C.P.I. — Ilfov",
] as const;

describe("buildFieldHint", () => {
  const base = { sampleValue: "", type: "text" } as const;

  it.each(LEAKED_ONTO_THE_TYPE)(
    "refuses %s — the values that passed every guard the old rule had",
    (sample) => {
      for (const type of ["text", "textarea", "date", "number"] as const) {
        expect(buildFieldHint({ ...base, sampleValue: sample, type })).toBeNull();
      }
    },
  );

  it("emits nothing at all from one document, for any value of any type", () => {
    // Not "nothing dangerous" — nothing. What separates a SHAPE ("120 mp") from
    // a piece of CONTENT ("2.000 mp") is not in the string; it is in how many
    // documents printed it, and one document cannot answer that. So the rule is
    // the refusal itself, and a sample that looks harmless is the case most
    // likely to reintroduce the leak.
    for (const sample of ["", "   ", "parter", "120 mp", "RON", "POPESCU ION", "a b"]) {
      for (const type of ["text", "textarea", "date", "number"] as const) {
        expect(buildFieldHint({ sampleValue: sample, type })).toBeNull();
      }
    }
  });

  it("never records the label either, however it was printed", () => {
    // The remaining candidate answer, and the one the many-sample path takes.
    // It is not available here: the case it has to exclude is a caption with a
    // person glued onto it („Notar Public MARIA IONESCU"), and every textual
    // test for that also matches ordinary Romanian captions, which are
    // routinely Title Case or ALL CAPS.
    expect(buildFieldHint({ ...base, sampleValue: "parter" })).toBeNull();
  });

  it("keeps the refusal in the module, not at the call site", () => {
    // The dialog still CALLS it rather than writing `aiHint: null`, so the rule
    // and the six values above have one home. A literal at the call site would
    // leave the next reader to rediscover why.
    const dialog = readFileSync(
      join(process.cwd(), "src", "app", "documents", "_components", "discover-review-dialog.tsx"),
      "utf8",
    );
    expect(dialog).toContain("buildFieldHint");
  });

  it("leaves nothing on the prompt line for a field proposed from one document", () => {
    // End to end, through the real prompt builder: a proposal accepted from a
    // single discovery run contributes a label and a type and no hint.
    const proposals = proposeTemplateFields(
      LEAKED_ONTO_THE_TYPE.map((v, i) => pair(`Câmp ${i}`, v)),
      [],
    );
    const merged = mergeAcceptedFields(
      [],
      proposals.map((p, i) => ({
        key:     p.key,
        labelRo: p.labelRo,
        labelEn: p.labelEn,
        type:    p.type,
        order:   i,
        aiHint:  buildFieldHint({ sampleValue: p.sampleValue, type: p.type }),
        groupRo: null,
        groupEn: null,
      })),
    );
    expect(merged).toHaveLength(LEAKED_ONTO_THE_TYPE.length);
    for (const f of merged) expect(f.aiHint).toBeNull();
    const prompt = buildExtractSystemPrompt(merged, []);
    for (const sample of LEAKED_ONTO_THE_TYPE) {
      expect(prompt).not.toContain(sample);
    }
  });
});

// ---------------------------------------------------------------------------
// looksLikeSentenceFragment                                          (#29.10)
// ---------------------------------------------------------------------------

/**
 * THREE corpora, because the rule has three honest outcomes and a single
 * pass/fail list would hide the middle one.
 *
 * CLAUDE.md: "before claiming a rule, a threshold or a generated value is
 * right, run it over the shape that would embarrass it, and put the measured
 * numbers in the comment." `field-distillation.ts` records what happened the
 * last time a rule in this family was judged on the examples it was written
 * from: over a realistic corpus it missed 47% of what it hunted and deleted 39%
 * of what it did not.
 *
 * ⚠️ **A review round found the first version of this file scoring itself.**
 * The caption corpus contained exactly the two members of the `<participiu> de`
 * family that the comment admitted as false positives and none of the other
 * fourteen — so "2 of 72" was an artefact of the list, not a measurement. That
 * family now has its own corpus and its own assertion, and the number stated in
 * the module is the number this file actually produces.
 */
const REAL_CAPTIONS = [
  "Nr. cadastral", "Carte funciară", "Cotă parte", "Cotă indiviză", "Preț total",
  "Prețul vânzării", "Prețul total al vânzării", "Suprafață",
  "Suprafață construită desfășurată", "Suprafață utilă",
  "Suprafață construită la sol", "Data autentificării", "Obiectul contractului",
  "Mențiuni speciale", "Observații", "Vecinătăți", "Tarla", "Parcela",
  "Notar public", "Vânzător", "Cumpărător", "Serie și număr", "Serie CI",
  "Număr act autentic", "Nr. act autentic", "Locul nașterii", "Data nașterii",
  "Domiciliul", "Adresa imobilului", "Județ", "Localitate", "Strada",
  "Număr poștal", "Bloc", "Scara", "Etaj", "Apartament",
  "Categoria de folosință", "Destinația construcției", "Anul construcției",
  "Regim de înălțime", "Număr cadastral vechi", "Încheiere de autentificare",
  "Taxa de timbru", "Impozit", "Onorariu notarial", "Valoare declarată",
  "Modalitate de plată", "Termen de plată", "Sarcini", "Ipotecă", "Uzufruct",
  "Servitute", "Act de proprietate", "Titlu de proprietate", "Certificat fiscal",
  "Certificat de urbanism", "Autorizație de construire",
  "Proces-verbal de recepție", "Extras de carte funciară",
  "Număr de înregistrare", "Emitent", "Autoritatea emitentă",
  "Semnătura notarului", "Cod numeric personal", "Cetățenie", "Stare civilă",
  "Regim matrimonial", "Data eliberării", "Nr. de ordine",
  // The four a review round caught the first word lists getting wrong: „cui" is
  // the relative pronoun AND Cod Unic de Înregistrare; a bare trailing „a" is
  // the block/stair letter printed on half the addresses in the archive.
  "CUI", "CIF", "Scara A", "Bloc A", "Corp A", "Tronson A", "Cont IBAN",
  "Cod poștal", "Nr. înmatriculare", "Sediul social", "Reprezentant legal",
  "Calitatea semnatarului", "Anexa", "Cota-parte indiviză",
  // ⚠️ Abbreviations that three rounds caught successive word lists getting
  // wrong. Every one is a short Romanian function word doing duty as an acronym.
  "Marcaj CE", "Membru CA", "Decizie CA", "Latura SE", "Vecinătate NE",
  // ⚠️ Six long ones, added after a second review round. A length test folded
  // INTO the fragment rule flagged every one of them with a sentence saying
  // they read like a piece of prose, which is untrue of all six — and the
  // corpus could not see it, because its longest caption slugged to 32.
  "Certificat de atestare fiscală pentru persoane fizice",
  "Număr de înregistrare în registrul comerțului",
  "Numele și prenumele reprezentantului legal",
  "Impozitul pe transferul proprietăților imobiliare",
  "Bunuri comune dobândite în timpul căsătoriei",
  "Extras de carte funciară pentru autentificare",
] as const;

/** Names cut out of the prose around them — F5's four, plus their siblings. */
const SENTENCE_FRAGMENTS = [
  "Suprafața de", "Din totalul de", "Prețul vânzării este de", "Eliberat de",
  "în suprafață de", "care se învecinează cu", "și anume", "situat în",
  "identificat cu", "compus din", "având numărul cadastral", "conform anexei",
  "din care", "la data de", "în valoare de", "cu sediul în", "pentru suma de",
  "asupra imobilului", "precum și", "respectiv", "după cum urmează, și",
  "imobilul este situat în",
] as const;

/**
 * Legitimate captions the rule flags anyway — the price of keeping „de".
 *
 * Romanian prints a whole family of captions as `<participiu> de`, and nothing
 * structural separates „Eliberat de" from „Suprafața de": both are one word
 * plus a preposition. Dropping „de" would lose two of the four names F5
 * actually reported. So this list is the admitted cost, pinned so it cannot
 * grow silently — and the flag is advisory, so on „Semnat de" the advice
 * („rewrite it short") is not even wrong.
 */
const NOISY_PARTICIPLE_FAMILY = [
  "Emis de", "Eliberat de", "Semnat de", "Autentificat de", "Întocmit de",
  "Verificat de", "Aprobat de", "Vizat de", "Avizat de", "Redactat de",
  "Certificat de", "Depus de", "Primit de", "Solicitat de", "Reprezentat prin",
  "Împuternicit prin",
] as const;

/**
 * Fragments the rule cannot see, pinned rather than chased.
 *
 * Both edges are content words and there is no conjugated verb, so nothing in
 * the closed classes the rule reads fires. A fifth rule to catch them would
 * have to READ the words, and that is exactly where the measured disaster
 * recorded in `field-distillation.ts` began. What makes these survivable is
 * that the name is a text box the user is looking at and nothing is written
 * until they press a button.
 */
const KNOWN_MISSES = [
  "imobil situat administrativ",
  "vândut liber de sarcini",
  "proprietatea exclusivă a subsemnatului",
  "denumit în continuare vânzătorul",
  // The article-initial class. `LEADING_FUNCTION_WORDS` deliberately excludes
  // bare articles, because „Al doilea proprietar" is a caption.
  "al cărui",
  "ai căror",
  "ale căror",
] as const;

describe("looksLikeSentenceFragment", () => {
  it("flags every fragment in the corpus", () => {
    expect(SENTENCE_FRAGMENTS.filter((f) => !looksLikeSentenceFragment(f))).toEqual([]);
    expect(SENTENCE_FRAGMENTS).toHaveLength(22);
  });

  it("leaves every real caption alone", () => {
    // The number the module's comment states. If it moves, that comment is a
    // claim nobody checked — re-measure and rewrite it.
    expect(REAL_CAPTIONS.filter(looksLikeSentenceFragment)).toEqual([]);
    expect(REAL_CAPTIONS).toHaveLength(95);
  });

  it("flags a two-token clause whose first word is a clitic", () => {
    // ⚠️ `tokens.slice(1, -1)` is EMPTY on two tokens, so the middle-verb test
    // cannot see „se aplică" / „am primit" / „va cuprinde" — a review round
    // found the whole clitic-initial class sailing through. No Romanian caption
    // opens on a clitic, so they went into the leading set.
    for (const f of ["se aplică", "am primit", "va cuprinde", "au semnat", "se obligă"]) {
      expect(looksLikeSentenceFragment(f)).toBe(true);
    }
  });

  it("flags the whole participle family, and that is the admitted price", () => {
    expect(NOISY_PARTICIPLE_FAMILY.filter((f) => !looksLikeSentenceFragment(f))).toEqual([]);
    expect(NOISY_PARTICIPLE_FAMILY).toHaveLength(16);
  });

  it("still misses exactly the seven fragments the module names", () => {
    // Pinned in BOTH directions. A change that starts catching one of these is
    // welcome, but it is a change to the measured claim and must rewrite it.
    expect(KNOWN_MISSES.filter(looksLikeSentenceFragment)).toEqual([]);
    // Pinned like the other three corpora. A fifth round found this one had no
    // length assertion, so an eighth entry would silently re-open the count
    // drift the module header was corrected for.
    expect(KNOWN_MISSES).toHaveLength(7);
  });

  it("catches a clause whose edges are nouns, by its verb", () => {
    // The third test. „a fost achitat integral" and „urmează a se plăti" open
    // and close on content words; what gives them away is the conjugated verb
    // in the middle.
    expect(looksLikeSentenceFragment("suma a fost achitat integral")).toBe(true);
    expect(looksLikeSentenceFragment("prețul se plătește integral")).toBe(true);
    // …and a caption with no verb in it is left alone, whatever its length.
    expect(looksLikeSentenceFragment("Suprafață construită desfășurată")).toBe(false);
  });

  it("reads the same spelling the key reads", () => {
    // „Suprafaţă de" (cedilla) and „Suprafață de" (comma-below) are mixed
    // freely across Romanian scans. A rule that folded differently from
    // slugifyFieldKey would flag one and not the other, on one document.
    expect(looksLikeSentenceFragment("Suprafaţă de")).toBe(true);
    expect(looksLikeSentenceFragment("Suprafață de")).toBe(true);
    expect(looksLikeSentenceFragment("Preţul vânzării")).toBe(false);
    expect(looksLikeSentenceFragment("Prețul vânzării")).toBe(false);
  });

  it("says nothing about an empty name", () => {
    // The empty name has its own guard, with its own message. Two different
    // complaints on one row is a puzzle.
    expect(looksLikeSentenceFragment("")).toBe(false);
    expect(looksLikeSentenceFragment("   ")).toBe(false);
  });

  it("says nothing about length — that is a different complaint", () => {
    // ⚠️ The split a second review round forced. Six ordinary captions in the
    // corpus above are longer than a key, and none of them reads like prose.
    const long = "Certificat de atestare fiscală pentru persoane fizice";
    expect(looksLikeSentenceFragment(long)).toBe(false);
    expect(nameTooLongForKey(long)).toBe(true);
  });

  it("leaves the abbreviations three rounds of word lists got wrong", () => {
    // CE, CA, SE, CUI and a bare block letter are all short Romanian function
    // words doing duty as acronyms. Each one shipped in a word list, fired on a
    // real caption, and fired on none of the pinned fragments.
    for (const c of ["Marcaj CE", "Membru CA", "Latura SE", "CUI", "Scara A"]) {
      expect(looksLikeSentenceFragment(c)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// nameTooLongForKey                                                  (#29.10)
// ---------------------------------------------------------------------------

describe("nameTooLongForKey", () => {
  it("catches F5's truncated-mid-word names, at the length keys are cut", () => {
    // A caption may run to 60 characters; a key is cut at 40. Every name in
    // that gap was truncated mid-word in silence, which is F5's complaint
    // verbatim, and the caption-length rule alone could not see it.
    const long = "Suprafața construită desfășurată a imobilului din acte";
    expect(slugifyFieldKey(long).length).toBe(MAX_KEY_LENGTH);
    expect(nameTooLongForKey(long)).toBe(true);
  });

  it("flags exactly the six long captions in the corpus and nothing else", () => {
    // Measured, and pinned in both directions: the short captions must stay
    // clean or the warning becomes wallpaper.
    const flagged = REAL_CAPTIONS.filter(nameTooLongForKey);
    expect(flagged).toHaveLength(6);
    expect(flagged.every((c) => c.length > MAX_KEY_LENGTH)).toBe(true);
  });

  it("says nothing about a long string whose KEY is short", () => {
    // ⚠️ A third review round deleted the caption-length half of this rule. A
    // name padded with dotted leaders („Suprafața ......... mp") is 60-odd
    // characters and slugs to `suprafata_mp`, twelve — and the message beside
    // it said the key was being cut at forty in the middle of a word. Two
    // conditions behind one sentence is how a screen comes to say something
    // false.
    const dotted = `Suprafața ${".".repeat(50)} mp`;
    expect(dotted.length).toBeGreaterThan(60);
    expect(slugifyFieldKey(dotted).length).toBeLessThan(MAX_KEY_LENGTH);
    expect(nameTooLongForKey(dotted)).toBe(false);
  });

  it("says nothing about an empty name", () => {
    expect(nameTooLongForKey("")).toBe(false);
    expect(nameTooLongForKey("   ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// keysForReviewRows / reviewRowIssues — the live key                 (#29.10)
// ---------------------------------------------------------------------------

/** The review screen's rows for a set of pairs, as the dialog builds them. */
function rowsFor(
  pairs: readonly DiscoverPair[],
  existing: readonly DocumentTemplateField[] = [],
  captured: readonly string[] = [],
) {
  return seedReviewRows(proposeTemplateFields(pairs, existing, captured));
}

const tick = <T extends { include: boolean }>(rows: T[], ...at: number[]): T[] =>
  rows.map((r, i) => (at.includes(i) ? { ...r, include: true } : r));

const rename = <T extends { label: string }>(rows: T[], at: number, label: string): T[] =>
  rows.map((r, i) => (i === at ? { ...r, label } : r));

/** The captured-name index, built the way the dialog builds it. */
const capturedFor = (
  existing: readonly DocumentTemplateField[] = [],
  roles: readonly string[] = [],
) => capturedFieldNames(existing, roles);

describe("keysForReviewRows", () => {
  it("mints the key the user's rename implies, not the proposal's first guess", () => {
    // The whole point of the change. A row proposed as `pretul_vanzarii_este_de`
    // and renamed to „Preț vânzare" is stored as `pret_vanzare`. Before #29.10
    // the key was frozen at proposal time, so renaming a field was cosmetic and
    // the fragment was what got stored — permanently, under a caption that no
    // longer mentioned it.
    let rows = rowsFor([pair("Prețul vânzării este de", "2.000,00 RON")]);
    expect(rows[0].key).toBe("pretul_vanzarii_este_de");
    rows = rename(tick(rows, 0), 0, "Preț vânzare");
    expect(keysForReviewRows(rows, capturedFor()).get(rows[0].rowId)).toBe("pret_vanzare");
  });

  it("keys nothing that is not ticked", () => {
    // ⚠️ An unticked row must not reserve a name — a later row's key would move
    // when an earlier one was unticked. It also must not DISPLAY one: a review
    // round found the bare-slug fallback showing a key belonging to a stored
    // field until the row was ticked.
    const rows = rowsFor([pair("Preț total", "12"), pair("Tarla", "47/2")]);
    const keys = keysForReviewRows(tick(rows, 1), capturedFor());
    expect(keys.has(rows[0].rowId)).toBe(false);
    expect(keys.get(rows[1].rowId)).toBe("tarla");
  });

  it("does not re-key a row that matches a field the type already has", () => {
    const rows = rowsFor(
      [pair("Preț total", "12")],
      [{ key: "pretTotal", labelRo: "Preț total", labelEn: "Total", type: "text", order: 0, aiHint: null, groupRo: null, groupEn: null }],
    );
    expect(rows[0].alreadyInForm).toBe(true);
    expect(rows[0].key).toBe("pretTotal");
    expect(keysForReviewRows(tick(rows, 0), capturedFor([field({ key: "pretTotal", labelRo: "Preț total" })])).size).toBe(0);
  });

  it("suffixes a NEW row away from a stored key rather than overwriting it", () => {
    const rows = tick(rowsFor([pair("Suprafață", "120 mp")], []), 0);
    expect(keysForReviewRows(rows, capturedFor([field({ key: "suprafata", labelRo: "Suprafață" })])).get(rows[0].rowId)).toBe("suprafata_2");
  });

  it("keeps two rows apart when a document prints one caption twice", () => {
    // ⚠️ The archive's central document. A two-party sale-purchase contract
    // prints „CNP" twice and a dezmembrare prints „Parcela" once per parcel.
    // These are two real fields with one caption, and the module mints
    // `cnp` / `cnp_2` for them on purpose.
    const rows = tick(rowsFor([pair("CNP", "1800101410011"), pair("CNP", "2850505410022")]), 0, 1);
    const keys = keysForReviewRows(rows, capturedFor());
    expect([...keys.values()]).toEqual(["cnp", "cnp_2"]);
  });

  it("walks left to right, so unticking an earlier row frees its name", () => {
    const rows = rowsFor([pair("Suprafață", "10"), pair("Suprafață", "20")]);
    expect([...keysForReviewRows(tick(rows, 0, 1), capturedFor()).values()]).toEqual([
      "suprafata",
      "suprafata_2",
    ]);
    // Only the second ticked: it is the only claimant, so it takes the name.
    expect([...keysForReviewRows(tick(rows, 1), capturedFor()).values()]).toEqual(["suprafata"]);
  });
});

describe("reviewRowIssues", () => {
  it("refuses a ticked row whose name carries no letter or digit", () => {
    // ⚠️ A review round found the first version testing `trim()`, which
    // `proposeTemplateFields` guarantees is never empty — so the guard could
    // not fire at all while a name of „§ —" sailed through it into `camp`.
    // Two of those save as `camp` and `camp_2`, with „camp" as the caption.
    // ⚠️ And a SECOND round found the fallback that made it unfirable: with
    // `rowName` reading `label.trim() || labelRo`, clearing the box stored the
    // field under the caption the user had just deleted. `rowName` has no
    // fallback now — see its comment.
    const emptied = rename(tick(rowsFor([pair("Preț total", "12")]), 0), 0, "   ");
    expect(rowName(emptied[0])).toBe("");
    expect(reviewRowIssues(emptied, capturedFor()).unnamed).toBe(true);
    // …and it is given no key either, so the screen cannot print `camp` under a
    // row whose footer says the name is missing.
    expect(keysForReviewRows(emptied, capturedFor()).size).toBe(0);
    const punctuation = rename(tick(rowsFor([pair("Preț total", "12")]), 0), 0, "§ —");
    expect(reviewRowIssues(punctuation, capturedFor()).unnamed).toBe(true);
    expect(slugifyFieldKey("§ —")).toBe("camp");
  });

  it("says nothing about an unticked row, however it is named", () => {
    const rows = rename(rowsFor([pair("Preț total", "12")]), 0, "");
    expect(reviewRowIssues(rows, capturedFor())).toEqual({ unnamed: false, duplicateOfCaptured: false });
  });

  it("refuses a rename onto a stored field whose caption is longer than a key", () => {
    // ⚠️ **A FOURTH ROUND'S FINDING.** `proposeTemplateFields` and
    // `capturedFieldNames` compare the normalised SLUG, and a slug is clipped
    // at MAX_KEY_LENGTH. This guard compared the raw name, so the two forms
    // diverged for exactly the names longer than a key: retyping a stored
    // field's 53-character caption got a clean bill here while
    // `keysForReviewRows` saw the collision and suffixed around it. A second
    // permanent field with a byte-identical caption.
    const caption = "Certificat de atestare fiscală pentru persoane fizice";
    const stored = [field({ key: "certFiscal", labelRo: caption, labelEn: caption })];
    expect(nameTooLongForKey(caption)).toBe(true);
    const rows = rename(tick(rowsFor([pair("Tarla", "47/2")]), 0), 0, caption);
    expect(reviewRowIssues(rows, capturedFor(stored)).duplicateOfCaptured).toBe(true);
    // ⚠️ **…and a SIBLING caption that shares its first forty slug characters
    // is NOT refused.** A fifth round found the fix for the above asking the
    // question on the CLIPPED slug, which collapsed „…pentru persoane fizice"
    // and „…pentru persoane juridice" into one name and told the user the
    // second was already taken. The clip belongs in `uniqueFieldKey`, deciding
    // what a key is CALLED — not in the relation that decides what a field IS.
    const sibling = "Certificat de atestare fiscală pentru persoane juridice";
    expect(slugifyFieldKey(sibling)).toBe(slugifyFieldKey(caption));
    const siblingRows = rename(tick(rowsFor([pair("Tarla", "47/2")]), 0), 0, sibling);
    expect(reviewRowIssues(siblingRows, capturedFor(stored)).duplicateOfCaptured).toBe(false);
    expect([...keysForReviewRows(siblingRows, capturedFor(stored)).values()]).toEqual([
      "certificat_de_atestare_fiscala_pentru_2",
    ]);
    // …and the same 53-character string read BY DISCOVERY is recognised as the
    // stored field, which is the answer the guard now agrees with rather than
    // contradicting.
    const readIt = rowsFor([pair(caption, "x")], stored);
    expect(readIt[0].alreadyInForm).toBe(true);
    expect(readIt[0].key).toBe("certFiscal");
  });

  it("refuses a rename onto a stored key longer than a key may be minted", () => {
    // A hand-written key can be longer than `MAX_KEY_LENGTH` — this module only
    // ever MINTS at that length, it never rewrites a stored one. The captured
    // index holds such a key unclipped, and a fifth round found the guard
    // unable to reach it while it compared clipped slugs.
    const key = "numarDeInregistrareInRegistrulComertuluiLocal";
    const stored = [field({ key, labelRo: "Cod registru", labelEn: "Registry code" })];
    const rows = rename(
      tick(rowsFor([pair("Tarla", "47/2")]), 0),
      0,
      "Numar De Inregistrare In Registrul Comertului Local",
    );
    expect(key.length).toBeGreaterThan(MAX_KEY_LENGTH);
    expect(reviewRowIssues(rows, capturedFor(stored)).duplicateOfCaptured).toBe(true);
  });

  it("refuses a row RENAMED onto a stored field, by key or by caption", () => {
    const stored = [field({ key: "pretTotal", labelRo: "Preț total", labelEn: "Total price" })];
    const rows = rename(tick(rowsFor([pair("Tarla", "47/2")]), 0), 0, "Preț total");
    expect(reviewRowIssues(rows, capturedFor(stored)).duplicateOfCaptured).toBe(true);
    // Matched on the LABEL as well as the key, so a curated field keyed as an
    // abbreviation („nrAct" for „Nr. act autentic") cannot be duplicated by
    // typing its caption. Both halves come from `capturedFieldNames`.
    const abbrev = [field({ key: "nrAct", labelRo: "Nr. act autentic", labelEn: "Deed no." })];
    const typed = rename(tick(rowsFor([pair("Tarla", "47/2")]), 0), 0, "Nr. act autentic");
    expect(reviewRowIssues(typed, capturedFor(abbrev)).duplicateOfCaptured).toBe(true);
    // …and an unrelated name is fine.
    expect(reviewRowIssues(rows, capturedFor(abbrev)).duplicateOfCaptured).toBe(false);
  });

  it("refuses an UNTOUCHED repeat of a person role or a generic column", () => {
    // ⚠️ **THE THIRD ROUND'S SHARPEST FINDING.** The untouched-name skip above
    // is right for the type's own fields and wrong for everything else, and
    // `proposeTemplateFields` now knows the difference: a document printing
    // „Notar" or „Nr." twice is still one Person link and one document number,
    // so BOTH occurrences are already-captured and neither is offerable. Before
    // this, the second arrived as an untouched, offerable `notar_2` / `nr_2` —
    // permanent double storage reached through the one door the guard could not
    // see, because the row was never renamed.
    const roles = ["Vânzător", "Cumpărător", "Notar"];
    const twice = rowsFor([pair("Notar", "X"), pair("Notar", "Y")], [], roles);
    expect(twice.map((r) => r.alreadyInForm)).toEqual([true, true]);
    const generic = rowsFor([pair("Nr.", "1"), pair("Nr.", "2")]);
    expect(generic.map((r) => r.alreadyInForm)).toEqual([true, true]);
    // …while the type's OWN field keeps the old rule: a deed naming two parties
    // has two CNPs, and the second is a real second field.
    const stored = [field({ key: "cnp", labelRo: "CNP", labelEn: "CNP" })];
    const own = rowsFor([pair("CNP", "1"), pair("CNP", "2")], stored);
    expect(own.map((r) => r.alreadyInForm)).toEqual([true, false]);
  });

  it("refuses a rename onto a person role the import links as a real Person", () => {
    // Captured elsewhere, not in the template. Accepting it would put a second,
    // freely-editable copy of the seller's name on every document of the type —
    // the argument src/lib/import/id-card.ts makes, one layer earlier.
    //
    // ⚠️ A review round found the dialog hand-assembling this set from the
    // stored keys alone, so a rename to „Notar" minted `notar` beside the
    // Person link. Both sides now read `capturedFieldNames`.
    const roles = ["Vânzător", "Cumpărător", "Notar"];
    const rows = rename(tick(rowsFor([pair("Tarla", "47/2")], [], roles), 0), 0, "Notar");
    expect(reviewRowIssues(rows, capturedFor([], roles)).duplicateOfCaptured).toBe(true);
  });

  it("refuses a rename onto a generic column, by its Romanian alias", () => {
    // „Data" is not a template field and not a captured row unless discovery
    // happened to read it — it is an ALIAS for the `dateDocument` column,
    // inside `capturedFieldNames`. A round found a rename to „Data" minting
    // `data` beside the column every import already writes.
    const rows = rename(tick(rowsFor([pair("Tarla", "47/2")]), 0), 0, "Data");
    expect(reviewRowIssues(rows, capturedFor()).duplicateOfCaptured).toBe(true);
  });

  it("does NOT refuse an untouched row whose caption is already captured", () => {
    // ⚠️ **THE SHARPEST OF THE TWO ROUNDS' FINDINGS, AND IT CAME BACK ONCE.**
    // A two-party deed prints „CNP" twice. If the type already holds `cnp`, the
    // FIRST row is already-captured and the SECOND is a genuinely new field
    // that `proposeTemplateFields` keys `cnp_2` on purpose. Measuring its
    // untouched name against the captured set re-decides that and refuses it —
    // and because the flag is one dialog-wide boolean, it disabled Save for the
    // whole screen while displaying the perfectly good key `cnp_2`.
    const stored = [field({ key: "cnp", labelRo: "CNP", labelEn: "CNP" })];
    const rows = tick(rowsFor([pair("CNP", "1"), pair("CNP", "2")], stored), 1);
    expect(rows[0].alreadyInForm).toBe(true);
    expect(rows[1].alreadyInForm).toBe(false);
    expect(reviewRowIssues(rows, capturedFor(stored)).duplicateOfCaptured).toBe(false);
    expect([...keysForReviewRows(rows, capturedFor(stored)).values()]).toEqual(["cnp_2"]);
    // Rename that same row and the guard wakes up again — it is about what the
    // user typed, not about what discovery read.
    // ⚠️ **Compared NORMALISED, and a THIRD round is why.** Byte equality made
    // „CNP" retyped as „cnp" — or „Preţ" respelled „Preț" — read as a rename
    // onto a captured field, so a cosmetic correction disabled Save while the
    // untouched spelling of the same name saved happily.
    for (const respelling of ["CNP", "cnp", "C.N.P.", " CNP "]) {
      const renamed = rename(rows, 1, respelling);
      expect(reviewRowIssues(renamed, capturedFor(stored)).duplicateOfCaptured).toBe(false);
    }
    // A name pointed at a DIFFERENT captured field is still refused.
    const onto = rename(rows, 1, "Preț total");
    const both = [...stored, field({ key: "pretTotal", labelRo: "Preț total" })];
    expect(reviewRowIssues(onto, capturedFor(both)).duplicateOfCaptured).toBe(true);
  });

  it("does NOT refuse two new rows that share a name", () => {
    // Neither is captured; the module mints `cnp` / `cnp_2` for them, on
    // purpose, and DocTypeEngine's row-against-row guard has no business here.
    const rows = tick(rowsFor([pair("CNP", "1"), pair("CNP", "2")]), 0, 1);
    expect(reviewRowIssues(rows, capturedFor()).duplicateOfCaptured).toBe(false);
  });
});

describe("rowName", () => {
  it("is what the key, the save and the fragment warning all read", () => {
    // ⚠️ A review round found the fragment warning reading `label || labelRo`
    // while the key and the save read `label.trim() || labelRo` — so typing one
    // space into the box made the warning vanish while the fragment was still
    // what got stored.
    const rows = rowsFor([pair("Suprafața de", "2.000 mp")]);
    expect(rowName(rows[0])).toBe("Suprafața de");
    expect(rowName({ ...rows[0], label: " Suprafață " })).toBe("Suprafață");
    // No fallback: an emptied box is an empty name, and the guard says so
    // rather than the screen quietly restoring what was deleted.
    expect(rowName({ ...rows[0], label: "   " })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formValueForField
// ---------------------------------------------------------------------------

describe("formValueForField", () => {
  it("converts a Romanian date to the only thing a date input can hold", () => {
    // The discover prompt tells the model to leave "12.04.2021" as printed;
    // <input type="date"> shows anything but ISO as EMPTY while react-hook-form
    // still holds the string — so the user saves a value they cannot see, into
    // a key every later import writes in ISO.
    expect(formValueForField("12.04.2021", "date")).toBe("2021-04-12");
    expect(formValueForField("7/3/2024", "date")).toBe("2024-03-07");
    expect(formValueForField("2024-3-7", "date")).toBe("2024-03-07");
  });

  it("leaves a date field blank rather than storing something it cannot show", () => {
    expect(formValueForField("cândva în primăvară", "date")).toBeNull();
    expect(formValueForField("47.02.2024", "date")).toBeNull();
    expect(formValueForField("31.06.2023", "date")).toBeNull();
    expect(formValueForField("29.02.2023", "date")).toBeNull();
  });

  it("prefills a number only in the form the input accepts", () => {
    expect(formValueForField("1234.56", "number")).toBe("1234.56");
    // The user can set the type by hand on any row, so this is checked.
    expect(formValueForField("1234,56", "number")).toBeNull();
    expect(formValueForField("1.234,56 lei", "number")).toBeNull();
    // HTML's valid-floating-point grammar allows a leading "-" and not a "+",
    // so a number input blanks "+12.50" the same way.
    expect(formValueForField("+12.50", "number")).toBeNull();
    expect(formValueForField("-12.50", "number")).toBe("-12.50");
  });

  it("passes text through exactly as it was read", () => {
    expect(formValueForField("Ion Popescu", "text")).toBe("Ion Popescu");
    expect(formValueForField("a\nb", "textarea")).toBe("a\nb");
    expect(formValueForField("   ", "text")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// proposeTemplateFields
// ---------------------------------------------------------------------------

describe("proposeTemplateFields", () => {
  it("keeps the model's reading order", () => {
    const out = proposeTemplateFields(
      [pair("Vânzător", "Ion"), pair("Cumpărător", "Maria"), pair("Preț", "1,50")],
      [],
    );
    expect(out.map((p) => p.key)).toEqual(["vanzator", "cumparator", "pret"]);
  });

  it("flags a pair the type already carries, and keeps the existing key", () => {
    const existing = [field({ key: "pret", labelRo: "Preț convenit" })];
    const out = proposeTemplateFields([pair("Preț", "1,50")], existing);
    expect(out).toHaveLength(1);
    expect(out[0].alreadyInForm).toBe(true);
    expect(out[0].key).toBe("pret");
  });

  it("recognises a field by its LABEL when the key is an abbreviation of it", () => {
    // Curated fields are routinely keyed shorter than their caption. Without
    // the label side of the match, a discovery that reads that very caption
    // offers it as new and the form ends up with two identical captions.
    const existing = [field({ key: "nrAct", labelRo: "Nr. act autentic" })];
    const out = proposeTemplateFields([pair("Nr. act autentic", "123")], existing);
    expect(out[0].alreadyInForm).toBe(true);
    expect(out[0].key).toBe("nrAct");
  });

  it("does not offer the four generic fields every document already has", () => {
    // title / nrDocument / dateDocument / subject are COLUMNS, so no template
    // carries them — and discover's own prompt uses "Nr. 1234" and
    // "Data: 12.04.2021" as its worked examples of what to report. Accepting
    // them would make every later import write one printed value twice, once
    // to the column and once to custom_fields, after which the two copies
    // diverge the first time anyone edits one.
    const out = proposeTemplateFields(
      [pair("Nr.", "1234/2024"), pair("Data", "17.03.2024"), pair("Titlu", "Contract"),
       pair("Subiect", "vânzare"), pair("Preț", "1.50")],
      [],
    );
    expect(out.map((p) => p.alreadyInForm)).toEqual([true, true, true, true, false]);
    expect(out.filter((p) => !p.alreadyInForm).map((p) => p.key)).toEqual(["pret"]);
  });

  it("recognises a camelCase field it would have slugged differently", () => {
    // The whole hand-written convention is camelCase. Missing this match makes
    // a re-run offer the entire existing form as new, and accepting it appends
    // a second snake_case copy of every field.
    const existing = [field({ key: "pretTotal", labelRo: "Preț total" })];
    const out = proposeTemplateFields([pair("Preț total", "1,50")], existing);
    expect(out[0].alreadyInForm).toBe(true);
    // And it hands back the key the DATA is under, not the slug that matched it.
    expect(out[0].key).toBe("pretTotal");
  });

  it("never issues a new key that collides with an existing field", () => {
    // "Preț" and "Pret" both slug to `pret`. The FIRST is the field the type
    // already has; the second is a second occurrence on the page and must get
    // its own key rather than silently overwriting the first on save.
    const existing = [field({ key: "pret" })];
    const out = proposeTemplateFields([pair("Preț", "1"), pair("Pret", "2")], existing);
    expect(out.map((p) => p.alreadyInForm)).toEqual([true, false]);
    expect(out.map((p) => p.key)).toEqual(["pret", "pret_2"]);
    expect(new Set(out.map((p) => p.key)).size).toBe(out.length);
  });

  it("uniquifies two identically-labelled pairs from the same document", () => {
    const out = proposeTemplateFields([pair("Martor", "A"), pair("Martor", "B")], []);
    expect(out.map((p) => p.key)).toEqual(["martor", "martor_2"]);
  });

  it("drops a pair whose label is only whitespace it cannot key", () => {
    const out = proposeTemplateFields([pair("   ", "x"), pair("Preț", "1")], []);
    expect(out.map((p) => p.key)).toEqual(["pret"]);
  });

  it("carries the value through verbatim as evidence, unmasked and untruncated", () => {
    // The review step shows this beside the row, and since #29.10 that is all
    // it is for: `buildFieldHint` derives nothing from it any more, so nothing
    // in this string can reach the document type. A user checking a CNP against
    // the page needs to see the CNP.
    const value = `1800101123456 ${"y".repeat(300)}`;
    const out = proposeTemplateFields([pair("CNP", value)], []);
    expect(out[0].sampleValue).toBe(value);
  });

  it("carries the model's confidence through", () => {
    const out = proposeTemplateFields([pair("Preț", "1", "low")], []);
    expect(out[0].confidence).toBe("low");
  });

  it("does not offer a label the system captures some other way", () => {
    // Person roles are extracted as structured `parties` and linked to real
    // Person records. Accepting one here as well would put a second, freely
    // editable copy of a name and CNP on every document of the type.
    const out = proposeTemplateFields(
      [pair("Vânzător", "POPESCU ION"), pair("Suprafață", "120 mp")],
      [],
      ["Vânzător", "Cumpărător"],
    );
    expect(out.map((p) => p.alreadyInForm)).toEqual([true, false]);
    expect(out.filter((p) => !p.alreadyInForm).map((p) => p.key)).toEqual(["suprafata"]);
  });

  it("never throws on odd model output", () => {
    expect(() =>
      proposeTemplateFields(
        [pair("", ""), pair("§", ""), pair("A".repeat(500), "B".repeat(5000))],
        [],
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizeTemplateField / mergeAcceptedFields
// ---------------------------------------------------------------------------

describe("sanitizeTemplateField", () => {
  it("leaves a usable key exactly as it was", () => {
    // The one property that protects already-captured data: `custom_fields` is
    // keyed by this string on every document of the type. Lower-casing
    // `pretTotal` here orphans every value stored under it.
    for (const key of ["pretTotal", "nr_cadastral", "nr-cadastral", "C.F.", "a1"]) {
      expect(sanitizeTemplateField(field({ key })).key).toBe(key);
    }
  });

  it("re-slugs only a key that could corrupt the prompt line", () => {
    expect(sanitizeTemplateField(field({ key: "Preț Total!" })).key).toBe("pret_total");
    expect(sanitizeTemplateField(field({ key: 'a"b' })).key).toBe("a_b");
    expect(sanitizeTemplateField(field({ key: "a\nb" })).key).toBe("a_b");
  });

  it("collapses newlines out of every string that reaches the prompt", () => {
    const clean = sanitizeTemplateField(
      field({ labelRo: "Preț\ntotal", labelEn: "Total\nprice", aiHint: "a\nb" }),
    );
    expect(clean.labelRo).toBe("Preț total");
    expect(clean.labelEn).toBe("Total price");
    expect(clean.aiHint).toBe("a b");
  });

  it("falls back rather than leaving a field with no caption", () => {
    const clean = sanitizeTemplateField(field({ key: "pret", labelRo: "  ", labelEn: "Price" }));
    expect(clean.labelRo).toBe("Price");
    const both = sanitizeTemplateField(field({ key: "pret", labelRo: " ", labelEn: " " }));
    expect(both.labelRo).toBe("pret");
    expect(both.labelEn).toBe("pret");
  });

  it("turns an emptied hint into null, not an empty string", () => {
    expect(sanitizeTemplateField(field({ aiHint: "   " })).aiHint).toBeNull();
  });
});

describe("mergeAcceptedFields", () => {
  const existing = [
    field({ key: "vanzator", labelRo: "Vânzător", order: 0 }),
    field({ key: "pret", labelRo: "Preț", order: 1 }),
  ];

  it("keeps every existing field, in front and in order", () => {
    const merged = mergeAcceptedFields(existing, [field({ key: "notar", labelRo: "Notar" })]);
    expect(merged.map((f) => f.key)).toEqual(["vanzator", "pret", "notar"]);
  });

  it("does not rename a camelCase template it was handed", () => {
    // The failure this test exists for: every prior document of the type
    // stores its value at custom_fields.pretTotal, and a renamed key leaves
    // that data in the database and unreachable from the form and the prompt.
    const curated = [
      field({ key: "pretTotal", labelRo: "Preț total", order: 0 }),
      field({ key: "nrCadastral", labelRo: "Nr. cadastral", order: 1 }),
    ];
    const merged = mergeAcceptedFields(curated, [field({ key: "notar" })]);
    expect(merged.map((f) => f.key)).toEqual(["pretTotal", "nrCadastral", "notar"]);
  });

  it("drops an accepted field that is the same key in another convention", () => {
    const curated = [field({ key: "pretTotal", labelRo: "Preț total", order: 0 })];
    const merged = mergeAcceptedFields(curated, [field({ key: "pret_total", labelRo: "Preț" })]);
    expect(merged.map((f) => f.key)).toEqual(["pretTotal"]);
    expect(merged[0].labelRo).toBe("Preț total");
  });

  it("renumbers order from the final position, with no gaps or ties", () => {
    const merged = mergeAcceptedFields(existing, [
      field({ key: "notar", order: 99 }),
      field({ key: "martor", order: 99 }),
    ]);
    expect(merged.map((f) => f.order)).toEqual([0, 1, 2, 3]);
  });

  it("collapses a duplicate key to its first occurrence", () => {
    const merged = mergeAcceptedFields(existing, [
      field({ key: "pret", labelRo: "Preț (din nou)" }),
      field({ key: "notar" }),
    ]);
    expect(merged.map((f) => f.key)).toEqual(["vanzator", "pret", "notar"]);
    expect(merged.find((f) => f.key === "pret")?.labelRo).toBe("Preț");
  });

  it("drops an EXACT duplicate key already in the stored template", () => {
    // Two rows under one key cannot both be filled — custom_fields is keyed by
    // it, so the second shadows the first for ever.
    const dirty = [field({ key: "pret", labelRo: "A" }), field({ key: "pret", labelRo: "B" })];
    expect(mergeAcceptedFields(dirty, []).map((f) => f.labelRo)).toEqual(["A"]);
  });

  it("keeps two stored fields that merely normalise alike", () => {
    // They are different keys, so they hold different data, and dropping one
    // on a save the user asked for something else entirely would lose it. The
    // normalised test governs what may be ADDED, never what is already there.
    const dirty = [
      field({ key: "pretTotal", labelRo: "A" }),
      field({ key: "pret_total", labelRo: "B" }),
    ];
    expect(mergeAcceptedFields(dirty, []).map((f) => f.key)).toEqual(["pretTotal", "pret_total"]);
  });

  it("does not re-slug a stored key that would fail the safe-key test", () => {
    // Nothing has ever constrained stored keys — the admin full-replace PUT
    // validates a key as a non-empty string. Repairing one here would strand
    // every value already captured under it.
    const odd = [field({ key: "nr act autentic", labelRo: "Nr. act" })];
    expect(mergeAcceptedFields(odd, []).map((f) => f.key)).toEqual(["nr act autentic"]);
  });

  it("survives a round trip through parseTemplateFields unchanged", () => {
    // What is stored is jsonb; what is read back builds the form and the
    // prompt. A merge whose output the reader would alter is a merge whose
    // result nobody actually gets.
    const merged = mergeAcceptedFields(existing, [field({ key: "notar", type: "date" })]);
    expect(parseTemplateFields(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
  });

  it("accepts an empty acceptance without disturbing the type", () => {
    expect(mergeAcceptedFields(existing, [])).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The prompt-line contract
// ---------------------------------------------------------------------------

describe("what reaches the extraction prompt", () => {
  it("puts every discovered field on exactly one line of the real prompt", () => {
    // Asserted against buildExtractSystemPrompt itself, not against a rule
    // restated here: the one-line-per-field shape is that module's, and this
    // is what stops a label typed with a line break from splitting it.
    const proposals = proposeTemplateFields(
      [
        pair("Preț\ntotal", "1.234,56 lei"),
        pair("Observații", "prima linie\na doua linie\na treia"),
        pair("Data autentificării", "17.03.2024"),
      ],
      [],
    );
    const merged = mergeAcceptedFields(
      [],
      proposals.map((p, i) => ({
        key:     p.key,
        labelRo: p.labelRo,
        labelEn: p.labelEn,
        type:    p.type,
        order:   i,
        aiHint:  buildFieldHint({ sampleValue: p.sampleValue, type: p.type }),
        groupRo: null,
        groupEn: null,
      })),
    );

    const prompt = buildExtractSystemPrompt(merged, []);
    for (const f of merged) {
      const hits = prompt.split("\n").filter((line) => line.includes(`"${f.key}"`));
      expect(hits).toHaveLength(1);
      expect(hits[0]).toContain(f.labelRo);
      if (f.aiHint) expect(hits[0]).toContain(f.aiHint);
    }
  });

  it("keeps the ceiling the route enforces in one place", () => {
    expect(MAX_TEMPLATE_FIELDS).toBeGreaterThan(0);
    const routeSource = readFileSync(
      join(process.cwd(), "src", "app", "api", "document-types", "[id]", "template-fields", "route.ts"),
      "utf8",
    );
    // A second literal in the route would let the dialog's pre-check and the
    // route's rejection disagree, which is a Save button that is enabled and
    // then fails.
    expect(routeSource).toContain("MAX_TEMPLATE_FIELDS");
    expect(routeSource).not.toMatch(/const MAX_FIELDS\s*=/);
  });
});

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

function loadDocumentCopy(file: string): Record<string, unknown> {
  const raw = readFileSync(join(process.cwd(), "messages", file), "utf8");
  return (JSON.parse(raw) as { document: Record<string, unknown> }).document;
}

function loadReviewCopy(file: string): Record<string, unknown> {
  return loadDocumentCopy(file).discoverReview as Record<string, unknown>;
}

describe("review-step copy", () => {
  it.each(LOCALES)("%s carries the whole namespace", (file) => {
    const copy = loadReviewCopy(file);
    for (const key of [
      "title", "intro", "warnSkipped", "warnTruncated", "nothingNew",
      "tableCaption", "colInclude", "colLabel", "colType", "colSample",
      "includeAria", "labelAria", "typeAria", "lowConfidence", "sampleEmpty",
      "alreadyTitle", "alreadyBody", "selectedCount", "needSelection",
      "nothingToAddFooter", "typeFull", "cancel", "close", "save", "saving",
      "overLimit", "errorSession", "errorChanged", "errorNotFound",
      "errorTooMany", "errorSave",
      // Slice #29.10.
      "noHintNote", "fragmentName", "longName", "rowNameRequired",
      "rowNameDuplicate", "rowIssuesFooter",
    ]) {
      expect(typeof copy[key]).toBe("string");
    }
    const types = copy.types as Record<string, unknown>;
    for (const t of ["text", "textarea", "date", "number"]) {
      expect(typeof types[t]).toBe("string");
    }
  });

  it("both locales define exactly the same keys", () => {
    // A key present in en-GB and missing from ro-RO renders as a raw key path
    // in the shipping locale — the failure #26.02 recorded.
    const ro = Object.keys(loadReviewCopy("ro-RO.json")).sort();
    const en = Object.keys(loadReviewCopy("en-GB.json")).sort();
    expect(ro).toEqual(en);
  });

  it("Romanian plurals carry one/few/other", () => {
    // Romanian has a `few` form (2..19) that English does not. Omitting it
    // makes "5 câmpuri" render through the `other` rule, which is the
    // "de câmpuri" form and reads wrong.
    const review = loadReviewCopy("ro-RO.json");
    // ⚠️ `errorTooMany` joined the list in #29.10. Its `{max}` is whatever the
    // ROUTE sends, not the local constant, and Romanian takes „de" only from 20
    // upward — a hard-coded „de" renders „cel mult 15 de câmpuri" the day the
    // ceiling moves.
    for (const key of ["warnSkipped", "alreadyTitle", "selectedCount", "errorTooMany"]) {
      const msg = String(review[key]);
      expect(msg).toContain("one {");
      expect(msg).toContain("few {");
      expect(msg).toContain("other {");
    }
    const doc = loadDocumentCopy("ro-RO.json");
    for (const key of ["aiDiscoverSaved", "aiDiscoverSkipped"]) {
      const msg = String(doc[key]);
      expect(msg).toContain("one {");
      expect(msg).toContain("few {");
      expect(msg).toContain("other {");
    }
  });

  it("carries a localised message for every failure the run can report", () => {
    // The route serves an API and most of its failures are English, some of
    // them Anthropic's own. None of them may reach this screen verbatim.
    for (const file of LOCALES) {
      const doc = loadDocumentCopy(file);
      for (const key of [
        "aiDiscoverError", "aiDiscoverErrorBusy", "aiDiscoverErrorNoPages",
        "aiDiscoverErrorUnreadable", "aiDiscoverErrorNotConfigured",
      ]) {
        expect(typeof doc[key]).toBe("string");
      }
    }
  });

  it("no AI-Discovery string sends a business user to the server console", () => {
    // The button's whole point changed in this slice: the report is not a
    // developer diagnostic any more, and every string on its path — the hint,
    // and the two that ride along with the nothing-found message — must not
    // mention a terminal the user does not have.
    for (const file of LOCALES) {
      const doc = loadDocumentCopy(file);
      const strings = [
        String((doc.hints as Record<string, string>).aiDiscover),
        ...Object.entries(doc)
          .filter(([k, v]) => k.startsWith("aiDiscover") && typeof v === "string")
          .map(([, v]) => String(v)),
      ];
      for (const s of strings) {
        expect(s.toLowerCase()).not.toContain("console");
        expect(s.toLowerCase()).not.toContain("consol");
      }
    }
  });
});

describe("collapseWhitespace", () => {
  it("is the one-line guarantee everything else leans on", () => {
    expect(collapseWhitespace("  a \n b \t c  ")).toBe("a b c");
    expect(collapseWhitespace("\n\n")).toBe("");
  });
});
