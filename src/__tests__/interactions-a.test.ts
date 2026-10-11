/**
 * Slice #39.06 — „Rapoarte → Interacțiuni" shows A: everyone's history, each person a link.
 *
 * Adrian, 2026-10-11: „when clicking the Interactions module under Reporting the display will be A)". The log tile
 * (C) left this screen for the person's (#39.05); a person's name in the history opens that screen with C expanded.
 * The browser half is TC-INT-01 (the link) and TC-INT-02 to TC-INT-04 (C on a test person's screen).
 */
import fs from "node:fs";
import path from "node:path";
import { personBase, personLogHref } from "@/lib/interactions/links";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SCREEN = code(read("src", "app", "interactions", "_components", "interactions-screen.tsx"));
const HISTORY = code(read("src", "app", "interactions", "_components", "history-tile.tsx"));

describe("A alone (#39.06)", () => {
  it("the screen draws no log tile, no sticky button, and the history across the width", () => {
    expect(SCREEN).not.toContain("LogTile");
    expect(SCREEN).not.toContain("data-log-sticky");
    expect(SCREEN).not.toMatch(/@min-\[1100px\]:w-\[62%\]/);
    expect(SCREEN).toContain("<HistoryTile");
  });

  it("a row's click still selects it (its description preview); the counter and ?person stay", () => {
    expect(SCREEN).toContain("onSelect={setSelectedId}");
    expect(SCREEN).toContain('const scope = params.get("person");');
    expect(SCREEN).toContain("data-needs-reply={needsReply}");
  });

  it("the empty log's „Înregistrează prima interacțiune” is drawn only where there is a form to go to", () => {
    expect(HISTORY).toContain("{props.onLogFirst && (");
    expect(SCREEN).not.toContain("onLogFirst");
  });
});

describe("each person is a link to their screen, C expanded (#39.06)", () => {
  it("by the row's type: a natural person's screen or a company's, with ?log=new", () => {
    expect(personLogHref(personBase("NATURAL"), "p1")).toBe("/natural-persons/p1?log=new");
    expect(personLogHref(personBase("JUDICIAL"), "c1")).toBe("/judicial-persons/c1?log=new");
    expect(HISTORY).toContain("const personHref = personLogHref(personBase(row.personType), row.personId);");
  });

  it("a real <a href> (a new tab works), the name only, through the guarded navigation, never selecting the row", () => {
    const link = HISTORY.slice(HISTORY.indexOf("<Link"), HISTORY.indexOf("</Link>"));
    expect(link).toContain("href={personHref}");
    expect(link).toContain("e.stopPropagation();");
    expect(link).toContain("if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;");
    expect(link).toContain("guardedNavigate(personHref);");
    expect(link).toContain("{name}");
  });
});

describe("old addresses keep working (#39.06's Ask first 2)", () => {
  it("?select=<id>: the record read, then its person's screen with C on that row", () => {
    expect(SCREEN).toContain("const forwarded = useInteraction(forwardSelect);");
    expect(SCREEN).toContain("if (forwardSelect && forwarded.data) {");
  });

  it("?new=1 with a person: that person's screen with C on a new record; without one, A stays", () => {
    expect(SCREEN).toContain("} else if (!forwardSelect && forwardNew && scope && scopeType) {");
  });
});
