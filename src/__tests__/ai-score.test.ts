/**
 * @jest-environment node
 */

/**
 * Slice #36.23 — the AI score's comparison rules (`src/lib/ai-score/score.ts`),
 * pinned over synthetic contracts. Every name and number here is invented.
 */

import fs from "node:fs";
import path from "node:path";

import {
  compareField,
  findLand,
  foldText,
  nameKey,
  percent,
  personName,
  readDate,
  readNumber,
  scoreContract,
  summarise,
  unreadable,
  type ExpectedContract,
  type ReadContract,
} from "@/lib/ai-score/score";

describe("reading a number", () => {
  it.each([
    ["44.320.000", 44320000],
    ["3.704", 3704],
    ["178.5", 178.5],
    ["178,5", 178.5],
    ["1.785,50", 1785.5],
    ["10000", 10000],
    ["3 704 mp", 3704],
    ["1.785 lei", 1785],
    ["50%", 50],
    ["1/3", 100 / 3],
    ["683,76 mp", 683.76],
  ] as const)("%s reads as %s", (text, n) => {
    expect(readNumber(text)).toBeCloseTo(n, 2);
  });

  it("nothing, or no digits, is null", () => {
    expect(readNumber(null)).toBeNull();
    expect(readNumber("  ")).toBeNull();
    expect(readNumber("nu se precizează")).toBeNull();
  });
});

describe("reading a date", () => {
  it.each([
    ["2007-10-10", "2007-10-10"],
    ["10.10.2007", "2007-10-10"],
    ["2.3.2004", "2004-03-02"],
    ["02/03/2004", "2004-03-02"],
  ] as const)("%s is %s", (text, iso) => {
    expect(readDate(text)).toBe(iso);
  });

  it("anything else is null", () => {
    expect(readDate("martie 2004")).toBeNull();
  });
});

describe("one field", () => {
  it("text: the application's fold, and a leading nr dropped", () => {
    expect(compareField("text", "2378", "Nr. 2378")).toBe(true);
    expect(compareField("text", "Încheiere", "INCHEIERE")).toBe(true);
    expect(compareField("text", "2378", "2387")).toBe(false);
  });

  it("number: within 0.5", () => {
    expect(compareField("number", "178.5", "178,5")).toBe(true);
    expect(compareField("number", "238", "238.4")).toBe(true);
    expect(compareField("number", "238", "239")).toBe(false);
    expect(compareField("number", "44320000", "44.320.000")).toBe(true);
  });

  it("number: an expected null is met only by nothing", () => {
    expect(compareField("number", null, null)).toBe(true);
    expect(compareField("number", null, "")).toBe(true);
    expect(compareField("number", null, "200")).toBe(false);
    expect(compareField("number", "200", null)).toBe(false);
  });

  it("date: the same day in either notation", () => {
    expect(compareField("date", "2006-08-14", "14.08.2006")).toBe(true);
    expect(compareField("date", "2006-08-14", "2006-08-15")).toBe(false);
    expect(compareField("date", null, null)).toBe(true);
    expect(compareField("date", "2006-08-14", "august 2006")).toBe(false);
  });

  it("select: the same value; not-stated and nothing are one answer", () => {
    expect(compareField("select", "ACHITAT_INTEGRAL", "achitat_integral")).toBe(true);
    expect(compareField("select", "NEMENTIONAT", null)).toBe(true);
    expect(compareField("select", null, "NEMENTIONAT")).toBe(true);
    expect(compareField("select", "FARA_CF", "NEDEFINITIVA")).toBe(false);
    expect(compareField("select", "NUMERAR", null)).toBe(false);
  });
});

describe("names", () => {
  it("the same words in any order, diacritics and case ignored", () => {
    expect(nameKey("Popescu Ion-Andrei")).toBe(nameKey("ION-ANDREI POPESCU"));
    expect(nameKey("Țică Aurica")).toBe(nameKey("TICA AURICA"));
    expect(nameKey("Popescu Ion")).not.toBe(nameKey("Popescu Ioana"));
  });

  it("foldText is the application's fold", () => {
    expect(foldText("Nr. 1.941")).toBe("1 941");
  });
});

describe("land, from what the model could not put in a field", () => {
  it("an identifier follows its name", () => {
    expect(findLand(["Tarla 46", "Parcela 222/13/1"], "tarla", "46").ok).toBe(true);
    expect(findLand(["Tarla 46", "Parcela 222/13/1"], "parcela", "222/13/1").ok).toBe(true);
    expect(findLand(["Amplasament: tarlaua 58, parcela 253/1"], "parcela", "253/1").ok).toBe(true);
  });

  it("„solă” is the older word for tarla", () => {
    expect(findLand(["Amplasament: sola 3, parcela 59"], "tarla", "3").ok).toBe(true);
    expect(findLand(["Amplasament: sola 3, parcela 59"], "parcela", "59").ok).toBe(true);
  });

  it("one label naming two things still gives each a window", () => {
    expect(findLand(["Tarla / Parcela: 3 / 82"], "tarla", "3").ok).toBe(true);
    expect(findLand(["Tarla / Parcela: 3 / 82"], "parcela", "82").ok).toBe(true);
  });

  it("the land book, by name or as CF", () => {
    expect(findLand(["Carte funciară: 590/N a localității"], "carteFunciara", "590/N").ok).toBe(true);
    expect(findLand(["Imobil: CF nr. 1179"], "carteFunciara", "1179").ok).toBe(true);
    expect(findLand(["Extras CF pentru autentificare nr. 34163"], "carteFunciara", "1179").ok).toBe(false);
  });

  it("the area is a number within 0.5, in Romanian notation", () => {
    expect(findLand(["Suprafață teren: 3.704 mp"], "suprafataMp", "3704").ok).toBe(true);
    expect(findLand(["Suprafata totala 683,76 mp"], "suprafataMp", "683.76").ok).toBe(true);
    expect(findLand(["Suprafață: 3.700 mp"], "suprafataMp", "3704").ok).toBe(false);
  });

  it("a number that belongs to the next thing named is not this thing's", () => {
    expect(findLand(["Tarla: -", "Parcela: 46"], "tarla", "46").ok).toBe(false);
  });

  it("a miss reports the entry that named the thing, if one did", () => {
    expect(findLand(["Tarla 47/3"], "tarla", "47/2")).toEqual({ ok: false, read: "Tarla 47/3" });
    expect(findLand(["Vecini: De 206"], "tarla", "47/2")).toEqual({ ok: false, read: null });
  });
});

describe("one contract", () => {
  const expected: ExpectedContract = {
    id: "syn-01",
    status: "confirmed",
    fields: {
      nrDocument: "1234",
      dateDocument: "2005-06-15",
      pretTotal: "6000",
      monedaPret: "RON",
      marcajCarteFunciara: "NEDEFINITIVA",
      impozitTransfer: null,
    },
    parties: {
      Vânzător: [{ name: "POPESCU ION" }],
      Cumpărător: [
        { name: "IONESCU MARIA", cotaParte: "50" },
        { name: "GEORGESCU DAN-ALEXANDRU", cotaParte: "50" },
      ],
    },
    land: { tarla: "40", parcela: "212/40", carteFunciara: null, suprafataMp: "612" },
  };
  const kinds = { pretTotal: "number", monedaPret: "select", marcajCarteFunciara: "select", impozitTransfer: "number" } as const;

  const read: ReadContract = {
    fields: { title: "Contract", nrDocument: "1234", dateDocument: "15.06.2005", subject: "vânzare teren" },
    customFields: { pretTotal: "6.000", monedaPret: "RON", marcajCarteFunciara: "FARA_CF", impozitTransfer: "120" },
    unmappedRaw: { Tarla: "40", Parcela: "212/41", "Suprafață": "612 mp" },
    parties: [
      { roleName: "Vânzător", name: "Ion Popescu", cotaParte: null, cotaSuprafataMp: null },
      { roleName: "Cumparator", name: "Maria Ionescu", cotaParte: "1/2", cotaSuprafataMp: null },
      { roleName: "Cumpărător", name: "Dan-Alexandru Georgescu", cotaParte: "40", cotaSuprafataMp: null },
      { roleName: "Reprezentant legal / Mandatar", name: "Agent Invented", cotaParte: null, cotaSuprafataMp: null },
    ],
  };

  const items = scoreContract(expected, read, kinds);
  const ok = Object.fromEntries(items.map((i) => [`${i.field}${i.field === "shares" ? `:${i.expected}` : ""}`, i.ok]));

  it("scores every expected field, the generic ones from fields and the rest from customFields", () => {
    expect(ok.nrDocument).toBe(true);
    expect(ok.dateDocument).toBe(true);
    expect(ok.pretTotal).toBe(true);
    expect(ok.monedaPret).toBe(true);
    expect(ok.marcajCarteFunciara).toBe(false);
    expect(ok.impozitTransfer).toBe(false); // an expected null read as a value is a mistake
  });

  it("scores each role as a set, with the role name folded, and ignores roles the key does not have", () => {
    expect(ok["parties.Vânzător"]).toBe(true);
    expect(ok["parties.Cumpărător"]).toBe(true);
    expect(items.filter((i) => i.field.startsWith("parties.")).map((i) => i.field)).toEqual([
      "parties.Vânzător",
      "parties.Cumpărător",
    ]);
  });

  it("scores one share item per person the key gives a share", () => {
    expect(ok["shares:50% / - m²"]).toBeDefined();
    const shares = items.filter((i) => i.field === "shares").map((i) => i.ok);
    expect(shares).toEqual([true, false]); // 1/2 is 50; 40 is not
  });

  it("scores land from unmappedRaw, and skips a land value the key leaves null", () => {
    expect(ok["land.tarla"]).toBe(true);
    expect(ok["land.parcela"]).toBe(false);
    expect(ok["land.suprafataMp"]).toBe(true);
    expect("land.carteFunciara" in ok).toBe(false);
  });

  it("a missing person makes the role wrong", () => {
    const fewer = scoreContract(expected, { ...read, parties: read.parties.slice(0, 2) }, kinds);
    expect(fewer.find((i) => i.field === "parties.Cumpărător")?.ok).toBe(false);
  });

  it("an answer that could not be parsed misses every item, the null-expected ones too", () => {
    const zero = unreadable(expected, kinds);
    expect(zero.length).toBe(items.length);
    expect(zero.every((i) => !i.ok && i.read === null)).toBe(true);
  });

  it("a natural person read as last and first name, with name null, is that person", () => {
    const split = scoreContract(
      expected,
      {
        ...read,
        parties: [{ roleName: "Vânzător", name: null, firstName: "Ion", lastName: "Popescu", cotaParte: null, cotaSuprafataMp: null }],
      },
      kinds,
    );
    expect(split.find((i) => i.field === "parties.Vânzător")?.ok).toBe(true);
    expect(personName({ roleName: "x", name: null, firstName: null, lastName: null, cotaParte: null, cotaSuprafataMp: null })).toBe("");
  });

  it("an extra person makes the role wrong too", () => {
    const more = scoreContract(
      expected,
      { ...read, parties: [...read.parties, { roleName: "Vânzător", name: "Someone Else", cotaParte: null, cotaSuprafataMp: null }] },
      kinds,
    );
    expect(more.find((i) => i.field === "parties.Vânzător")?.ok).toBe(false);
  });
});

describe("a run", () => {
  it("the micro average over every item, and per field weakest first", () => {
    const s = summarise([
      { contract: "a", field: "pretTotal", ok: true, expected: null, read: null },
      { contract: "a", field: "land.tarla", ok: false, expected: null, read: null },
      { contract: "b", field: "pretTotal", ok: true, expected: null, read: null },
      { contract: "b", field: "land.tarla", ok: true, expected: null, read: null },
      { contract: "b", field: "shares", ok: false, expected: null, read: null },
    ]);
    expect(s.contracts).toBe(2);
    expect(s.correct).toBe(3);
    expect(s.total).toBe(5);
    expect(s.score).toBeCloseTo(0.6);
    expect(s.perField.map((f) => [f.field, f.correct, f.total])).toEqual([
      ["shares", 0, 1],
      ["land.tarla", 1, 2],
      ["pretTotal", 2, 2],
    ]);
  });

  it("no items, no number", () => {
    expect(summarise([]).score).toBeNull();
    expect(percent(null)).toBe("—");
    expect(percent(0.7251)).toBe("72.5%");
    expect(percent(1)).toBe("100.0%");
  });
});

describe("the harness calls the application's extraction, never a copy of it", () => {
  // A BEHAVIOUR guard reads only code, so comments are stripped first.
  const code = fs
    .readFileSync(path.join(process.cwd(), "scripts", "testing", "ai-score.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("builds the prompt with the route's own function and sends it through ai-extract", () => {
    expect(code).toMatch(/import \{ buildExtractSystemPrompt \} from "@\/lib\/import\/classify-prompts"/);
    for (const fn of ["buildPageBlocks", "buildExtractRequestBody", "callAnthropic", "interpretExtractText", "typeHintTextFor"]) {
      expect(code).toMatch(new RegExp(`\\b${fn}\\b[\\s\\S]*from "@/lib/documents/ai-extract"`));
    }
  });

  it("holds no prompt text and no endpoint of its own", () => {
    expect(code).not.toMatch(/api\.anthropic\.com|anthropic-version|"system":|You are /);
  });

  it("refuses before any read when the corpus is bigger than the cap", () => {
    const cap = code.indexOf("contracts.length > readCap");
    const firstCall = code.indexOf("await callAnthropic(");
    expect(cap).toBeGreaterThan(0);
    expect(firstCall).toBeGreaterThan(cap);
  });
});
