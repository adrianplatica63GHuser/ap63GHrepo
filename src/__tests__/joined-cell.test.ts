/**
 * #38.55 — a role's converse names on one line, joined with „, ".
 * #38.58 — a neutral name that only repeats the pair is left out („Frate / Soră, Frate, Soră" → „Frate, Soră").
 * The rule is src/lib/admin/value-lists/joined-cell.ts.
 */
import fs from "node:fs";
import path from "node:path";

import { joinedCellText, neutralRepeatsPair } from "@/lib/admin/value-lists/joined-cell";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const MODAL = read("src/app/admin/value-lists/_components/value-list-modal.tsx");
const MSG = { ro: JSON.parse(read("messages/ro-RO.json")), en: JSON.parse(read("messages/en-GB.json")) };

describe("joinedCellText (#38.55)", () => {
  // #38.55 pinned `["Vânzător", "Vânzător", "Vânzătoare"]` → „Vânzător, Vânzător, Vânzătoare". #38.58 leaves
  // out a neutral name that repeats one of the pair, so that row is „Vânzător, Vânzătoare" (below); three
  // DIFFERENT names are still joined whole, in order.
  it("joins three values, in order, with „, ”", () => {
    expect(joinedCellText(["Copil", "Fiu", "Fiică"])).toBe("Copil, Fiu, Fiică");
  });
  it("joins two, skipping a blank between them", () => {
    expect(joinedCellText(["Copil", "", "Fiică"])).toBe("Copil, Fiică");
    expect(joinedCellText(["Copil", null, "Fiică"])).toBe("Copil, Fiică");
  });
  it("shows one alone, with no comma", () => {
    expect(joinedCellText(["Părinte", null, undefined])).toBe("Părinte");
    expect(joinedCellText(["  Părinte  ", "   ", ""])).toBe("Părinte");
  });
  // Slice #38.70 (migration_104): Adrian's two short names, each the role's neutral name alone — a man and a woman are
  // both shown it, the „(ă)" carrying both.
  it("shows Adrian's two names whole, as written, each alone in its role", () => {
    expect(joinedCellText(["Bunic(ă), Unchi, Mătușă", null, null])).toBe("Bunic(ă), Unchi, Mătușă");
    expect(joinedCellText(["Reprezentat(ă) / Mandant(ă)", null, null])).toBe("Reprezentat(ă) / Mandant(ă)");
    expect(neutralRepeatsPair("Reprezentat(ă) / Mandant(ă)", null, null)).toBe(false);
  });
  it("shows „–” when every one is blank", () => {
    expect(joinedCellText([null, "", "  "])).toBe("–");
    expect(joinedCellText([])).toBe("–");
  });
});

describe("a neutral name that only repeats the pair is left out (#38.58)", () => {
  it("drops „Frate / Soră” and „Soț / Soție” beside their two gendered names", () => {
    expect(joinedCellText(["Frate / Soră", "Frate", "Soră"])).toBe("Frate, Soră");
    expect(joinedCellText(["Soț / Soție", "Soț", "Soție"])).toBe("Soț, Soție");
  });
  it("ignores the spaces around „/”", () => {
    expect(joinedCellText(["Frate/Soră", "Frate", "Soră"])).toBe("Frate, Soră");
    expect(joinedCellText(["Frate  /   Soră", " Frate ", "Soră "])).toBe("Frate, Soră");
  });
  it("drops a neutral name that repeats one of the two (Ask first #1, recommended)", () => {
    expect(joinedCellText(["Vânzător", "Vânzător", "Vânzătoare"])).toBe("Vânzător, Vânzătoare");
    expect(joinedCellText(["Vânzătoare", "Vânzător", "Vânzătoare"])).toBe("Vânzător, Vânzătoare");
  });
  it("keeps „Copil, Fiu, Fiică” — not that pattern", () => {
    expect(joinedCellText(["Copil", "Fiu", "Fiică"])).toBe("Copil, Fiu, Fiică");
    expect(neutralRepeatsPair("Copil", "Fiu", "Fiică")).toBe(false);
  });
  it("keeps the neutral name when one gendered name is blank", () => {
    expect(joinedCellText(["Frate / Soră", "Frate", ""])).toBe("Frate / Soră, Frate");
    expect(joinedCellText(["Frate / Soră", null, "Soră"])).toBe("Frate / Soră, Soră");
    expect(neutralRepeatsPair("Frate", "Frate", "  ")).toBe(false);
  });
  it("keeps the pair the wrong way round, and any other text around the slash", () => {
    expect(joinedCellText(["Soră / Frate", "Frate", "Soră"])).toBe("Soră / Frate, Frate, Soră");
    expect(joinedCellText(["Frate / Soră vitregă", "Frate", "Soră"])).toBe("Frate / Soră vitregă, Frate, Soră");
  });
  it("applies only to the converse triple — two values are joined as they are", () => {
    expect(joinedCellText(["Frate", "Frate"])).toBe("Frate, Frate");
  });
});

describe("the converse cell and its header (#38.55)", () => {
  it("is one line: no stacked `block` spans in the cell, the joined text instead", () => {
    expect(MODAL).toContain("joinedCellText(cell.map((f) => row[f.key]))");
    expect(MODAL).not.toContain('className={cell.length > 1 ? "block" : undefined}');
  });
  it("is headed „Rol invers” over „(bărbat, femeie)” — Adrian's words — and in English „Converse role” over „(man, woman)”", () => {
    expect(MSG.ro.valueList.fields.converseJoined).toBe("Rol invers");
    expect(MSG.ro.valueList.fields.converseJoinedSub).toBe("(bărbat, femeie)");
    expect(MSG.en.valueList.fields.converseJoined).toBe("Converse role");
    expect(MSG.en.valueList.fields.converseJoinedSub).toBe("(man, woman)");
  });
});
