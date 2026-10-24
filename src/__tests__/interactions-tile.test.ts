/**
 * Slice #37.89 — „Interacțiuni", a tile fixed at the right of the two person forms, purple, as large as a Document's
 * „Pagini"; and the Judicial Person's first tile is called „Identitate".
 * Slice #38.89 — the tile is no longer a placeholder: it reads the person's interactions and draws no form.
 */
import fs from "fs";
import path from "path";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { tileGroupOf } from "@/lib/ui/tiles";
import * as FW from "@/lib/ui/field-widths";
import { INTERACTIONS_TILE_STYLE, PAGES_PANEL_STYLE } from "@/lib/ui/field-widths";
import { interactionsHref } from "@/lib/interactions/links";

const msg = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", f), "utf8"));
const SRC = fs.readFileSync(path.join(process.cwd(), "src", "components", "tiles", "interactions-tile.tsx"), "utf8");
/** The source without its comments: what the tile does, not what it says about itself. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("„Interacțiuni” on both person registries", () => {
  it.each([["natural person", NP_TILE_REGISTRY], ["judicial person", JP_TILE_REGISTRY]] as const)("%s: in placement.right, in the purple group", (_n, reg) => {
    expect(reg.placement?.right).toContain("interactions");
    expect(tileGroupOf(reg as never, "interactions" as never)).toBe("fixed");
  });

  // #38.30 took it off the Natural Person's defaults, „off by default until it is built". It is built, and
  // Adrian, 2026-10-11: „„Interacțiuni” should be ticked by default on a natural person". It read: „is not ticked
  // by default on the Natural Person, and still is on the Judicial Person".
  it("is ticked by default on both persons", () => {
    expect(NP_TILE_REGISTRY.defaults).toContain("interactions");
    expect(NP_TILE_REGISTRY.all).toContain("interactions");
    expect(JP_TILE_REGISTRY.defaults).toContain("interactions");
  });

  it("is as wide as „Pagini”", () => {
    expect(INTERACTIONS_TILE_STYLE.width).toBe(PAGES_PANEL_STYLE.width);
  });

  it("names itself in both languages", () => {
    const ro = msg("ro-RO.json"), en = msg("en-GB.json");
    expect(ro.naturalPerson.tiles.interactions).toBe("Interacțiuni");
    expect(ro.judicialPerson.tiles.interactions).toBe("Interacțiuni");
    expect(en.naturalPerson.tiles.interactions).toBe("Interactions");
  });
});

// #38.30: „Identitate” (#37.89) became „Date de înregistrare”. The panel's heading reads the tile's
// key since #38.30, so there is no separate section key left to agree with it.
describe("the Judicial Person's first tile is „Date de înregistrare”", () => {
  it("in both languages, and the form's heading reads the tile's own key", () => {
    const ro = msg("ro-RO.json"), en = msg("en-GB.json");
    expect(ro.judicialPerson.tiles.identity).toBe("Date de înregistrare");
    expect(en.judicialPerson.tiles.identity).toBe("Registration details");
    expect(ro.judicialPerson.sections.identity).toBeUndefined();
    const form = fs.readFileSync(path.join(process.cwd(), "src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"), "utf8");
    expect(form).toContain('<TileTitle title={t("tiles.identity")}');
  });
});

/**
 * #38.89 changes in place what #38.06 held. It read: „„Interacțiuni”'s sentence, in italics and in parentheses —
 * is drawn in italics, the parentheses around the message; the message itself stays a plain sentence". The sentence
 * was `shared.tiles.interactionsPlaceholder`, „Modulul de gestionare a interacțiunilor va fi dezvoltat în viitor.";
 * the module is built, and the sentence is gone from both files.
 */
describe("the person's history, read-only (#38.89)", () => {
  it("the placeholder sentence is gone from both message files and from the tile", () => {
    for (const f of ["ro-RO.json", "en-GB.json"]) expect(msg(f).shared.tiles.interactionsPlaceholder).toBeUndefined();
    expect(CODE).not.toContain("interactionsPlaceholder");
  });

  it("reads that person's interactions from the list route, newest first", () => {
    expect(CODE).toContain("fetch(`/api/interactions?${q.toString()}`)");
    expect(CODE).toContain('new URLSearchParams({ personId, sort: "occurredAt", order: "desc", limit: String(PAGE_MAX) })');
  });

  it("draws no form: no box to type in, nothing sent but a read", () => {
    expect(CODE).not.toMatch(/<(input|textarea|select|form)\b/);
    expect(CODE).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
  });

  it("its columns: date and time, channel, direction, subject, status, documents — no person (Ask first #1)", () => {
    expect(CODE).toContain("<ChannelPill channel={row.channel} />");
    expect(CODE).toContain("<DirectionMark direction={row.direction} />");
    expect(CODE).toContain("<StatusPill status={row.status} />");
    expect(CODE).not.toMatch(/personName/);
  });

  // #39.05 changes this in place. It read: „its buttons and its rows open the module through the guarded navigation",
  // with `guardedNavigate(interactionsHref(` three times — „→", „+" and a row. „+" and a row now reach C, the action
  // panel under the history (person-interactions-tile.test.tsx), so only „→" opens the module.
  it("„Deschide în „Interacțiuni”” opens the module through the guarded navigation; „+” and a row are the caller's (#39.05)", () => {
    expect(CODE.match(/guardedNavigate\(interactionsHref\(/g)).toHaveLength(1);
    expect(CODE).toContain("onClick={onNew}");
    expect(CODE).toContain("onClick={onRow ? () => onRow(row.id) : undefined}");
    expect(interactionsHref("p1")).toBe("/interactions?person=p1");
    expect(interactionsHref("p1", { new: true })).toBe("/interactions?person=p1&new=1");
    expect(interactionsHref("p1", { select: "i9" })).toBe("/interactions?person=p1&select=i9");
  });

  // #39.06 changes this in place. It read: „the module opens with the row chosen, or a new record ready" —
  // `useState<string | null>(() => params.get("select"))` and `const wantNew = params.get("new") === "1";`. The form
  // left the module's screen, so those two addresses are forwarded to the person's screen, C on the row or on a new
  // record (interactions-a.test.ts).
  it("the module's old ?select and ?new addresses are forwarded to the person's screen (#39.06)", () => {
    const screen = fs.readFileSync(path.join(process.cwd(), "src", "app", "interactions", "_components", "interactions-screen.tsx"), "utf8");
    expect(screen).toContain('const forwardSelect = params.get("select");');
    expect(screen).toContain('const forwardNew = params.get("new") === "1";');
    expect(screen).toContain("router.replace(personLogHref(personBase(forwarded.data.personType), forwarded.data.personId, forwardSelect));");
    expect(screen).toContain("router.replace(personLogHref(personBase(scopeType), scope));");
  });
});

/**
 * Slice 40.43 — „Interacțiuni" as tall as what it holds, as „Legături" is. On a person's screen the tile has no height
 * of its own (it had `INTERACTIONS_TILE_STYLE`'s 436-px floor, and 40.33's 188 px while empty); the history is as tall
 * as its rows up to the ceiling less the tile's padding, its rows in the tile's flow, scrolling past it.
 */
describe("as tall as what it holds (40.43)", () => {
  it("no height of its own on a person's screen; B up to 410 px; 40.33's floor gone", () => {
    expect(SRC).toContain("const B_MAX_PX = ROW_TILE_CEILING_PX - 26;");
    expect(SRC).toContain('style={{ maxHeight: B_MAX_PX }} data-interactions-history=""');
    expect(SRC).toContain("const rows = peek || empty || footer ? (");
    expect(SRC).toMatch(/: footer\s*\?/);
    expect(SRC).toContain("{ ...PAGES_PANEL_STYLE }");
    expect(SRC).not.toMatch(/minHeight: INTERACTIONS_TILE_EMPTY_HEIGHT_PX/);
    expect("INTERACTIONS_TILE_EMPTY_HEIGHT_PX" in FW).toBe(false);
    expect(FW.ROW_TILE_CEILING_PX - 26).toBe(410);
  });
});
