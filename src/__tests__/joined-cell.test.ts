/**
 * #38.55 — a role's converse names on one line, joined with „, ".
 * The rule is src/lib/admin/value-lists/joined-cell.ts.
 */
import fs from "node:fs";
import path from "node:path";

import { joinedCellText } from "@/lib/admin/value-lists/joined-cell";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const MODAL = read("src/app/admin/value-lists/_components/value-list-modal.tsx");
const MSG = { ro: JSON.parse(read("messages/ro-RO.json")), en: JSON.parse(read("messages/en-GB.json")) };

describe("joinedCellText (#38.55)", () => {
  it("joins three values, in order, with „, ”", () => {
    expect(joinedCellText(["Vânzător", "Vânzător", "Vânzătoare"])).toBe("Vânzător, Vânzător, Vânzătoare");
  });
  it("joins two, skipping a blank between them", () => {
    expect(joinedCellText(["Copil", "", "Fiică"])).toBe("Copil, Fiică");
    expect(joinedCellText(["Copil", null, "Fiică"])).toBe("Copil, Fiică");
  });
  it("shows one alone, with no comma", () => {
    expect(joinedCellText(["Părinte", null, undefined])).toBe("Părinte");
    expect(joinedCellText(["  Părinte  ", "   ", ""])).toBe("Părinte");
  });
  it("shows „–” when every one is blank", () => {
    expect(joinedCellText([null, "", "  "])).toBe("–");
    expect(joinedCellText([])).toBe("–");
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
