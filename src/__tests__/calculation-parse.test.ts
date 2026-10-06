/**
 * „Calcul drum lateral" — the three-section data file             (Slice #38.23)
 *
 * Pure module. The request's sample is the reference; every rejection is
 * asserted by its CODE, so rewording a message in messages/*.json never breaks
 * a test here. The copy itself is held by calculation-problems-copy below.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { FileRejected, parseSideRoadFile, sectionOf, type FileProblem } from "@/lib/calculation/parse";

/** Adrian's request, verbatim (tabs, the doubled tabs, the notes in brackets). */
const REQUEST_SAMPLE = `********************************************************************
Sectiunea de Colturi (numai 4 colturi, nu 3, nu 5)
121\t321015.423\t572425.587
122\t322135.856\t573339.077
123\t321372.274\t574609.524
124\t320175.100\t572897.684

Sectiunea de Proprietari (total cote-parti sa fie 100% sau 99.99%, nimic altceva)
Mateescu\t24,33%
Georgescu\t25,66%
Preda\t\t15%
Ionescu\t\t35%

Sectiunea de Latime Drum (in metri)
7
********************************************************************
`;

const CORNERS = `Sectiunea de Colturi
121 321015.423 572425.587
122 322135.856 573339.077
123 321372.274 574609.524
124 320175.100 572897.684
`;
const OWNERS = `Sectiunea de Proprietari
A 50%
B 50%
`;
const WIDTH = `Sectiunea de Latime Drum
7
`;

function problemsOf(text: string): FileProblem[] {
  try {
    parseSideRoadFile(text);
  } catch (e) {
    if (e instanceof FileRejected) return e.problems;
    throw e;
  }
  throw new Error("the file was read, not rejected");
}

const codes = (text: string) => problemsOf(text).map((p) => p.code);

describe("the request's sample", () => {
  const file = parseSideRoadFile(REQUEST_SAMPLE);

  it("reads its four corners, numbers kept as written, X = North and Y = East", () => {
    expect(file.corners).toEqual([
      { number: "121", north: 321015.423, east: 572425.587 },
      { number: "122", north: 322135.856, east: 573339.077 },
      { number: "123", north: 321372.274, east: 574609.524 },
      { number: "124", north: 320175.1, east: 572897.684 },
    ]);
  });

  it("reads its owners in file order, with decimal commas and an optional %", () => {
    expect(file.owners).toEqual([
      { name: "Mateescu", percent: 24.33 },
      { name: "Georgescu", percent: 25.66 },
      { name: "Preda", percent: 15 },
      { name: "Ionescu", percent: 35 },
    ]);
    expect(file.percentTotal).toBe(99.99);
  });

  it("reads the width", () => {
    expect(file.roadWidth).toBe(7);
  });

  it("is the same file as the repo's sample, but for the names", () => {
    const repo = readFileSync(join(__dirname, "..", "lib", "calculation", "side-road-sample.txt"), "utf8");
    const parsed = parseSideRoadFile(repo);
    expect(parsed.corners).toEqual(file.corners);
    expect(parsed.owners.map((o) => o.percent)).toEqual(file.owners.map((o) => o.percent));
    expect(parsed.owners.every((o) => o.name.startsWith("TC-"))).toBe(true);
    expect(parsed.roadWidth).toBe(file.roadWidth);
  });
});

describe("what the file may look like", () => {
  it("names with spaces, decimal commas and points everywhere, „7 m”", () => {
    const file = parseSideRoadFile(`Secțiunea de Colțuri
1\t321015,423\t572425,587
2 322135.856 573339.077
3 321372,274 574609,524
4 320175.100\t572897.684
SECȚIUNEA DE PROPRIETARI
Ion Popescu de Jos  33,34%
Maria Ionescu 33.33
Ana   33,33 %
secţiunea de lăţime drum — note
7,5 m
`);
    expect(file.corners[0]).toEqual({ number: "1", north: 321015.423, east: 572425.587 });
    expect(file.owners.map((o) => o.name)).toEqual(["Ion Popescu de Jos", "Maria Ionescu", "Ana"]);
    expect(file.owners.map((o) => o.percent)).toEqual([33.34, 33.33, 33.33]);
    expect(file.percentTotal).toBe(100);
    expect(file.roadWidth).toBe(7.5);
  });

  it.each([
    ["Sectiunea de Colturi (numai 4)", "corners"],
    ["Secțiunea de Colțuri", "corners"],
    ["secţiunea de colţuri", "corners"], // cedilla ţ, the older spelling
    ["  SECTIUNEA   DE   PROPRIETARI", "owners"],
    ["Sectiunea de Latime Drum (in metri)", "width"],
    ["Secțiunea de Lățime Drum", "width"],
    ["Sectiunea de Altceva", null],
    ["Colturi", null],
  ])("%s → %s", (line, section) => {
    expect(sectionOf(line)).toBe(section);
  });

  it("three shares of 33.333% sum to 100 — summed, then rounded", () => {
    expect(parseSideRoadFile(CORNERS + "Sectiunea de Proprietari\nA 33,333\nB 33,333\nC 33,334\n" + WIDTH).percentTotal).toBe(100);
  });
});

describe("the four rejections, each with its own message", () => {
  it("3 corners", () => {
    expect(problemsOf(CORNERS.split("\n").slice(0, 4).join("\n") + "\n" + OWNERS + WIDTH)).toEqual([
      { code: "cornerCount", values: { count: 3 } },
    ]);
  });

  it("5 corners", () => {
    expect(problemsOf(CORNERS + "125 320000.000 572000.000\n" + OWNERS + WIDTH)).toEqual([
      { code: "cornerCount", values: { count: 5 } },
    ]);
  });

  it("98.5% in total", () => {
    expect(problemsOf(CORNERS + "Sectiunea de Proprietari\nA 50%\nB 48,5%\n" + WIDTH)).toEqual([
      { code: "percentTotal", values: { total: 98.5 } },
    ]);
  });

  it("100.01% in total — neither 100 nor 99.99", () => {
    expect(codes(CORNERS + "Sectiunea de Proprietari\nA 50,01%\nB 50%\n" + WIDTH)).toEqual(["percentTotal"]);
  });

  it.each([["15"], ["15 m"], ["0"], ["20,5 m"]])("a width of %s", (w) => {
    expect(problemsOf(CORNERS + OWNERS + "Sectiunea de Latime Drum\n" + w + "\n")).toEqual([
      { code: "roadWidth", values: { width: Number(w.replace(" m", "").replace(",", ".")) } },
    ]);
  });

  it("14.99 m is accepted", () => {
    expect(parseSideRoadFile(CORNERS + OWNERS + "Sectiunea de Latime Drum\n14,99\n").roadWidth).toBe(14.99);
  });

  it.each([
    ["corners", OWNERS + WIDTH],
    ["owners", CORNERS + WIDTH],
    ["width", CORNERS + OWNERS],
  ])("a missing %s section", (section, text) => {
    expect(problemsOf(text)).toEqual([{ code: "missingSection", values: { section } }]);
  });

  it("a line that cannot be read is quoted with its section and line number — and its section is not then counted or summed", () => {
    expect(problemsOf(CORNERS + "Sectiunea de Proprietari\nA 50%\nB cincizeci\n" + WIDTH)).toEqual([
      { code: "unreadableLine", values: { section: "owners", lineNumber: 8, line: "B cincizeci" } },
    ]);
  });

  it("a corner outside Stereo 70, and text before the first section, are unreadable lines", () => {
    expect(problemsOf("Fișier de test\n" + CORNERS.replace("121 321015.423", "121 3210.423") + OWNERS + WIDTH)).toEqual([
      { code: "unreadableLine", values: { section: "none", lineNumber: 1, line: "Fișier de test" } },
      { code: "unreadableLine", values: { section: "corners", lineNumber: 3, line: "121 3210.423 572425.587" } },
    ]);
  });

  it("every problem at once, not the first", () => {
    expect(codes(CORNERS.split("\n").slice(0, 3).join("\n") + "\nSectiunea de Proprietari\nA 40%\nB 40%\nSectiunea de Latime Drum\n15 m\n")).toEqual([
      "cornerCount",
      "percentTotal",
      "roadWidth",
    ]);
  });
});

describe("the rejections the four rules imply", () => {
  it("corners listed out of ring order draw a bow tie", () => {
    const crossed = `Sectiunea de Colturi
121 321015.423 572425.587
123 321372.274 574609.524
122 322135.856 573339.077
124 320175.100 572897.684
`;
    expect(codes(crossed + OWNERS + WIDTH)).toEqual(["cornersCross"]);
  });

  it("one owner is not a division", () => {
    expect(codes(CORNERS + "Sectiunea de Proprietari\nA 100%\n" + WIDTH)).toEqual(["ownerCount"]);
  });

  it("a section given twice, a corner number given twice, two widths", () => {
    expect(codes(CORNERS.replace("122 ", "121 ") + OWNERS + OWNERS + "Sectiunea de Latime Drum\n7\n8\n")).toEqual([
      "repeatedSection",
      "repeatedCorner",
      "percentTotal",
      "widthCount",
    ]);
  });

  it("blank lines and lines of asterisks are not lines to read", () => {
    expect(() => parseSideRoadFile("***\n\n" + CORNERS + "\n*\n" + OWNERS + "\n\n" + WIDTH + "**********\n")).not.toThrow();
  });
});
